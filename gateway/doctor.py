"""Configuration and local runtime checks for ReCA Director."""
from __future__ import annotations

import importlib
import json
import os
import shutil
import sys
from collections.abc import Callable, Mapping
from functools import lru_cache
from pathlib import Path


GPT_IMAGE_2_BACKENDS = frozenset({"gpt-image-2", "gpt-image-2-pro"})
GPT_IMAGE_2_RUNTIME_MODULES = ("httpx", "openai", "pydantic")
IMAGE_ROUTE_ENV = {
    "portrait": "RECA_RENDER_BACKEND_PORTRAIT",
    "anchor_image": "RECA_RENDER_BACKEND_ANCHOR_IMAGE",
    "image_edit": "RECA_RENDER_BACKEND_IMAGE_EDIT",
}
REGISTRY_IMAGE_DEFAULTS = {
    "portrait": "wan2.7-image",
    "anchor_image": "wan2.7-image",
    "image_edit": "wan2.7-image",
}


def _dotenv_values(path: Path) -> dict[str, str]:
    """Read the simple dotenv format used by the Gateway worker bootstrap."""
    values: dict[str, str] = {}
    try:
        for raw_line in path.read_text(encoding="utf-8").splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            if key:
                values[key] = value
    except OSError:
        pass
    return values


def _dotenv_keys(path: Path) -> dict[str, bool]:
    """Read only presence of non-empty dotenv values; never expose values."""
    return {key: bool(value) for key, value in _dotenv_values(path).items()}


@lru_cache(maxsize=None)
def _module_available(name: str) -> bool:
    try:
        importlib.import_module(name)
        return True
    except Exception:  # noqa: BLE001 - a broken import is not runtime-ready
        return False


def _gpt_image_2_registered() -> bool:
    """Resolve the exact provider module without mutating process-wide streams."""
    try:
        # Import only this provider family. A missing dependency in an
        # unrelated video backend must not make GPT Image 2 look absent. Do
        # not redirect stdout/stderr here: Gateway requests run concurrently.
        importlib.import_module(
            "videorlm.backends.media.impl.openai.image.gpt_image_2"
        )
        from videorlm.backends.media.interface.registry import get_backend

        return get_backend("gpt-image-2") is not None
    except Exception:  # noqa: BLE001 - capability reporting must degrade safely
        return False


def _provider_openai_credentials_configured() -> bool:
    """Mirror the provider's extra dotenv search without exposing values."""
    try:
        from videorlm.backends._common.env import env_value

        singular = env_value("OPENAI_API_KEY").strip()
        pooled = env_value("OPENAI_API_KEYS")
        return bool(singular or any(item.strip() for item in pooled.split(",")))
    except Exception:  # noqa: BLE001 - readiness must degrade safely
        return False


def _dsh_check() -> dict[str, str]:
    """Accept both a PATH-installed CLI and the supported npm-exec workflow."""
    dsh_path = shutil.which("dsh")
    if dsh_path:
        return {"name": "dsh", "status": "ok", "detail": dsh_path}
    npm_path = shutil.which("npm")
    if npm_path:
        return {
            "name": "dsh",
            "status": "npm_exec",
            "detail": f"{npm_path} exec @deepseek-ai/dsh --",
        }
    return {"name": "dsh", "status": "missing", "detail": "dsh and npm not found"}


def gateway_capabilities(
    root: Path,
    *,
    environ: Mapping[str, str] | None = None,
    registered_probe: Callable[[], bool] | None = None,
    module_probe: Callable[[str], bool] | None = None,
    provider_credential_probe: Callable[[], bool] | None = None,
) -> dict[str, object]:
    """Return offline provider readiness without exposing or testing credentials.

    ReCA workers load the repository ``.env`` even when the long-lived Gateway
    was launched without exporting it. Mirror that behavior here, including the
    compatibility aliases applied by ``_smoke.load_env``. No provider request is
    made by this probe.
    """
    process_env = os.environ if environ is None else environ
    dotenv = _dotenv_values(root / ".env")

    def value(name: str) -> str:
        # ``load_env`` uses os.environ.setdefault: even an explicitly empty
        # process variable takes precedence over the repository dotenv value.
        if name in process_env:
            return str(process_env.get(name) or "").strip()
        return str(dotenv.get(name) or "").strip()

    def present(name: str) -> bool:
        return name in process_env or name in dotenv

    def csv_has_value(name: str) -> bool:
        return any(item.strip() for item in value(name).split(","))

    image_backend = (
        value("RECA_IMAGE_BACKEND")
        if present("RECA_IMAGE_BACKEND")
        else "gpt-image-2"
    )
    # Match _smoke.setup_render_defaults exactly: an explicit per-kind route
    # wins, otherwise RECA_IMAGE_BACKEND is installed with setdefault(). An
    # explicitly empty value survives setdefault, then registry.for_kind uses
    # its built-in backend because os.environ.get(...) is falsey.
    configured_image_routes = {
        kind: value(env_name) if present(env_name) else image_backend
        for kind, env_name in IMAGE_ROUTE_ENV.items()
    }
    resolved_image_backends = {
        kind: configured_image_routes[kind] or REGISTRY_IMAGE_DEFAULTS[kind]
        for kind in IMAGE_ROUTE_ENV
    }
    configuration_issues = []
    if present("RECA_IMAGE_BACKEND") and not image_backend:
        configuration_issues.append("RECA_IMAGE_BACKEND is explicitly empty")
    configuration_issues.extend(
        f"{env_name} is explicitly empty"
        for kind, env_name in IMAGE_ROUTE_ENV.items()
        if present(env_name) and not configured_image_routes[kind]
    )
    selected_kinds = sorted(
        kind
        for kind, backend in resolved_image_backends.items()
        if backend in GPT_IMAGE_2_BACKENDS
    )
    provider_credentials = bool(
        provider_credential_probe()
        if provider_credential_probe is not None
        else (_provider_openai_credentials_configured() if environ is None else False)
    )
    credentials_configured = bool(
        value("OPENAI_API_KEY")
        or csv_has_value("OPENAI_API_KEYS")
        or value("RECA_GPT_API_KEY")
        or value("DASHSCOPE_API_KEY")
        or provider_credentials
    )
    check_module = module_probe or _module_available
    missing_dependencies = [
        name for name in GPT_IMAGE_2_RUNTIME_MODULES if not check_module(name)
    ]
    dependencies_ready = not missing_dependencies
    registered = bool((registered_probe or _gpt_image_2_registered)())

    return {
        "image_backend": image_backend,
        "configured_image_routes": configured_image_routes,
        "resolved_image_backends": resolved_image_backends,
        "configuration_issues": configuration_issues,
        "gpt_image_2": {
            "selected": bool(selected_kinds),
            "selected_kinds": selected_kinds,
            "registered": registered,
            "credentials_configured": credentials_configured,
            "dependencies_ready": dependencies_ready,
            "missing_dependencies": missing_dependencies,
            "runtime_ready": registered and credentials_configured and dependencies_ready,
            "network_checked": False,
        },
    }


