from __future__ import annotations

import json
import os
import stat
import tempfile
import threading
import unittest
from pathlib import Path
from unittest.mock import patch
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from gateway.server import GatewayServer, _gateway_instance_id


class FakeManager:
    ARTIFACT_BYTES = bytes(range(256)) * 1025

    def __init__(self, root: Path) -> None:
        self.root = root
        self.calls: list[tuple[str, str]] = []
        self.status_value = {
            "run_id": "abc123",
            "state": "running",
            "gateway_state": "running",
            "artifact_manifest": {"run_id": "abc123", "artifacts": []},
        }
        (root / "final.mp4").write_bytes(self.ARTIFACT_BYTES)

    def list_runs(self):
        return [self.status_value]

    def status(self, run_id):
        self.calls.append(("status", run_id))
        if run_id == "abc123":
            return self.status_value
        if run_id == "historic_run_01":
            return {**self.status_value, "run_id": run_id}
        return None

    def start(self, body):
        self.calls.append(("start", body["story"]))
        return self.status_value

    def cancel(self, run_id):
        self.calls.append(("cancel", run_id))
        return self.status_value if run_id == "abc123" else None

    def resume(self, run_id):
        self.calls.append(("resume", run_id))
        return self.status_value if run_id == "abc123" else None

    def events(self, run_id):
        return [] if run_id == "abc123" else None

    def artifact_path(self, run_id, relative):
        if run_id == "abc123" and relative == "final.mp4":
            return self.root / "final.mp4"
        return None


