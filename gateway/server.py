from __future__ import annotations

import argparse
import hmac
import json
import mimetypes
import os
import re
import secrets
import stat
import sys
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse

from .doctor import gateway_capabilities
from .jobs import JobManager


FILE_CHUNK_SIZE = 64 * 1024
SINGLE_BYTE_RANGE_RE = re.compile(r"^bytes=(\d*)-(\d*)$")
RUN_ID_RE = re.compile(r"^[A-Za-z0-9_-]{1,128}$")
GATEWAY_INSTANCE_FILE_NAME = ".gateway-instance-id"
GENERATED_GATEWAY_INSTANCE_ID_RE = re.compile(r"^gw_[0-9a-f]{64}$")
CONFIGURED_GATEWAY_INSTANCE_ID_RE = re.compile(
    r"^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$"
)


def _read_gateway_instance_id(path: Path) -> str:
    flags = os.O_RDONLY | getattr(os, "O_CLOEXEC", 0) | getattr(os, "O_NOFOLLOW", 0)
    fd = os.open(path, flags)
    try:
        metadata = os.fstat(fd)
        if not stat.S_ISREG(metadata.st_mode):
            raise ValueError("identity path is not a regular file")
        if stat.S_IMODE(metadata.st_mode) != 0o600:
            raise ValueError("identity file permissions must be 0600")

        expected_size = len("gw_") + 64
        payload = bytearray()
        while len(payload) <= expected_size:
            chunk = os.read(fd, expected_size + 1 - len(payload))
            if not chunk:
                break
            payload.extend(chunk)
    finally:
        os.close(fd)

    try:
        value = bytes(payload).decode("ascii")
    except UnicodeDecodeError as exc:
        raise ValueError("identity file must contain ASCII") from exc
    if GENERATED_GATEWAY_INSTANCE_ID_RE.fullmatch(value) is None:
        raise ValueError("identity file content is invalid")
    return value


def _fsync_directory(path: Path) -> None:
    flags = (
        os.O_RDONLY
        | getattr(os, "O_CLOEXEC", 0)
        | getattr(os, "O_DIRECTORY", 0)
        | getattr(os, "O_NOFOLLOW", 0)
    )
    fd = os.open(path, flags)
    try:
        os.fsync(fd)
    finally:
        os.close(fd)


def _persist_gateway_instance_id(path: Path) -> str:
    try:
        return _read_gateway_instance_id(path)
    except FileNotFoundError:
        pass

    if not path.parent.is_dir():
        raise FileNotFoundError(f"run store directory does not exist: {path.parent}")

    generated = f"gw_{secrets.token_hex(32)}"
    temporary_path = path.with_name(
        f"{path.name}.{os.getpid()}.{secrets.token_hex(16)}.tmp"
    )
    flags = (
        os.O_WRONLY
        | os.O_CREAT
        | os.O_EXCL
        | getattr(os, "O_CLOEXEC", 0)
        | getattr(os, "O_NOFOLLOW", 0)
    )
    fd = os.open(temporary_path, flags, 0o600)
    try:
        try:
            os.fchmod(fd, 0o600)
            remaining = memoryview(generated.encode("ascii"))
            while remaining:
                written = os.write(fd, remaining)
                if written <= 0:
                    raise OSError("failed to write Gateway identity")
                remaining = remaining[written:]
            os.fsync(fd)
        finally:
            os.close(fd)

        # Publishing a fully synced same-directory hard link is atomic and
        # never overwrites the winner when Gateways start concurrently.
        try:
            os.link(temporary_path, path, follow_symlinks=False)
        except FileExistsError:
            return _read_gateway_instance_id(path)
        _fsync_directory(path.parent)
    finally:
        try:
            temporary_path.unlink()
        except FileNotFoundError:
            pass
    return generated


