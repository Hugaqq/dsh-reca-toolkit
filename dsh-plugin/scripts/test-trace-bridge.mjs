import assert from "node:assert/strict";
import { EventEmitter, once } from "node:events";
import { Writable } from "node:stream";

import { registerTraceBridge } from "../src/trace-bridge.js";

const RUN_ID = "abc123def456";
const GATEWAY_INSTANCE = "gateway-store-a";
const MEDIA_ROOT = `/reca-media/v1/runs/${RUN_ID}/artifacts`;

function snapshotPayload(overrides = {}) {
  return {
    gatewayInstance: null,
    sessionId: "session-a",
    runId: RUN_ID,
    source: { kind: "tool-result", seq: 17, tool: "reca_create_video" },
    debug: false,
    ...overrides,
  };
}

class CaptureResponse extends Writable {
  constructor() {
    super();
    this.statusCode = undefined;
    this.headers = {};
    this.headersSent = false;
    this.chunks = [];
    this.on("error", () => {});
  }

  writeHead(statusCode, headers = {}) {
    this.statusCode = statusCode;
    this.headers = headers;
    this.headersSent = true;
    return this;
  }

  _write(chunk, _encoding, callback) {
    this.chunks.push(Buffer.from(chunk));
    callback();
  }

  get body() {
    return Buffer.concat(this.chunks).toString();
  }
}

function createRequest({ method = "GET", path, headers = {} }) {
  return Object.assign(new EventEmitter(), {
    method,
    url: path,
    headers: { host: "127.0.0.1:3080", ...headers },
  });
}

function installBridge(client, options = {}, trustedHosts = []) {
  let mediaRoute;
  let rpcRegistration;
  const connectionCtx = {
    connection: {
      trustedHosts,
      rpc: {
        handle(channel, handler, registrationOptions) {
          rpcRegistration = { channel, handler, options: registrationOptions };
          return async () => {};
        },
      },
    },
    effect(create) {
      return create();
    },
    webServer: {
      register(route) {
        mediaRoute = route;
        return () => {};
      },
    },
  };
  const ctx = {
    inject(dependencies, callback) {
      assert.deepEqual(dependencies, ["connection", "webServer"]);
      callback(connectionCtx);
    },
  };
  registerTraceBridge(ctx, client, options);
  return { mediaRoute, rpcRegistration };
}

async function dispatch(route, requestOptions) {
  const req = createRequest(requestOptions);
  const res = new CaptureResponse();
  const finished = once(res, "finish");
  await route.handler(req, res);
  if (!res.writableFinished && !res.destroyed) await finished;
  return { req, res };
}

function json(value, init = {}) {
  return Response.json(value, init);
}

function fixtureClient(overrides = {}) {
  const calls = [];
  const manifest = {
    artifacts: [
      { path: "run/final.mp4", mime: "video/mp4", status: "ready" },
      { path: "run/contact.jpg", mime: "image/jpeg", status: "ready" },
      // A manifest entry is not enough: only displayable media MIME/path pairs pass.
      { path: "story.txt", mime: "text/plain", status: "ready" },
      { path: "state.json", mime: "application/json", status: "ready" },
    ],
  };
  const renderPlan = {
    portrait_plan: [{ image_request: { output_path: `/srv/.dsh_runs/${RUN_ID}/run/portraits/hero.png` } }],
    segments: {
      segment: { segment_request: { output_path: `run/segments/segment.mp4` } },
    },
  };
  const client = {
    calls,
    async capabilities() {
      return { gateway_instance_id: GATEWAY_INSTANCE };
    },
    async rawFetch(path, options = {}) {
      calls.push({ path, options });
      if (path === `/v1/runs/${RUN_ID}/artifacts`) return json(manifest);
      if (path === `/v1/runs/${RUN_ID}/artifacts/render_plan.json`) return json(renderPlan);
      return new Response(path.endsWith(".json") ? "{}" : "media", {
        status: 200,
        headers: {
          "accept-ranges": "bytes",
          "content-type": path.endsWith(".json") ? "application/json" : "application/octet-stream",
        },
      });
    },
    async status(runId) {
      return { run_id: runId, state: "running", artifact_manifest: manifest };
    },
    async events(runId) {
      return { run_id: runId, events: [] };
    },
    async artifactJson() {
      return {};
    },
    ...overrides,
  };
  return client;
}

