import { defineTool } from "../define-tool.js";
import { renderJson } from "../renderers/json.js";

const IMAGE_KINDS = ["portrait", "anchor_image", "image_edit"];
const SAFE_DEPENDENCIES = ["httpx", "openai", "pydantic"];

function boundedText(value, maximum = 256) {
  const text = typeof value === "string" ? value.trim() : "";
  return text && text.length <= maximum && !/[\u0000-\u001f\u007f]/.test(text)
    ? text
    : undefined;
}

function imageRoutes(value) {
  const source = value && typeof value === "object" ? value : {};
  return Object.fromEntries(IMAGE_KINDS.map((kind) => [
    kind,
    boundedText(source[kind]) || "unknown",
  ]));
}

export function normalizeCapabilities(value) {
  const source = value && typeof value === "object" ? value : {};
  const gpt = source.gpt_image_2 && typeof source.gpt_image_2 === "object"
    ? source.gpt_image_2
    : {};
  const selectedKinds = Array.isArray(gpt.selected_kinds)
    ? gpt.selected_kinds.filter((kind) => IMAGE_KINDS.includes(kind))
    : [];
  const missingDependencies = Array.isArray(gpt.missing_dependencies)
    ? gpt.missing_dependencies.filter((name) => SAFE_DEPENDENCIES.includes(name))
    : [];
  const issues = Array.isArray(source.configuration_issues)
    ? source.configuration_issues
      .map((issue) => boundedText(issue, 512))
      .filter(Boolean)
      .slice(0, 16)
    : [];
  return {
    service: boundedText(source.service) || "reca-gateway",
    gateway_instance_id: boundedText(source.gateway_instance_id),
    image_backend: boundedText(source.image_backend) || "",
    configured_image_routes: imageRoutes(source.configured_image_routes),
    resolved_image_backends: imageRoutes(source.resolved_image_backends),
    configuration_issues: issues,
    gpt_image_2: {
      selected: gpt.selected === true,
      selected_kinds: selectedKinds,
      registered: gpt.registered === true,
      credentials_configured: gpt.credentials_configured === true,
      dependencies_ready: gpt.dependencies_ready === true,
      missing_dependencies: missingDependencies,
      runtime_ready: gpt.runtime_ready === true,
      network_checked: gpt.network_checked === true,
    },
  };
}

export function registerGetCapabilities(ctx, client) {
  return ctx.tools.register(defineTool({
    name: "reca_get_capabilities",
    description:
      "Inspect the connected ReCA Gateway's configured rendering capabilities. " +
      "Use this before claiming that an internal image backend such as GPT Image 2 is unavailable. " +
      "This is a read-only readiness check and never invokes a provider model.",
    parameters: {},
    output: {
      schema: { type: "object", additionalProperties: true },
      render: (_args, value) => renderJson(value),
    },
    async execute() {
      return normalizeCapabilities(await client.capabilities());
    },
  }));
}
