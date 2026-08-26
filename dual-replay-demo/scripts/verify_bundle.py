#!/usr/bin/env python3
"""Verify that a static dual-replay bundle is complete and self-contained."""
from __future__ import annotations

import argparse
import json
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("bundle", type=Path)
    parser.add_argument("--manifest", default="data/trace_manifest.json")
    args = parser.parse_args()
    root = args.bundle.resolve()
    manifest_path = root / args.manifest
    data = json.loads(manifest_path.read_text(encoding="utf-8"))

    assert data["version"] == 3
    assert data["recording"]["kind"] == "real_run_artifact_replay"
    assert data["recording"]["redacted"] is True
    assert len(data["shots"]) == data["counts"]["shots"]
    assert len(data["leaves"]) == data["counts"]["segments"]
    assert len(data["memory"]) + len(data["anchors"]) == data["counts"]["assets"]

    event_types = [event["type"] for event in data["events"]]
    assert "dsh.tool.start" in event_types
    assert "reca.plan.ready" in event_types
    assert "reca.final.ready" in event_types
    assert event_types[-1] == "dsh.tool.result"
    assert [event["seq"] for event in data["events"]] == list(range(len(data["events"])))
    assert [event["t"] for event in data["events"]] == sorted(event["t"] for event in data["events"])

    known_leaves = {leaf["id"] for leaf in data["leaves"]}
    started = {event.get("node_id") for event in data["events"] if event["type"] == "reca.segment.start"}
    completed = {event.get("node_id") for event in data["events"] if event["type"] == "reca.segment.ready"}
    assert known_leaves == started == completed

    repaired = {leaf["id"] for leaf in data["leaves"] if leaf["had_repair"]}
    flagged = {event.get("node_id") for event in data["events"] if event["type"] == "reca.validation.flagged"}
    assert repaired <= flagged

    media_paths = [data["film"]["src"]]
    if data["film"].get("poster"):
        media_paths.append(data["film"]["poster"])
    media_paths += [item["src"] for item in data["memory"]]
    media_paths += [item["src"] for item in data["anchors"]]
    media_paths += [item["src"] for item in data["leaves"]]
    media_paths += [item["tail_src"] for item in data["leaves"]]
    missing = [path for path in media_paths if not (root / path).is_file()]
    assert not missing, f"missing bundle media: {missing}"

    raw = manifest_path.read_text(encoding="utf-8")
    assert "/mnt/" not in raw
    assert "dashscope-" not in raw
    assert "api_key" not in raw.lower()

    result = {
        "run_id": data["run_id"],
        "events": len(data["events"]),
        "media": len(media_paths),
        "shots": len(data["shots"]),
        "segments": len(data["leaves"]),
        "repairs": len(repaired),
    }
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