async function testAuthorityContract() {
  const defaultBridge = installBridge(fixtureClient());
  assert.equal(defaultBridge.rpcRegistration.channel, "/reca-trace");
  assert.equal(defaultBridge.rpcRegistration.options.authority, "loopback");
  assert.equal(defaultBridge.mediaRoute.path, "/reca-media");

  const trustedClient = fixtureClient();
  const trustedBridge = installBridge(
    trustedClient,
    { traceAuthority: "trusted-host" },
    ["dsh.example.test"],
  );
  assert.equal(trustedBridge.rpcRegistration.options.authority, "trusted-host");

  const accepted = await dispatch(trustedBridge.mediaRoute, {
    path: `${MEDIA_ROOT}/request.json`,
    headers: { host: "dsh.example.test", origin: "http://dsh.example.test" },
  });
  assert.equal(accepted.res.statusCode, 200);

  const wrongHost = await dispatch(trustedBridge.mediaRoute, {
    path: `${MEDIA_ROOT}/request.json`,
    headers: { host: "rebound.example.test" },
  });
  assert.equal(wrongHost.res.statusCode, 403);

  const crossSite = await dispatch(trustedBridge.mediaRoute, {
    path: `${MEDIA_ROOT}/request.json`,
    headers: { host: "dsh.example.test", "sec-fetch-site": "cross-site" },
  });
  assert.equal(crossSite.res.statusCode, 403);

  assert.throws(
    () => installBridge(fixtureClient(), { traceAuthority: "public" }),
    /traceAuthority must be loopback or trusted-host/,
  );
}

async function testArtifactAllowlist() {
  const client = fixtureClient();
  const { mediaRoute } = installBridge(client);

  for (const blocked of ["story.txt", "state.json", "run_config.json", "run.log"]) {
    const before = client.calls.length;
    const { res } = await dispatch(mediaRoute, { path: `${MEDIA_ROOT}/${blocked}` });
    assert.equal(res.statusCode, 404, blocked);
    assert.equal(client.calls.length, before, `${blocked} must not reach Gateway`);
  }

  for (const malformed of ["%", "%E0%A4%A"]) {
    const before = client.calls.length;
    const { res } = await dispatch(mediaRoute, { path: `${MEDIA_ROOT}/${malformed}` });
    assert.equal(res.statusCode, 404, malformed);
    assert.equal(client.calls.length, before, `${malformed} must not reach Gateway`);
  }

  const final = await dispatch(mediaRoute, {
    path: `${MEDIA_ROOT}/run/final.mp4`,
    headers: { range: "bytes=5-9", "if-range": '"etag"' },
  });
  assert.equal(final.res.statusCode, 200);
  assert.equal(final.res.body, "media");
  const finalCall = client.calls.at(-1);
  assert.equal(finalCall.path, `/v1/runs/${RUN_ID}/artifacts/run/final.mp4`);
  assert.equal(finalCall.options.headers.range, "bytes=5-9");
  assert.equal(finalCall.options.headers["if-range"], '"etag"');

  const portrait = await dispatch(mediaRoute, {
    path: `${MEDIA_ROOT}/run/portraits/hero.png`,
  });
  assert.equal(portrait.res.statusCode, 200);

  const tail = await dispatch(mediaRoute, {
    path: `${MEDIA_ROOT}/run/segments/segment.tail.png`,
  });
  assert.equal(tail.res.statusCode, 200);

  const uiJson = await dispatch(mediaRoute, {
    path: `${MEDIA_ROOT}/run/audit.json`,
  });
  assert.equal(uiJson.res.statusCode, 200);
}

async function testGatewayFailureIs502() {
  const client = fixtureClient({
    async rawFetch() {
      throw new Error("connect ECONNREFUSED");
    },
  });
  const { mediaRoute } = installBridge(client);
  const { res } = await dispatch(mediaRoute, { path: `${MEDIA_ROOT}/request.json` });
  assert.equal(res.statusCode, 502);
  assert.equal(res.body, "ReCA Gateway media proxy failed");
}

