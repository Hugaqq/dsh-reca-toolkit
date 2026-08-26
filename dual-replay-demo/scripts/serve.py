#!/usr/bin/env python3
"""Serve the demo with HTTP byte-range support for large MP4 artifacts."""
from __future__ import annotations

import argparse
import functools
import os
import re
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import BinaryIO


class RangeRequestHandler(SimpleHTTPRequestHandler):
    range: tuple[int, int] | None = None

    def end_headers(self) -> None:
        self.send_header("Accept-Ranges", "bytes")
        super().end_headers()

    def send_head(self) -> BinaryIO | None:
        range_header = self.headers.get("Range")
        if not range_header:
            self.range = None
            return super().send_head()

        path = Path(self.translate_path(self.path))
        if path.is_dir() or not path.is_file():
            self.range = None
            return super().send_head()
        match = re.fullmatch(r"bytes=(\d*)-(\d*)", range_header.strip())
        if not match:
            self.send_error(400, "Invalid Range header")
            return None

        size = path.stat().st_size
        start_text, end_text = match.groups()
        if not start_text and not end_text:
            self.send_error(400, "Invalid Range header")
            return None
        if start_text:
            start = int(start_text)
            end = int(end_text) if end_text else size - 1
        else:
            suffix = min(int(end_text), size)
            start, end = size - suffix, size - 1
        if start >= size or end < start:
            self.send_response(416)
            self.send_header("Content-Range", f"bytes */{size}")
            self.end_headers()
            return None
        end = min(end, size - 1)

        handle = path.open("rb")
        self.range = (start, end)
        self.send_response(206)
        self.send_header("Content-Type", self.guess_type(str(path)))
        self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        self.send_header("Content-Length", str(end - start + 1))
        self.send_header("Last-Modified", self.date_time_string(path.stat().st_mtime))
        self.end_headers()
        handle.seek(start)
        return handle

    def copyfile(self, source: BinaryIO, outputfile: BinaryIO) -> None:
        if self.range is None:
            super().copyfile(source, outputfile)
            return
        remaining = self.range[1] - self.range[0] + 1
        while remaining:
            chunk = source.read(min(64 * 1024, remaining))
            if not chunk:
                break
            outputfile.write(chunk)
            remaining -= len(chunk)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--directory", type=Path, default=Path("."))
    parser.add_argument("--bind", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8091)
    args = parser.parse_args()
    handler = functools.partial(RangeRequestHandler, directory=os.fspath(args.directory.resolve()))
    server = ThreadingHTTPServer((args.bind, args.port), handler)
    print(f"Serving {args.directory.resolve()} at http://{args.bind}:{args.port}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
