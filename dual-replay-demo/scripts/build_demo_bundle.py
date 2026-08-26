#!/usr/bin/env python3
"""Copy safe local run artifacts into the static dual-replay demo."""
from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
from pathlib import Path


def copy_if_exists(source: Path, target: Path, link: bool = False) -> bool:
    if not source.is_file():
        return False
    target.parent.mkdir(parents=True, exist_ok=True)
    if target.exists() or target.is_symlink():
        target.unlink()
    if link:
        try:
            os.link(source, target)
        except OSError:
            shutil.copy2(source, target)
    else:
        shutil.copy2(source, target)
    return True


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("run_dir", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--slug")
    parser.add_argument("--link", action="store_true", help="Hard-link media when source and output share a filesystem")
    args = parser.parse_args()
    run = args.run_dir.resolve()
    output = args.output.resolve()
    slug = args.slug or run.name
    data_dir = output / "data" / "runs"
    asset_prefix = f"assets/runs/{slug}"
    assets_dir = output / asset_prefix
    data_dir.mkdir(parents=True, exist_ok=True)
    assets_dir.mkdir(parents=True, exist_ok=True)

    builder = Path(__file__).with_name("build_trace_manifest.py")
    manifest_path = data_dir / f"{slug}.json"
    subprocess.run(
        ["python3", str(builder), str(run), "--output", str(manifest_path), "--asset-prefix", asset_prefix],
        check=True,
    )
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))

    copied: list[str] = []

    def transfer(source: Path, relative: str) -> None:
        if copy_if_exists(source, output / relative, link=args.link):
            copied.append(relative)

    transfer(run / "run" / "final.mp4", f"{asset_prefix}/final.mp4")
    transfer(run / "run" / "contact.jpg", f"{asset_prefix}/contact.jpg")
    for item in manifest["memory"]:
        transfer(run / "run" / item["kind"] / f"{item['id']}.png", item["src"])
    for item in manifest["anchors"]:
        transfer(run / "run" / "anchors" / f"{item['id']}.png", item["src"])
    for leaf in manifest["leaves"]:
        transfer(run / "run" / "segments" / f"{leaf['id']}.mp4", leaf["src"])
        transfer(run / "run" / "segments" / f"{leaf['id']}.tail.png", leaf["tail_src"])

    print(json.dumps({"output": str(output), "run_id": manifest["run_id"], "slug": slug, "copied": len(copied)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