async function testDownstreamCloseAbortsUpstream() {
  let started;
  const startedPromise = new Promise((resolve) => { started = resolve; });
  let upstreamSignal;
  const client = fixtureClient({
    rawFetch(_path, options) {
      upstreamSignal = options.signal;
      started();
      return new Promise((_resolve, reject) => {
        options.signal.addEventListener("abort", () => {
          reject(new DOMException("aborted", "AbortError"));
        }, { once: true });
      });
    },
  });
  const { mediaRoute } = installBridge(client);
  const req = createRequest({ path: `${MEDIA_ROOT}/request.json` });
  const res = new CaptureResponse();
  const pending = mediaRoute.handler(req, res);
  await startedPromise;
  res.emit("close");
  await pending;
  assert.equal(upstreamSignal.aborted, true);
  assert.equal(res.headersSent, false);
}

async function testSnapshotCachesStableArtifacts() {
  let state = "running";
  let auditState = "audit_running";
  let createdAt = 1;
  const artifactCalls = [];
  const client = fixtureClient({
    async status(runId) {
      return {
        run_id: runId,
        state,
        audit_state: auditState,
        created_at: createdAt,
        artifact_manifest: { artifacts: [] },
      };
    },
    async artifactJson(_runId, path) {
      artifactCalls.push(path);
      return { path, incarnation: createdAt };
    },
  });
  const { rpcRegistration } = installBridge(client);
  const signal = new AbortController().signal;

  assert.equal((await rpcRegistration.handler("snapshot", snapshotPayload(), signal)).ok, true);
  assert.deepEqual(artifactCalls, ["render_plan.json", "request.json"]);

  assert.equal((await rpcRegistration.handler("snapshot", snapshotPayload(), signal)).ok, true);
  assert.deepEqual(artifactCalls, ["render_plan.json", "request.json"]);

  state = "succeeded";
  auditState = "audit_skipped";
  assert.equal((await rpcRegistration.handler("snapshot", snapshotPayload(), signal)).ok, true);
  assert.deepEqual(artifactCalls, [
    "render_plan.json",
    "request.json",
    "run/audit.json",
    "run/run_report.json",
  ]);

  assert.equal((await rpcRegistration.handler("snapshot", snapshotPayload(), signal)).ok, true);
  assert.equal(artifactCalls.length, 4);

  state = "running";
  auditState = "audit_running";
  createdAt = 2;
  const resumed = await rpcRegistration.handler("snapshot", snapshotPayload(), signal);
  assert.equal(resumed.ok, true);
  assert.deepEqual(artifactCalls, [
    "render_plan.json",
    "request.json",
    "run/audit.json",
    "run/run_report.json",
    "render_plan.json",
    "request.json",
  ]);
  assert.equal(resumed.value.renderPlan.incarnation, 2);
  assert.equal(resumed.value.request.incarnation, 2);
  assert.equal(resumed.value.audit, undefined);
  assert.equal(resumed.value.runReport, undefined);
  assert.equal(resumed.value.gateway_instance_id, GATEWAY_INSTANCE);
  assert.deepEqual(resumed.value.binding.source, {
    kind: "tool-result",
    seq: 17,
    tool: "reca_create_video",
  });
}