def _gateway_instance_id(manager: JobManager, configured: str | None = None) -> str:
    """Return an opaque identity that is stable for one persistent run store."""
    explicit = str(os.environ.get("RECA_GATEWAY_INSTANCE_ID") or configured or "").strip()
    if explicit:
        if CONFIGURED_GATEWAY_INSTANCE_ID_RE.fullmatch(explicit) is None:
            raise ValueError(
                "RECA_GATEWAY_INSTANCE_ID must be 1-128 safe ASCII characters"
            )
        return explicit

    storage_root = getattr(manager, "runs_root", None)
    if storage_root is None:
        storage_root = getattr(manager, "root", None)
    if storage_root is None:
        raise ValueError("Gateway manager must expose runs_root or root")

    identity_path = (
        Path(storage_root).expanduser().resolve() / GATEWAY_INSTANCE_FILE_NAME
    )
    try:
        return _persist_gateway_instance_id(identity_path)
    except (OSError, ValueError) as exc:
        raise RuntimeError(
            f"Cannot load or create persistent Gateway identity at {identity_path}: "
            f"{exc}. Ensure the ReCA run store is writable and private, or set "
            "RECA_GATEWAY_INSTANCE_ID."
        ) from exc


def _resolve_byte_range(value: str, size: int) -> tuple[int, int]:
    """Resolve one RFC 7233 byte range, or raise ValueError for a 416 response."""
    match = SINGLE_BYTE_RANGE_RE.fullmatch(value.strip())
    if match is None or size <= 0:
        raise ValueError("invalid or unsatisfiable byte range")

    start_text, end_text = match.groups()
    if not start_text and not end_text:
        raise ValueError("empty byte range")

    if start_text:
        start = int(start_text)
        if start >= size:
            raise ValueError("byte range starts beyond the resource")
        end = int(end_text) if end_text else size - 1
        if end < start:
            raise ValueError("byte range end precedes its start")
        return start, min(end, size - 1)

    suffix_length = int(end_text)
    if suffix_length <= 0:
        raise ValueError("byte range suffix must be positive")
    length = min(suffix_length, size)
    return size - length, size - 1


