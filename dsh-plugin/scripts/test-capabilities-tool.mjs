import assert from "node:assert/strict";

import { apply } from "../src/index.js";
import { registerGetCapabilities } from "../src/tools/get-capabilities.js";

let registered;
let calls = 0;
const dispose = () => {};
const ctx = {
  tools: {
    register(spec) {
      registered = spec;
      return dispose;
    },
  },
};
const client = {
  async capabilities() {
    calls += 1;
    return {
      gateway_instance_id: "gateway-test",
      image_backend: "gpt-image-2",
      configured_image_routes: {
        portrait: "gpt-image-2",
        anchor_image: "gpt-image-2",
        image_edit: "gpt-image-2",
      },
      resolved_image_backends: {
        portrait: "gpt-image-2",
        anchor_image: "gpt-image-2",
        image_edit: "gpt-image-2",
      },
      configuration_issues: [],
      gpt_image_2: {
        selected: true,
        selected_kinds: ["anchor_image", "image_edit", "portrait"],
        registered: true,
        credentials_configured: true,
        dependencies_ready: true,
        missing_dependencies: [],
        runtime_ready: true,
        network_checked: false,
      },
      accidental_secret: "must-not-reach-model-context",
    };
  },
};

assert.equal(registerGetCapabilities(ctx, client), dispose);
assert.equal(registered.name, "reca_get_capabilities");
assert.deepEqual(registered.parameters, {
  type: "object",
  additionalProperties: false,
  properties: {},
});
assert.match(registered.description, /read-only readiness check/i);
const value = await registered.execute({});
assert.equal(calls, 1);
assert.equal(value.image_backend, "gpt-image-2");
assert.equal(value.resolved_image_backends.anchor_image, "gpt-image-2");
assert.equal(value.gpt_image_2.runtime_ready, true);
assert.equal(value.gpt_image_2.network_checked, false);
assert.equal("accidental_secret" in value, false);
assert.doesNotMatch(JSON.stringify(value), /must-not-reach-model-context/);

const hostTools = [];
const hostSkills = [];
let disposed = 0;
const disposeHost = await apply({
  tools: {
    register(spec) {
      hostTools.push(spec);
      return () => { disposed += 1; };
    },
  },
  skills: {
    register(spec) {
      hostSkills.push(spec);
      return () => { disposed += 1; };
    },
  },
}, { gatewayUrl: "https://gateway.example.test" });
assert.equal(hostTools.length, 9);
assert.ok(hostTools.some((spec) => spec.name === "reca_get_capabilities"));
assert.equal(hostSkills.length, 1);
assert.match(hostSkills[0].whenToUse, /backend readiness/);
disposeHost();
assert.equal(disposed, 10);

console.log("ok - capability tool forwards Gateway readiness and is registered by the Host plugin");
