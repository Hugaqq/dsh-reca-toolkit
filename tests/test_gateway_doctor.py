from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from gateway.doctor import _dsh_check, gateway_capabilities


class GatewayCapabilitiesTests(unittest.TestCase):
    def capability_probe(
        self,
        root: Path,
        environ: dict[str, str],
        *,
        registered: bool = True,
        dependencies: bool = True,
        provider_credentials: bool = False,
    ) -> dict[str, object]:
        return gateway_capabilities(
            root,
            environ=environ,
            registered_probe=lambda: registered,
            module_probe=lambda _name: dependencies,
            provider_credential_probe=lambda: provider_credentials,
        )

    def test_default_backend_is_distinct_from_credential_readiness(self) -> None:
        with tempfile.TemporaryDirectory() as value:
            capabilities = self.capability_probe(Path(value), {})

        self.assertEqual(capabilities["image_backend"], "gpt-image-2")
        self.assertEqual(capabilities["resolved_image_backends"], {
            "portrait": "gpt-image-2",
            "anchor_image": "gpt-image-2",
            "image_edit": "gpt-image-2",
        })
        self.assertEqual(capabilities["configuration_issues"], [])
        gpt = capabilities["gpt_image_2"]
        self.assertIsInstance(gpt, dict)
        self.assertTrue(gpt["selected"])
        self.assertEqual(
            gpt["selected_kinds"],
            ["anchor_image", "image_edit", "portrait"],
        )
        self.assertTrue(gpt["registered"])
        self.assertFalse(gpt["credentials_configured"])
        self.assertTrue(gpt["dependencies_ready"])
        self.assertEqual(gpt["missing_dependencies"], [])
        self.assertFalse(gpt["runtime_ready"])
        self.assertFalse(gpt["network_checked"])

    def test_all_worker_credential_aliases_are_accepted_without_leaking_values(self) -> None:
        credential_cases = {
            "OPENAI_API_KEY": "secret-openai-single",
            "OPENAI_API_KEYS": " ,secret-openai-csv, ",
            "RECA_GPT_API_KEY": "secret-reca-gpt",
            "DASHSCOPE_API_KEY": "secret-dashscope-fallback",
        }
        with tempfile.TemporaryDirectory() as value:
            root = Path(value)
            for env_name, secret in credential_cases.items():
                with self.subTest(env_name=env_name):
                    capabilities = self.capability_probe(root, {env_name: secret})
                    gpt = capabilities["gpt_image_2"]
                    self.assertTrue(gpt["credentials_configured"])
                    self.assertTrue(gpt["runtime_ready"])
                    self.assertNotIn(secret, json.dumps(capabilities))

    def test_repository_dotenv_is_checked_and_process_backend_wins(self) -> None:
        with tempfile.TemporaryDirectory() as value:
            root = Path(value)
            (root / ".env").write_text(
                "RECA_IMAGE_BACKEND=gpt-image-2-pro\n"
                "RECA_GPT_API_KEY=dotenv-secret\n",
                encoding="utf-8",
            )
            capabilities = self.capability_probe(
                root,
                {"RECA_IMAGE_BACKEND": "qwen-image-2.0-pro"},
            )

        self.assertEqual(capabilities["image_backend"], "qwen-image-2.0-pro")
        gpt = capabilities["gpt_image_2"]
        self.assertFalse(gpt["selected"])
        self.assertTrue(gpt["credentials_configured"])
        self.assertTrue(gpt["runtime_ready"])
        self.assertNotIn("dotenv-secret", json.dumps(capabilities))

    def test_runtime_ready_requires_registration_and_local_dependencies(self) -> None:
        with tempfile.TemporaryDirectory() as value:
            root = Path(value)
            missing_registration = self.capability_probe(
                root,
                {"OPENAI_API_KEY": "secret"},
                registered=False,
            )["gpt_image_2"]
            missing_dependencies = self.capability_probe(
                root,
                {"OPENAI_API_KEY": "secret"},
                dependencies=False,
            )["gpt_image_2"]

        self.assertFalse(missing_registration["runtime_ready"])
        self.assertFalse(missing_dependencies["dependencies_ready"])
        self.assertEqual(
            missing_dependencies["missing_dependencies"],
            ["httpx", "openai", "pydantic"],
        )
        self.assertFalse(missing_dependencies["runtime_ready"])

    def test_provider_dotenv_credential_fallback_is_reflected(self) -> None:
        with tempfile.TemporaryDirectory() as value:
            capabilities = self.capability_probe(
                Path(value),
                {},
                provider_credentials=True,
            )

        self.assertTrue(capabilities["gpt_image_2"]["credentials_configured"])
        self.assertTrue(capabilities["gpt_image_2"]["runtime_ready"])

    def test_per_kind_routes_override_the_image_backend_like_worker_defaults(self) -> None:
        with tempfile.TemporaryDirectory() as value:
            capabilities = self.capability_probe(Path(value), {
                "RECA_IMAGE_BACKEND": "wan2.7-image-pro",
                "RECA_RENDER_BACKEND_PORTRAIT": "gpt-image-2",
                "RECA_RENDER_BACKEND_ANCHOR_IMAGE": "gpt-image-2-pro",
                "RECA_RENDER_BACKEND_IMAGE_EDIT": "qwen-image-2.0-pro",
            })

        self.assertEqual(capabilities["image_backend"], "wan2.7-image-pro")
        self.assertEqual(capabilities["resolved_image_backends"], {
            "portrait": "gpt-image-2",
            "anchor_image": "gpt-image-2-pro",
            "image_edit": "qwen-image-2.0-pro",
        })
        gpt = capabilities["gpt_image_2"]
        self.assertTrue(gpt["selected"])
        self.assertEqual(gpt["selected_kinds"], ["anchor_image", "portrait"])

    def test_explicitly_empty_process_credential_blocks_dotenv_value(self) -> None:
        with tempfile.TemporaryDirectory() as value:
            root = Path(value)
            (root / ".env").write_text(
                "OPENAI_API_KEY=dotenv-secret\n",
                encoding="utf-8",
            )
            capabilities = self.capability_probe(root, {"OPENAI_API_KEY": ""})

        gpt = capabilities["gpt_image_2"]
        self.assertFalse(gpt["credentials_configured"])
        self.assertFalse(gpt["runtime_ready"])

    def test_explicitly_empty_backend_routes_report_registry_fallbacks(self) -> None:
        with tempfile.TemporaryDirectory() as value:
            capabilities = self.capability_probe(Path(value), {
                "RECA_IMAGE_BACKEND": "",
                "RECA_RENDER_BACKEND_PORTRAIT": "",
            })

        self.assertEqual(capabilities["image_backend"], "")
        self.assertEqual(capabilities["configured_image_routes"], {
            "portrait": "",
            "anchor_image": "",
            "image_edit": "",
        })
        self.assertEqual(capabilities["resolved_image_backends"], {
            "portrait": "wan2.7-image",
            "anchor_image": "wan2.7-image",
            "image_edit": "wan2.7-image",
        })
        self.assertFalse(capabilities["gpt_image_2"]["selected"])
        self.assertIn(
            "RECA_IMAGE_BACKEND is explicitly empty",
            capabilities["configuration_issues"],
        )
        self.assertIn(
            "RECA_RENDER_BACKEND_PORTRAIT is explicitly empty",
            capabilities["configuration_issues"],
        )

    def test_dsh_check_accepts_the_npm_exec_workflow(self) -> None:
        paths = {"dsh": None, "npm": "/opt/homebrew/bin/npm"}
        with patch("gateway.doctor.shutil.which", side_effect=paths.get):
            check = _dsh_check()

        self.assertEqual(check, {
            "name": "dsh",
            "status": "npm_exec",
            "detail": "/opt/homebrew/bin/npm exec @deepseek-ai/dsh --",
        })


if __name__ == "__main__":
    unittest.main()