class GatewayHandler(BaseHTTPRequestHandler):
    server_version = "DSH-ReCA-Gateway/0.1"

    @property
    def manager(self) -> JobManager:
        return self.server.manager  # type: ignore[attr-defined]

    def log_message(self, fmt: str, *args: object) -> None:
        sys.stdout.write("[reca-gateway] " + (fmt % args) + "\n")

    def _cors_origin(self) -> str | None:
        origin = str(self.headers.get("Origin") or "").strip()
        configured = {
            item.strip()
            for item in os.environ.get("RECA_GATEWAY_ALLOW_ORIGIN", "").split(",")
            if item.strip() and item.strip() != "*"
        }
        return origin if origin and origin in configured else None

    def _send_cors_headers(self) -> None:
        origin = self._cors_origin()
        if origin:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")

    def _authorized(self) -> bool:
        token = os.environ.get("RECA_GATEWAY_TOKEN", "").strip()
        if not token:
            return True
        supplied = str(self.headers.get("Authorization") or "")
        return hmac.compare_digest(supplied, f"Bearer {token}")

    def _require_authorized(self, *, head_only: bool = False) -> bool:
        if self._authorized():
            return True
        self._send_json(
            HTTPStatus.UNAUTHORIZED,
            {"error": "missing or invalid ReCA Gateway token"},
            head_only=head_only,
            extra_headers={"WWW-Authenticate": "Bearer"},
        )
        return False

    def _send_json(
        self,
        status: int,
        payload: object,
        *,
        head_only: bool = False,
        extra_headers: dict[str, str] | None = None,
    ) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self._send_cors_headers()
        for name, value in (extra_headers or {}).items():
            self.send_header(name, value)
        self.end_headers()
        if not head_only:
            self.wfile.write(body)

    def _send_file(self, path: Path, *, head_only: bool = False) -> None:
        content_type = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
        try:
            source = path.open("rb")
        except OSError:
            return self._send_json(
                HTTPStatus.NOT_FOUND,
                {"error": "artifact not found"},
                head_only=head_only,
            )

        with source:
            size = os.fstat(source.fileno()).st_size
            range_header = self.headers.get("Range")
            start = 0
            end = size - 1
            status = HTTPStatus.OK

            if range_header is not None:
                try:
                    start, end = _resolve_byte_range(range_header, size)
                except (ValueError, OverflowError):
                    self.send_response(HTTPStatus.REQUESTED_RANGE_NOT_SATISFIABLE)
                    self.send_header("Accept-Ranges", "bytes")
                    self.send_header("Content-Range", f"bytes */{size}")
                    self.send_header("Content-Length", "0")
                    self._send_cors_headers()
                    self.send_header("Access-Control-Expose-Headers", "Accept-Ranges, Content-Length, Content-Range")
                    self.end_headers()
                    return
                status = HTTPStatus.PARTIAL_CONTENT

            content_length = max(0, end - start + 1)
            self.send_response(status)
            self.send_header("Content-Type", content_type)
            self.send_header("Accept-Ranges", "bytes")
            self.send_header("Content-Length", str(content_length))
            if status == HTTPStatus.PARTIAL_CONTENT:
                self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
            self._send_cors_headers()
            self.send_header("Access-Control-Expose-Headers", "Accept-Ranges, Content-Length, Content-Range")
            self.end_headers()

            if head_only or content_length == 0:
                return

            source.seek(start)
            remaining = content_length
            try:
                while remaining > 0:
                    chunk = source.read(min(FILE_CHUNK_SIZE, remaining))
                    if not chunk:
                        break
                    self.wfile.write(chunk)
                    remaining -= len(chunk)
            except (BrokenPipeError, ConnectionResetError):
                # Media clients routinely abandon an obsolete range after seeking.
                return

    def _body(self) -> dict:
        try:
            size = int(self.headers.get("Content-Length", "0"))
            raw = self.rfile.read(size) if size else b"{}"
            value = json.loads(raw.decode("utf-8"))
            return value if isinstance(value, dict) else {}
        except (ValueError, UnicodeDecodeError, json.JSONDecodeError):
            raise ValueError("request body must be a JSON object")

    def do_OPTIONS(self) -> None:
        if self._cors_origin() is None:
            self.send_response(HTTPStatus.FORBIDDEN)
            self.send_header("Content-Length", "0")
            self.end_headers()
            return
        self.send_response(HTTPStatus.NO_CONTENT)
        self._send_cors_headers()
        self.send_header("Access-Control-Allow-Methods", "GET, HEAD, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "authorization, content-type, range")
        self.send_header("Access-Control-Expose-Headers", "Accept-Ranges, Content-Length, Content-Range")
        self.end_headers()

    def do_GET(self) -> None:
        self._dispatch_get(head_only=False)

    def do_HEAD(self) -> None:
        self._dispatch_get(head_only=True)

    def _dispatch_get(self, *, head_only: bool) -> None:
        path = unquote(urlparse(self.path).path)
        if path == "/health":
            return self._send_json(
                HTTPStatus.OK,
                {
                    "ok": True,
                    "service": "reca-gateway",
                    "gateway_instance_id": self.server.gateway_instance_id,  # type: ignore[attr-defined]
                },
                head_only=head_only,
            )
        if path.startswith("/v1/") and not self._require_authorized(head_only=head_only):
            return
        if path == "/v1/capabilities":
            capabilities = gateway_capabilities(Path(self.manager.root))
            return self._send_json(
                HTTPStatus.OK,
                {
                    "service": "reca-gateway",
                    "gateway_instance_id": self.server.gateway_instance_id,  # type: ignore[attr-defined]
                    **capabilities,
                },
                head_only=head_only,
            )
        if path == "/v1/runs":
            return self._send_json(
                HTTPStatus.OK,
                {"runs": self.manager.list_runs()},
                head_only=head_only,
            )

        parts = path.strip("/").split("/")
        if len(parts) >= 3 and parts[0:2] == ["v1", "runs"]:
            run_id = parts[2]
            if RUN_ID_RE.fullmatch(run_id) is None:
                return self._send_json(
                    HTTPStatus.NOT_FOUND,
                    {"error": "run not found"},
                    head_only=head_only,
                )
            if len(parts) == 3:
                status = self.manager.status(run_id)
                if status is None:
                    return self._send_json(
                        HTTPStatus.NOT_FOUND,
                        {"error": "run not found"},
                        head_only=head_only,
                    )
                return self._send_json(HTTPStatus.OK, status, head_only=head_only)
            if len(parts) == 4 and parts[3] == "events":
                events = self.manager.events(run_id)
                if events is None:
                    return self._send_json(
                        HTTPStatus.NOT_FOUND,
                        {"error": "run not found"},
                        head_only=head_only,
                    )
                return self._send_json(
                    HTTPStatus.OK,
                    {"run_id": run_id, "events": events},
                    head_only=head_only,
                )
            if len(parts) >= 5 and parts[3] == "artifacts":
                relative = "/".join(parts[4:])
                artifact = self.manager.artifact_path(run_id, relative)
                if artifact is None:
                    return self._send_json(
                        HTTPStatus.NOT_FOUND,
                        {"error": "artifact not found"},
                        head_only=head_only,
                    )
                return self._send_file(artifact, head_only=head_only)
            if len(parts) == 4 and parts[3] == "artifacts":
                status = self.manager.status(run_id)
                if status is None:
                    return self._send_json(
                        HTTPStatus.NOT_FOUND,
                        {"error": "run not found"},
                        head_only=head_only,
                    )
                return self._send_json(
                    HTTPStatus.OK,
                    status.get("artifact_manifest", {}),
                    head_only=head_only,
                )
        return self._send_json(
            HTTPStatus.NOT_FOUND,
            {"error": "route not found"},
            head_only=head_only,
        )

    def do_POST(self) -> None:
        path = unquote(urlparse(self.path).path).rstrip("/")
        if path.startswith("/v1/") and not self._require_authorized():
            return
        content_type = str(self.headers.get("Content-Type") or "").split(";", 1)[0].strip().lower()
        if content_type != "application/json":
            return self._send_json(
                HTTPStatus.UNSUPPORTED_MEDIA_TYPE,
                {"error": "Content-Type must be application/json"},
            )
        try:
            body = self._body()
        except ValueError as exc:
            return self._send_json(HTTPStatus.BAD_REQUEST, {"error": str(exc)})

        if path == "/v1/runs":
            try:
                state = self.manager.start(body)
            except (ValueError, TypeError) as exc:
                return self._send_json(HTTPStatus.BAD_REQUEST, {"error": str(exc)})
            return self._send_json(HTTPStatus.ACCEPTED, state)

        parts = path.strip("/").split("/")
        if len(parts) == 4 and parts[:2] == ["v1", "runs"] and parts[3] == "cancel":
            if RUN_ID_RE.fullmatch(parts[2]) is None:
                return self._send_json(HTTPStatus.NOT_FOUND, {"error": "run not found"})
            state = self.manager.cancel(parts[2])
            if state is None:
                return self._send_json(HTTPStatus.NOT_FOUND, {"error": "run not found"})
            return self._send_json(HTTPStatus.OK, state)
        if len(parts) == 4 and parts[:2] == ["v1", "runs"] and parts[3] == "resume":
            if RUN_ID_RE.fullmatch(parts[2]) is None:
                return self._send_json(HTTPStatus.NOT_FOUND, {"error": "run not found"})
            try:
                state = self.manager.resume(parts[2])
            except (ValueError, TypeError) as exc:
                return self._send_json(HTTPStatus.BAD_REQUEST, {"error": str(exc)})
            if state is None:
                return self._send_json(HTTPStatus.NOT_FOUND, {"error": "run not found"})
            return self._send_json(HTTPStatus.ACCEPTED, state)
        return self._send_json(HTTPStatus.NOT_FOUND, {"error": "route not found"})


class GatewayServer(ThreadingHTTPServer):
    def __init__(
        self,
        address: tuple[str, int],
        manager: JobManager,
        *,
        gateway_instance_id: str | None = None,
    ) -> None:
        resolved_instance_id = _gateway_instance_id(manager, gateway_instance_id)
        super().__init__(address, GatewayHandler)
        self.manager = manager
        # The explicit deployment identifier wins. Otherwise the persisted
        # random ID follows the run store even if its mount path changes.
        self.gateway_instance_id = resolved_instance_id


def main() -> None:
    parser = argparse.ArgumentParser(description="Expose the bundled ReCA pipeline to DSH")
    parser.add_argument("--host", default=os.environ.get("RECA_GATEWAY_HOST", "127.0.0.1"))
    parser.add_argument("--port", type=int, default=int(os.environ.get("RECA_GATEWAY_PORT", "8787")))
    args = parser.parse_args()
    manager = JobManager()
    server = GatewayServer((args.host, args.port), manager)
    print(f"[reca-gateway] listening on http://{args.host}:{args.port}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("[reca-gateway] stopping", flush=True)
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
