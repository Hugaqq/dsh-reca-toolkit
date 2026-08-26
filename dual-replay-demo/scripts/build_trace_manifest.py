#!/usr/bin/env python3
"""Build a redacted v3 replay manifest from one completed DSH + ReCA run.

The resulting file contains only product-facing metadata and paths into a
static demo bundle. Provider URLs, credentials, full backend payloads, and
absolute server paths are deliberately excluded.
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
from collections import defaultdict
from pathlib import Path
from typing import Any


SEGMENT_VALIDATE_RE = re.compile(
    r"\[segment-validate\]\s+(?P<id>\S+)\s+attempt\s+(?P<attempt>\d+)/(?:\d+):\s+"
    r"pass=(?P<passed>True|False)\s+overall=(?P<score>[0-9.]+).*?\|\s+(?P<detail>.*)"
)
SEGMENT_MODE_RE = re.compile(r"\[segment-trace\]\s+(?P<id>\S+):\s+refs=\d+.*?mode=(?P<mode>\w+)")
SEGMENT_DONE_RE = re.compile(r"\[segment-trace\]\s+(?P<id>\S+):\s+done\s+->")
ROUTER_RE = re.compile(r"\[router\]\s+(?P<id>\S+):\s+strategy=(?P<strategy>\w+)\s+\|\s+(?P<detail>.*)")
SEED_RE = re.compile(r"\[segment-seed-reroll\]\s+(?P<id>\S+):\s+(?P<detail>.*)")
MICRO_RE = re.compile(r"\[agent-trace\]\s+micro_adjust for (?P<id>\S+) done:\s+(?P<detail>.*)")


def read_json(path: Path, default: Any) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return default


def read_events(path: Path) -> list[dict[str, Any]]:
    result: list[dict[str, Any]] = []
    try:
        lines = path.read_text(encoding="utf-8").splitlines()
    except OSError:
        return result
    for line in lines:
        try:
            item = json.loads(line)
        except ValueError:
            continue
        if isinstance(item, dict) and isinstance(item.get("text"), str):
            result.append({"ts": item.get("ts"), "text": item["text"]})
    return result


def read_log_events(path: Path) -> list[dict[str, Any]]:
    """Use the persisted renderer log when Gateway JSONL was not retained."""
    try:
        lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
    except OSError:
        return []
    return [{"ts": index, "text": line} for index, line in enumerate(lines) if line.strip()]


def values(value: Any) -> list[dict[str, Any]]:
    if isinstance(value, dict):
        return [item for item in value.values() if isinstance(item, dict)]
    if isinstance(value, list):
        return [item for item in value if isinstance(item, dict)]
    return []


def media_duration(path: Path) -> float | None:
    if not path.exists():
        return None
    try:
        proc = subprocess.run(
            [
                "ffprobe",
                "-v",
                "error",
                "-show_entries",
                "format=duration",
                "-of",
                "default=noprint_wrappers=1:nokey=1",
                str(path),
            ],
            check=True,
            capture_output=True,
            text=True,
            timeout=20,
        )
        return round(float(proc.stdout.strip()), 3)
    except (OSError, ValueError, subprocess.SubprocessError):
        return None


def short(text: Any, limit: int = 180) -> str:
    clean = " ".join(str(text or "").split())
    return clean if len(clean) <= limit else clean[: limit - 1] + "…"


def parse_runtime_events(raw: list[dict[str, Any]]) -> dict[str, Any]:
    modes: dict[str, str] = {}
    done_order: list[str] = []
    leaf_activity: dict[str, list[dict[str, Any]]] = defaultdict(list)

    for event in raw:
        text = event["text"]
        match = SEGMENT_MODE_RE.search(text)
        if match:
            modes[match["id"]] = match["mode"].lower()
            continue
        match = SEGMENT_VALIDATE_RE.search(text)
        if match:
            leaf_activity[match["id"]].append(
                {
                    "kind": "validation",
                    "attempt": int(match["attempt"]),
                    "passed": match["passed"] == "True",
                    "score": float(match["score"]),
                    "detail": short(match["detail"], 240),
                }
            )
            continue
        match = ROUTER_RE.search(text)
        if match:
            leaf_activity[match["id"]].append(
                {
                    "kind": "repair",
                    "strategy": match["strategy"],
                    "detail": short(match["detail"], 220),
                }
            )
            continue
        match = SEED_RE.search(text)
        if match:
            leaf_activity[match["id"]].append(
                {"kind": "repair_detail", "strategy": "seed_reroll", "detail": short(match["detail"], 180)}
            )
            continue
        match = MICRO_RE.search(text)
        if match:
            leaf_activity[match["id"]].append(
                {"kind": "repair_detail", "strategy": "micro_adjust", "detail": short(match["detail"], 220)}
            )
            continue
        match = SEGMENT_DONE_RE.search(text)
        if match and match["id"] not in done_order:
            done_order.append(match["id"])

    return {"modes": modes, "done_order": done_order, "leaf_activity": leaf_activity}


def make_event(seq: int, t: float, source: str, type_: str, **payload: Any) -> dict[str, Any]:
    return {"seq": seq, "t": round(t, 2), "source": source, "type": type_, **payload}


def build_manifest(run_dir: Path, asset_prefix: str = "assets") -> dict[str, Any]:
    request = read_json(run_dir / "request.json", {})
    skeleton = read_json(run_dir / "skeleton.json", {})
    planner = read_json(run_dir / "planner.json", {})
    plan = read_json(run_dir / "render_plan.json", {})
    state = read_json(run_dir / "run" / "reca_state.json", {})
    audit = read_json(run_dir / "run" / "audit.json", {})
    summary = read_json(run_dir / "run" / "summary.json", {})
    gateway_events = read_events(run_dir / "events.jsonl")
    raw_events = gateway_events or read_log_events(run_dir / "run.log")
    event_source = "gateway_events" if gateway_events else ("renderer_log" if raw_events else "artifacts_only")
    runtime = parse_runtime_events(raw_events)
    story = request.get("story") if isinstance(request, dict) else ""
    if not story:
        try:
            story = (run_dir / "story.txt").read_text(encoding="utf-8").strip()
        except OSError:
            story = ""
    asset_prefix = asset_prefix.strip("/") or "assets"

    shot_source = values(skeleton.get("shots")) or values(planner.get("shots")) or values(plan.get("shots"))
    shot_by_id = {str(item.get("id")): item for item in shot_source if item.get("id")}
    segment_map = plan.get("segments") if isinstance(plan.get("segments"), dict) else {}
    segment_rows: list[dict[str, Any]] = []
    per_shot: dict[str, list[str]] = defaultdict(list)

    for segment_id, item in segment_map.items():
        if not isinstance(item, dict):
            continue
        req = item.get("segment_request") if isinstance(item.get("segment_request"), dict) else {}
        shot_id = str(item.get("shot_id") or "")
        index = int(item.get("segment_index_in_shot") or 0)
        source_path = run_dir / "run" / "segments" / f"{segment_id}.mp4"
        duration = media_duration(source_path) or req.get("duration_s") or 0
        activity = runtime["leaf_activity"].get(segment_id, [])
        failed = [event for event in activity if event["kind"] == "validation" and not event["passed"]]
        repairs = [event for event in activity if event["kind"].startswith("repair")]
        row = {
            "id": segment_id,
            "shot_id": shot_id,
            "index": index,
            "mode": runtime["modes"].get(segment_id) or ("r2v" if index == 0 else "i2v"),
            "planned_duration_s": req.get("duration_s"),
            "duration_s": duration,
            "prompt": short(req.get("prompt"), 520),
            "end_state": short(item.get("end_state"), 320),
            "start_anchor": item.get("start_anchor"),
            "src": f"{asset_prefix}/segments/{segment_id}.mp4",
            "tail_src": f"{asset_prefix}/tails/{segment_id}.png",
            "validation": activity,
            "had_repair": bool(failed or repairs),
        }
        segment_rows.append(row)
        per_shot[shot_id].append(segment_id)

    segment_rows.sort(key=lambda item: (list(shot_by_id).index(item["shot_id"]) if item["shot_id"] in shot_by_id else 999, item["index"]))
    segment_by_id = {item["id"]: item for item in segment_rows}

    anchors = values(plan.get("boundary_anchors"))
    anchor_by_shot: dict[str, str] = {}
    for segment in segment_rows:
        if segment["index"] == 0 and segment.get("start_anchor"):
            anchor_by_shot[segment["shot_id"]] = str(segment["start_anchor"])

    elapsed = 0.0
    shots: list[dict[str, Any]] = []
    for shot_id, shot in shot_by_id.items():
        leaves = sorted(per_shot.get(shot_id, []), key=lambda leaf_id: segment_by_id[leaf_id]["index"])
        actual_duration = round(sum(float(segment_by_id[leaf_id]["duration_s"] or 0) for leaf_id in leaves), 3)
        shots.append(
            {
                "id": shot_id,
                "title": shot_id.replace("_", " "),
                "story_goal": short(shot.get("story_goal") or shot.get("intent"), 300),
                "start_state": short(shot.get("start_state"), 260),
                "end_state": short(shot.get("end_state"), 260),
                "planned_duration_s": shot.get("duration_s"),
                "duration_s": actual_duration,
                "anchor_id": anchor_by_shot.get(shot_id),
                "leaf_ids": leaves,
                "t0": round(elapsed, 3),
                "t1": round(elapsed + actual_duration, 3),
            }
        )
        elapsed += actual_duration

    def memory_rows(kind: str, entries: Any) -> list[dict[str, Any]]:
        rows = []
        for item in values(entries):
            item_id = str(item.get("id") or item.get("request_id") or "")
            if not item_id:
                continue
            request_data = item.get("image_request") if isinstance(item.get("image_request"), dict) else item
            rows.append(
                {
                    "id": item_id,
                    "kind": kind,
                    "label": item.get("name") or item.get("reference_name") or item_id.replace("_", " "),
                    "prompt": short(request_data.get("prompt"), 260),
                    "src": f"{asset_prefix}/{kind}/{item_id}.png",
                }
            )
        return rows

    memory = (
        memory_rows("portraits", plan.get("portrait_plan"))
        + memory_rows("locations", plan.get("location_plan"))
        + memory_rows("props", plan.get("prop_plan"))
    )
    anchor_rows = []
    for anchor in anchors:
        anchor_id = str(anchor.get("id") or "")
        request_data = anchor.get("image_request") if isinstance(anchor.get("image_request"), dict) else anchor
        shot_id = next((key for key, value in anchor_by_shot.items() if value == anchor_id), None)
        anchor_rows.append(
            {
                "id": anchor_id,
                "shot_id": shot_id,
                "prompt": short(request_data.get("prompt"), 320),
                "references": anchor.get("reference_inputs") or {},
                "src": f"{asset_prefix}/anchors/{anchor_id}.png",
            }
        )

    transitions = []
    for transition in values(skeleton.get("transitions")):
        transitions.append(
            {
                "id": transition.get("id"),
                "from_shot": transition.get("from_shot"),
                "to_shot": transition.get("to_shot"),
                "mode": transition.get("mode") or "cut",
                "duration_s": transition.get("duration_s"),
            }
        )

    # Build a compact, deterministic replay clock from real artifact/log order.
    events: list[dict[str, Any]] = []
    t = 0.0
    seq = 0

    def emit(source: str, type_: str, dt: float = 0.9, **payload: Any) -> None:
        nonlocal t, seq
        events.append(make_event(seq, t, source, type_, **payload))
        seq += 1
        t += dt

    emit("dsh", "dsh.user_message", 1.2, message=short(story, 420) or "Generate this multi-shot film through ReCA.")
    emit("dsh", "dsh.agent_message", 1.0, message="我会调用 ReCA，把故事规划成多镜头、生成一致性资产，并持续检查渲染状态。")
    emit("dsh", "dsh.tool.start", 1.1, tool="reca_create_video", status="calling", detail="提交 90 秒、16:9、Wan 3.0 视频任务")
    emit("dsh", "dsh.tool.result", 0.9, tool="reca_create_video", status="queued", detail=f"run_id: {state.get('run_id') or run_dir.name}")
    emit("reca", "reca.plan.start", 1.0, label="Recursive planning")
    emit("reca", "reca.plan.ready", 1.0, label=f"{len(shots)} shots · {len(segment_rows)} segments", count=len(shots))
    emit("dsh", "dsh.tool.status", 0.8, tool="reca_get_status", status="running", detail=f"规划完成：{len(shots)} shots / {len(segment_rows)} segments")

    for item in memory:
        emit("reca", "reca.asset.ready", 0.6, node_id=item["id"], kind=item["kind"], label=item["label"])
    for item in anchor_rows:
        emit("reca", "reca.anchor.ready", 0.6, node_id=item["id"], shot_id=item["shot_id"], label="Start anchor ready")
    emit("dsh", "dsh.tool.status", 0.8, tool="reca_get_status", status="running", detail=f"资产就绪：{len(memory) + len(anchor_rows)} images")

    # Showing all shot heads as active first communicates shot-level parallelism.
    for shot in shots:
        if shot["leaf_ids"]:
            emit("reca", "reca.segment.start", 0.45, node_id=shot["leaf_ids"][0], shot_id=shot["id"], label="Rendering")

    done_order = [item for item in runtime["done_order"] if item in segment_by_id]
    done_order.extend(item["id"] for item in segment_rows if item["id"] not in done_order)
    started = {shot["leaf_ids"][0] for shot in shots if shot["leaf_ids"]}
    for segment_id in done_order:
        leaf = segment_by_id[segment_id]
        if segment_id not in started:
            emit("reca", "reca.segment.start", 0.45, node_id=segment_id, shot_id=leaf["shot_id"], label="Rendering")
            started.add(segment_id)
        for activity in leaf["validation"]:
            if activity["kind"] == "validation":
                emit(
                    "reca",
                    "reca.validation.pass" if activity["passed"] else "reca.validation.flagged",
                    0.75,
                    node_id=segment_id,
                    shot_id=leaf["shot_id"],
                    label=f"Validator {activity['score']:.2f}",
                    detail=activity["detail"],
                )
            elif activity["kind"] == "repair":
                emit(
                    "reca",
                    "reca.repair.start",
                    0.75,
                    node_id=segment_id,
                    shot_id=leaf["shot_id"],
                    strategy=activity["strategy"],
                    label=activity["strategy"].replace("_", " "),
                    detail=activity["detail"],
                )
        emit("reca", "reca.segment.ready", 0.8, node_id=segment_id, shot_id=leaf["shot_id"], label="Segment ready")
        siblings = sorted(per_shot[leaf["shot_id"]], key=lambda item: segment_by_id[item]["index"])
        next_index = siblings.index(segment_id) + 1
        if next_index < len(siblings):
            next_id = siblings[next_index]
            if next_id not in started:
                emit("reca", "reca.segment.start", 0.45, node_id=next_id, shot_id=leaf["shot_id"], label="Rendering from previous tail")
                started.add(next_id)

    emit("dsh", "dsh.tool.status", 0.9, tool="reca_get_status", status="running", detail=f"已完成 {len(segment_rows)}/{len(segment_rows)} segments，开始合成")
    emit("reca", "reca.concat.start", 1.0, label="Concatenating final film")
    emit("reca", "reca.final.ready", 1.0, node_id="root", label="final.mp4 ready")
    emit("dsh", "dsh.tool.result", 0.0, tool="reca_get_artifact", status="succeeded", detail="最终视频和可审计执行轨迹已交付")

    run_config = state.get("run_config") if isinstance(state.get("run_config"), dict) else request.get("options", {})
    backend_info = summary.get("backend_info") if isinstance(summary.get("backend_info"), dict) else {}
    film_path = run_dir / "run" / "final.mp4"
    return {
        "version": 3,
        "run_id": state.get("run_id") or run_dir.name,
        "recording": {
            "kind": "real_run_artifact_replay",
            "source": "request + skeleton + render plan + audit + runtime events + local media",
            "raw_event_count": len(raw_events),
            "event_source": event_source,
            "replay_duration_s": round(t, 2),
            "redacted": True,
        },
        "story": short(story, 1200),
        "run": {
            "state": state.get("state"),
            "stage": state.get("stage"),
            "audit_state": state.get("audit_state") or audit.get("state"),
            "video_state": state.get("video_state"),
            "resolution": run_config.get("resolution"),
            "duration_s": run_config.get("duration_s"),
            "seed": run_config.get("seed"),
            "planner_model": backend_info.get("planner_model"),
            "render": backend_info.get("render") or {},
        },
        "counts": {
            "shots": len(shots),
            "segments": len(segment_rows),
            "assets": len(memory) + len(anchor_rows),
            "bridges": sum(1 for item in transitions if item["mode"] == "bridge"),
            "repairs": sum(1 for item in segment_rows if item["had_repair"]),
        },
        "film": {
            "src": f"{asset_prefix}/final.mp4",
            "poster": f"{asset_prefix}/contact.jpg",
            "duration_s": media_duration(film_path) or elapsed,
        },
        "memory": memory,
        "anchors": anchor_rows,
        "shots": shots,
        "leaves": segment_rows,
        "transitions": transitions,
        "events": events,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("run_dir", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--asset-prefix", default="assets")
    args = parser.parse_args()
    manifest = build_manifest(args.run_dir.resolve(), args.asset_prefix)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"output": str(args.output), "run_id": manifest["run_id"], "counts": manifest["counts"]}, ensure_ascii=False))


if __name__ == "__main__":
    main()