async function testSnapshotBindingAndRunNotFound() {
  let statusCalls = 0;
  let capabilityCalls = 0;
  const artifactCalls = [];
  const client = fixtureClient({
    async capabilities() {
      capabilityCalls += 1;
      return { gateway_instance_id: GATEWAY_INSTANCE };
    },
    async status(runId) {
      statusCalls += 1;
      return { run_id: runId, state: "running", artifact_manifest: { artifacts: [] } };
    },
    async artifactJson(_runId, path) {
      artifactCalls.push(path);
      return { path };
    },
  });
  const { rpcRegistration } = installBridge(client);
  const signal = new AbortController().signal;

  const unbound = await rpcRegistration.handler("snapshot", { runId: RUN_ID }, signal);
  assert.equal(unbound.ok, false);
  assert.equal(unbound.error.code, "bad-request");
  assert.equal(statusCalls, 0);

  const conflictingIdentity = await rpcRegistration.handler("snapshot", snapshotPayload({
    gatewayInstance: "gateway-store-a",
    gateway_instance_id: "gateway-store-b",
  }), signal);
  assert.equal(conflictingIdentity.ok, false);
  assert.equal(conflictingIdentity.error.code, "bad-request");
  assert.equal(statusCalls, 0);

  const unsupportedSource = await rpcRegistration.handler("snapshot", snapshotPayload({
    source: { kind: "tool-result", seq: 18, tool: "reca_list_runs" },
  }), signal);
  assert.equal(unsupportedSource.ok, false);
  assert.equal(unsupportedSource.error.code, "bad-request");
  assert.equal(statusCalls, 0);

  const staleGateway = await rpcRegistration.handler(
    "snapshot",
    snapshotPayload({ gatewayInstance: "gateway-store-old" }),
    signal,
  );
  assert.equal(staleGateway.ok, false);
  assert.equal(staleGateway.error.code, "run-not-found");
  assert.equal(staleGateway.error.details.reason, "gateway-instance-changed");
  assert.equal(staleGateway.error.details.gateway_instance_id, GATEWAY_INSTANCE);
  assert.equal(statusCalls, 0);

  const first = await rpcRegistration.handler("snapshot", snapshotPayload(), signal);
  assert.equal(first.ok, true);
  assert.equal(capabilityCalls, 1, "capabilities should be cached across normal snapshots");

  await rpcRegistration.handler("snapshot", snapshotPayload({
    sessionId: "session-b",
    source: { kind: "tool-result", seq: 21, tool: "reca_resume" },
  }), signal);
  assert.equal(
    artifactCalls.filter((path) => path === "render_plan.json").length,
    2,
    "stable artifact cache must be isolated by session",
  );

  for (const httpStatus of [404, 410]) {
    let notFoundCapabilities = 0;
    const notFoundClient = fixtureClient({
      async capabilities() {
        notFoundCapabilities += 1;
        return { gateway_instance_id: GATEWAY_INSTANCE };
      },
      async status() {
        throw Object.assign(new Error(`missing ${httpStatus}`), {
          status: httpStatus,
          code: "gateway-run-missing",
        });
      },
    });
    const bridge = installBridge(notFoundClient);
    const missing = await bridge.rpcRegistration.handler("snapshot", snapshotPayload(), signal);
    assert.equal(missing.ok, false);
    assert.equal(missing.error.code, "run-not-found");
    assert.equal(missing.error.details.httpStatus, httpStatus);
    assert.equal(missing.error.details.upstreamCode, "gateway-run-missing");
    assert.equal(missing.error.details.gateway_instance_id, GATEWAY_INSTANCE);
    assert.equal(notFoundCapabilities, 2, "run-not-found should refresh Gateway identity");
  }

  const legacyIdentity = installBridge(fixtureClient({
    async capabilities() {
      return { instance_id: "legacy-field" };
    },
  }));
  const missingIdentity = await legacyIdentity.rpcRegistration.handler(
    "snapshot",
    snapshotPayload(),
    signal,
  );
  assert.equal(missingIdentity.ok, false);
  assert.equal(missingIdentity.error.code, "gateway-error");
}

async function testInteractiveToolBinding() {
  const client = fixtureClient();
  const { rpcRegistration } = installBridge(client);
  const result = await rpcRegistration.handler("snapshot", snapshotPayload({
    sessionId: "session-interactive",
    source: {
      kind: "tool-result",
      seq: 23,
      tool: "reca_create_video_interactive",
    },
  }), new AbortController().signal);
  assert.equal(result.ok, true);
  assert.deepEqual(result.value.binding.source, {
    kind: "tool-result",
    seq: 23,
    tool: "reca_create_video_interactive",
  });
}

await testAuthorityContract();
await testArtifactAllowlist();
await testGatewayFailureIs502();
await testDownstreamCloseAbortsUpstream();
await testSnapshotCachesStableArtifacts();
await testSnapshotBindingAndRunNotFound();
await testInteractiveToolBinding();

console.log("ok - trace bridge authority, binding, allowlist, abort, and snapshot cache contracts");