def main() -> int:
    root = Path(__file__).resolve().parents[1]
    checks: list[dict[str, str]] = []
    checks.append({"name": "python", "status": "ok", "detail": sys.version.split()[0]})
    checks.append({"name": "ffmpeg", "status": "ok" if shutil.which("ffmpeg") else "missing", "detail": shutil.which("ffmpeg") or "not found"})
    checks.append(_dsh_check())
    env_path = root / ".env"
    checks.append({"name": ".env", "status": "ok" if env_path.is_file() else "missing", "detail": str(env_path)})
    dotenv = _dotenv_keys(env_path)
    for key in ("RECA_PLANNER_API_KEY", "RECA_WAN30_API_KEY"):
        present = bool(os.environ.get(key)) or dotenv.get(key, False)
        checks.append({"name": key, "status": "set" if present else "not_set", "detail": "value hidden"})
    capabilities = gateway_capabilities(root)
    image_backend = str(capabilities["image_backend"])
    gpt_image_2 = capabilities["gpt_image_2"]
    assert isinstance(gpt_image_2, dict)
    configuration_issues = capabilities["configuration_issues"]
    assert isinstance(configuration_issues, list)
    checks.append({
        "name": "image_backend",
        "status": "invalid" if configuration_issues else "ok",
        "detail": image_backend or "explicitly empty; see configuration_issues",
    })
    checks.append({
        "name": "resolved_image_backends",
        "status": "ok",
        "detail": json.dumps(capabilities["resolved_image_backends"], sort_keys=True),
    })
    checks.append({
        "name": "configuration_issues",
        "status": "invalid" if configuration_issues else "ok",
        "detail": "; ".join(str(item) for item in configuration_issues) or "none",
    })
    checks.append({
        "name": "gpt-image-2.selected",
        "status": "selected" if gpt_image_2["selected"] else "not_selected",
        "detail": (
            ", ".join(gpt_image_2["selected_kinds"])
            if gpt_image_2["selected_kinds"]
            else "no image route currently selects GPT Image 2"
        ),
    })
    checks.append({
        "name": "gpt-image-2.registered",
        "status": "ok" if gpt_image_2["registered"] else "missing",
        "detail": "offline backend registry check",
    })
    checks.append({
        "name": "gpt-image-2.dependencies_ready",
        "status": "ok" if gpt_image_2["dependencies_ready"] else "missing",
        "detail": (
            "all local modules available"
            if gpt_image_2["dependencies_ready"]
            else "missing: " + ", ".join(gpt_image_2["missing_dependencies"])
        ),
    })
    checks.append({
        "name": "gpt-image-2.credentials_configured",
        "status": "set" if gpt_image_2["credentials_configured"] else "not_set",
        "detail": "credential value hidden",
    })
    checks.append({
        "name": "gpt-image-2.runtime_ready",
        "status": "ok" if gpt_image_2["runtime_ready"] else "not_ready",
        "detail": "offline check; provider network not contacted",
    })
    checks.append({
        "name": "gpt-image-2.network_checked",
        "status": "not_checked",
        "detail": "read-only doctor never calls the provider",
    })
    print(json.dumps({"checks": checks}, ensure_ascii=False, indent=2))
    return 0 if all(item["status"] not in {"missing", "invalid"} for item in checks) else 1


if __name__ == "__main__":
    raise SystemExit(main())