class GatewayHttpLifecycleTests(unittest.TestCase):
    def setUp(self) -> None:
        self.clean_gateway_environment = patch.dict(
            os.environ,
            {
                "RECA_GATEWAY_TOKEN": "",
                "RECA_GATEWAY_ALLOW_ORIGIN": "",
                "RECA_GATEWAY_INSTANCE_ID": "",
            },
        )
        self.clean_gateway_environment.start()
        self.addCleanup(self.clean_gateway_environment.stop)

    def test_http_lifecycle_routes(self) -> None:
        with tempfile.TemporaryDirectory() as value:
            manager = FakeManager(Path(value))
            server = GatewayServer(("127.0.0.1", 0), manager)  # type: ignore[arg-type]
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            thread.start()
            base = f"http://127.0.0.1:{server.server_address[1]}"
            try:
                with urlopen(base + "/health") as response:
                    self.assertEqual(response.status, 200)
                    self.assertTrue(json.loads(response.read())["ok"])

                request = Request(
                    base + "/v1/runs",
                    data=json.dumps({"story": "a short story"}).encode(),
                    headers={"Content-Type": "application/json"},
                )
                with urlopen(request) as response:
                    self.assertEqual(response.status, 202)
                self.assertIn(("start", "a short story"), manager.calls)

                with urlopen(base + "/v1/runs/abc123") as response:
                    self.assertEqual(json.loads(response.read())["gateway_state"], "running")

                with urlopen(base + "/v1/runs/historic_run_01") as response:
                    self.assertEqual(json.loads(response.read())["run_id"], "historic_run_01")

                with self.assertRaises(HTTPError) as invalid_run:
                    urlopen(base + "/v1/runs/%2e%2e")
                self.assertEqual(invalid_run.exception.code, 404)
                invalid_run.exception.close()
                self.assertNotIn(("status", ".."), manager.calls)

                for action in ("cancel", "resume"):
                    request = Request(
                        f"{base}/v1/runs/abc123/{action}",
                        data=b"{}",
                        headers={"Content-Type": "application/json"},
                    )
                    with urlopen(request) as response:
                        self.assertEqual(response.status, 200 if action == "cancel" else 202)
                self.assertIn(("cancel", "abc123"), manager.calls)
                self.assertIn(("resume", "abc123"), manager.calls)

                with urlopen(base + "/v1/runs/abc123/artifacts/final.mp4") as response:
                    self.assertEqual(response.read(), manager.ARTIFACT_BYTES)

                with self.assertRaises(HTTPError) as missing:
                    urlopen(base + "/v1/runs/missing")
                self.assertEqual(missing.exception.code, 404)
                missing.exception.close()
            finally:
                server.shutdown()
                server.server_close()
                thread.join(timeout=2)

    def test_artifact_head_ranges_and_streaming(self) -> None:
        with tempfile.TemporaryDirectory() as value:
            manager = FakeManager(Path(value))
            server = GatewayServer(("127.0.0.1", 0), manager)  # type: ignore[arg-type]
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            thread.start()
            url = (
                f"http://127.0.0.1:{server.server_address[1]}"
                "/v1/runs/abc123/artifacts/final.mp4"
            )
            payload = manager.ARTIFACT_BYTES
            try:
                head = Request(url, method="HEAD")
                with urlopen(head) as response:
                    self.assertEqual(response.status, 200)
                    self.assertEqual(response.headers["Accept-Ranges"], "bytes")
                    self.assertEqual(int(response.headers["Content-Length"]), len(payload))
                    self.assertEqual(response.read(), b"")

                ranged_head = Request(url, headers={"Range": "bytes=5-8"}, method="HEAD")
                with urlopen(ranged_head) as response:
                    self.assertEqual(response.status, 206)
                    self.assertEqual(response.headers["Content-Range"], f"bytes 5-8/{len(payload)}")
                    self.assertEqual(response.headers["Content-Length"], "4")
                    self.assertEqual(response.read(), b"")

                cases = [
                    ("bytes=10-19", payload[10:20], f"bytes 10-19/{len(payload)}"),
                    ("bytes=100-", payload[100:], f"bytes 100-{len(payload) - 1}/{len(payload)}"),
                    ("bytes=-7", payload[-7:], f"bytes {len(payload) - 7}-{len(payload) - 1}/{len(payload)}"),
                    (
                        f"bytes={len(payload) - 4}-{len(payload) + 100}",
                        payload[-4:],
                        f"bytes {len(payload) - 4}-{len(payload) - 1}/{len(payload)}",
                    ),
                ]
                for header, expected, content_range in cases:
                    with self.subTest(range=header):
                        request = Request(url, headers={"Range": header})
                        with urlopen(request) as response:
                            self.assertEqual(response.status, 206)
                            self.assertEqual(response.headers["Accept-Ranges"], "bytes")
                            self.assertEqual(response.headers["Content-Range"], content_range)
                            self.assertEqual(int(response.headers["Content-Length"]), len(expected))
                            self.assertEqual(response.read(), expected)

                for header in (f"bytes={len(payload)}-", "bytes=9-3", "bytes=0-1,4-5", "items=0-1"):
                    with self.subTest(unsatisfiable=header):
                        request = Request(url, headers={"Range": header})
                        with self.assertRaises(HTTPError) as invalid:
                            urlopen(request)
                        self.assertEqual(invalid.exception.code, 416)
                        self.assertEqual(
                            invalid.exception.headers["Content-Range"],
                            f"bytes */{len(payload)}",
                        )
                        self.assertEqual(invalid.exception.read(), b"")
                        invalid.exception.close()

                # A full artifact response must not fall back to Path.read_bytes(),
                # which would duplicate an entire generated video in memory.
                with patch.object(Path, "read_bytes", side_effect=AssertionError("not streaming")):
                    with urlopen(url) as response:
                        self.assertEqual(response.status, 200)
                        self.assertEqual(response.read(), payload)
            finally:
                server.shutdown()
                server.server_close()
                thread.join(timeout=2)

    def test_capabilities_are_authenticated_and_share_health_instance_id(self) -> None:
        capability_value = {
            "image_backend": "gpt-image-2",
            "configured_image_routes": {
                "portrait": "gpt-image-2",
                "anchor_image": "gpt-image-2",
                "image_edit": "gpt-image-2",
            },
            "resolved_image_backends": {
                "portrait": "gpt-image-2",
                "anchor_image": "gpt-image-2",
                "image_edit": "gpt-image-2",
            },
            "configuration_issues": [],
            "gpt_image_2": {
                "selected": True,
                "registered": True,
                "credentials_configured": True,
                "dependencies_ready": True,
                "runtime_ready": True,
                "network_checked": False,
            },
        }
        with tempfile.TemporaryDirectory() as value, patch.dict(
            os.environ,
            {"RECA_GATEWAY_TOKEN": "gateway-secret"},
        ), patch("gateway.server.gateway_capabilities", return_value=capability_value):
            manager = FakeManager(Path(value))
            server = GatewayServer(
                ("127.0.0.1", 0),
                manager,  # type: ignore[arg-type]
                gateway_instance_id="opaque-test-instance",
            )
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            thread.start()
            base = f"http://127.0.0.1:{server.server_address[1]}"
            try:
                with urlopen(base + "/health") as response:
                    health = json.loads(response.read())
                self.assertEqual(health["gateway_instance_id"], "opaque-test-instance")

                with self.assertRaises(HTTPError) as unauthorized:
                    urlopen(base + "/v1/capabilities")
                self.assertEqual(unauthorized.exception.code, 401)
                unauthorized.exception.close()

                request = Request(
                    base + "/v1/capabilities",
                    headers={"Authorization": "Bearer gateway-secret"},
                )
                with urlopen(request) as response:
                    capabilities = json.loads(response.read())
                self.assertEqual(capabilities["service"], "reca-gateway")
                self.assertEqual(
                    capabilities["gateway_instance_id"],
                    health["gateway_instance_id"],
                )
                self.assertEqual(capabilities["image_backend"], "gpt-image-2")
                self.assertEqual(
                    capabilities["resolved_image_backends"],
                    capability_value["resolved_image_backends"],
                )
                self.assertTrue(
                    capabilities["gpt_image_2"]["credentials_configured"]
                )
                self.assertTrue(capabilities["gpt_image_2"]["runtime_ready"])
                self.assertFalse(capabilities["gpt_image_2"]["network_checked"])

                head = Request(
                    base + "/v1/capabilities",
                    headers={"Authorization": "Bearer gateway-secret"},
                    method="HEAD",
                )
                with urlopen(head) as response:
                    self.assertEqual(response.status, 200)
                    self.assertEqual(response.read(), b"")
            finally:
                server.shutdown()
                server.server_close()
                thread.join(timeout=2)

    def test_gateway_instance_id_follows_store_across_path_changes(self) -> None:
        with tempfile.TemporaryDirectory() as value:
            root = Path(value)
            repository = root / "repo"
            repository.mkdir()
            runs_root = root / "runs"
            runs_root.mkdir()

            def identity_for(store: Path) -> str:
                manager = FakeManager(repository)
                manager.runs_root = store
                server = GatewayServer(  # type: ignore[arg-type]
                    ("127.0.0.1", 0),
                    manager,
                )
                try:
                    return server.gateway_instance_id
                finally:
                    server.server_close()

            first_id = identity_for(runs_root)
            self.assertEqual(first_id, identity_for(runs_root))
            self.assertRegex(first_id, r"^gw_[0-9a-f]{64}$")

            identity_file = runs_root / ".gateway-instance-id"
            self.assertEqual(identity_file.read_text(encoding="ascii"), first_id)
            self.assertEqual(stat.S_IMODE(identity_file.stat().st_mode), 0o600)

            moved_root = root / "moved-runs"
            runs_root.rename(moved_root)
            self.assertEqual(identity_for(moved_root), first_id)

            archived_root = root / "archived-runs"
            moved_root.rename(archived_root)
            moved_root.mkdir()
            replacement_id = identity_for(moved_root)
            self.assertNotEqual(replacement_id, first_id)

    def test_gateway_instance_id_rejects_corrupt_store_file(self) -> None:
        with tempfile.TemporaryDirectory() as value:
            root = Path(value)
            runs_root = root / "runs"
            runs_root.mkdir()
            identity_file = runs_root / ".gateway-instance-id"
            identity_file.write_text("not-an-instance-id", encoding="ascii")
            identity_file.chmod(0o600)
            manager = FakeManager(root)
            manager.runs_root = runs_root

            with self.assertRaisesRegex(RuntimeError, "RECA_GATEWAY_INSTANCE_ID"):
                GatewayServer(("127.0.0.1", 0), manager)  # type: ignore[arg-type]

            identity_file.write_text("gw_" + "0" * 64, encoding="ascii")
            identity_file.chmod(0o644)
            with self.assertRaisesRegex(RuntimeError, "permissions must be 0600"):
                GatewayServer(("127.0.0.1", 0), manager)  # type: ignore[arg-type]

    def test_gateway_instance_id_creation_is_concurrency_safe(self) -> None:
        with tempfile.TemporaryDirectory() as value:
            root = Path(value)
            runs_root = root / "runs"
            runs_root.mkdir()
            manager = FakeManager(root)
            manager.runs_root = runs_root
            barrier = threading.Barrier(12)
            identities: list[str] = []
            errors: list[BaseException] = []
            result_lock = threading.Lock()

            def create_identity() -> None:
                barrier.wait()
                try:
                    identity = _gateway_instance_id(manager)  # type: ignore[arg-type]
                except BaseException as exc:  # noqa: BLE001 - retain thread failures
                    with result_lock:
                        errors.append(exc)
                else:
                    with result_lock:
                        identities.append(identity)

            threads = [threading.Thread(target=create_identity) for _ in range(12)]
            for thread in threads:
                thread.start()
            for thread in threads:
                thread.join(timeout=5)

            self.assertFalse(errors)
            self.assertEqual(len(identities), 12)
            self.assertEqual(len(set(identities)), 1)
            self.assertEqual(
                list(runs_root.glob(".gateway-instance-id.*.tmp")),
                [],
            )

    def test_gateway_instance_id_ignores_stale_temp_and_cleans_failed_write(self) -> None:
        with tempfile.TemporaryDirectory() as value:
            root = Path(value)
            runs_root = root / "runs"
            runs_root.mkdir()
            manager = FakeManager(root)
            manager.runs_root = runs_root
            stale_temp = runs_root / ".gateway-instance-id.crashed.tmp"
            stale_temp.write_text("partial", encoding="ascii")
            stale_temp.chmod(0o600)

            identity = _gateway_instance_id(manager)  # type: ignore[arg-type]
            self.assertRegex(identity, r"^gw_[0-9a-f]{64}$")
            self.assertTrue(stale_temp.is_file())

            (runs_root / ".gateway-instance-id").unlink()
            with patch("gateway.server.os.write", side_effect=OSError("disk full")):
                with self.assertRaisesRegex(RuntimeError, "disk full"):
                    _gateway_instance_id(manager)  # type: ignore[arg-type]
            self.assertEqual(
                list(runs_root.glob(".gateway-instance-id.*.tmp")),
                [stale_temp],
            )

    def test_gateway_instance_env_override_has_highest_priority(self) -> None:
        with tempfile.TemporaryDirectory() as value:
            manager = FakeManager(Path(value))
            manager.runs_root = Path(value) / "missing-and-unwritable-store"
            with self.assertRaisesRegex(
                RuntimeError,
                "run store directory does not exist",
            ):
                _gateway_instance_id(manager)  # type: ignore[arg-type]

            with patch.dict(
                os.environ,
                {"RECA_GATEWAY_INSTANCE_ID": "configured-gateway"},
            ):
                server = GatewayServer(  # type: ignore[arg-type]
                    ("127.0.0.1", 0),
                    manager,
                    gateway_instance_id="constructor-fallback",
                )
                try:
                    self.assertEqual(
                        server.gateway_instance_id,
                        "configured-gateway",
                    )
                finally:
                    server.server_close()

    def test_gateway_token_json_guard_and_exact_cors_origin(self) -> None:
        with tempfile.TemporaryDirectory() as value, patch.dict(
            os.environ,
            {
                "RECA_GATEWAY_TOKEN": "gateway-secret",
                "RECA_GATEWAY_ALLOW_ORIGIN": "https://harness.example.test",
            },
        ):
            manager = FakeManager(Path(value))
            server = GatewayServer(("127.0.0.1", 0), manager)  # type: ignore[arg-type]
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            thread.start()
            base = f"http://127.0.0.1:{server.server_address[1]}"
            try:
                with urlopen(base + "/health") as response:
                    self.assertEqual(response.status, 200)

                with self.assertRaises(HTTPError) as unauthorized:
                    urlopen(base + "/v1/runs")
                self.assertEqual(unauthorized.exception.code, 401)
                unauthorized.exception.close()

                unauthorized_head = Request(base + "/v1/runs", method="HEAD")
                with self.assertRaises(HTTPError) as head_error:
                    urlopen(unauthorized_head)
                self.assertEqual(head_error.exception.code, 401)
                self.assertEqual(head_error.exception.read(), b"")
                head_error.exception.close()

                authorized = Request(
                    base + "/v1/runs",
                    headers={"Authorization": "Bearer gateway-secret"},
                )
                with urlopen(authorized) as response:
                    self.assertEqual(response.status, 200)

                unsafe_post = Request(
                    base + "/v1/runs",
                    data=b'{"story":"blocked simple request"}',
                    headers={
                        "Authorization": "Bearer gateway-secret",
                        "Content-Type": "text/plain",
                    },
                )
                with self.assertRaises(HTTPError) as unsupported:
                    urlopen(unsafe_post)
                self.assertEqual(unsupported.exception.code, 415)
                unsupported.exception.close()
                self.assertNotIn(("start", "blocked simple request"), manager.calls)

                preflight = Request(
                    base + "/v1/runs",
                    method="OPTIONS",
                    headers={
                        "Origin": "https://harness.example.test",
                        "Access-Control-Request-Method": "POST",
                    },
                )
                with urlopen(preflight) as response:
                    self.assertEqual(response.status, 204)
                    self.assertEqual(
                        response.headers["Access-Control-Allow-Origin"],
                        "https://harness.example.test",
                    )
                    self.assertIn("authorization", response.headers["Access-Control-Allow-Headers"])

                rejected = Request(
                    base + "/v1/runs",
                    method="OPTIONS",
                    headers={"Origin": "https://attacker.example.test"},
                )
                with self.assertRaises(HTTPError) as forbidden:
                    urlopen(rejected)
                self.assertEqual(forbidden.exception.code, 403)
                forbidden.exception.close()
            finally:
                server.shutdown()
                server.server_close()
                thread.join(timeout=2)


if __name__ == "__main__":
    unittest.main()
