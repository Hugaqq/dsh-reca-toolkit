import assert from "node:assert/strict";
import { createRequire } from "node:module";

import { RecaClient, RecaGatewayError } from "../src/client.js";

const require = createRequire(import.meta.url);
globalThis.RecaTraceAdapter = require("../src/client-ui/runtime/trace-adapter.cjs");

class MemoryStorage {
  constructor() {
    this.values = new Map();
  }

  get length() {
    return this.values.size;
  }

  key(index) {
    return [...this.values.keys()][index] ?? null;
  }

  getItem(key) {
    return this.values.has(key) ? this.values.get(key) : null;
  }

  setItem(key, value) {
    this.values.set(String(key), String(value));
  }

  removeItem(key) {
    this.values.delete(String(key));
  }

  clear() {
    this.values.clear();
  }
}

const scheduled = new Map();
let nextTimer = 1;
globalThis.sessionStorage = new MemoryStorage();
globalThis.window = {
  location: { search: "" },
  setTimeout(callback) {
    const id = nextTimer++;
    scheduled.set(id, callback);
    return id;
  },
  clearTimeout(id) {
    scheduled.delete(id);
  },
};

let capturedSubscribe;
globalThis.React = {
  useMemo(create) { return create(); },
  useCallback(callback) { return callback; },
  useSyncExternalStore(subscribe, getSnapshot) {
    capturedSubscribe = subscribe;
    return getSnapshot();
  },
};

const RecaTrace = require("../src/client-ui/runtime/trace-react.cjs");
const RUN_ID = "abc123def456";

function binding(overrides = {}) {
  return {
    gatewayInstance: "gw-old",
    sessionId: "session-a",
    runId: RUN_ID,
    source: { kind: "tool-result", seq: 8, tool: "reca_create_video" },
    debug: false,
    ...overrides,
  };
}

async function tick() {
  await new Promise((resolve) => setImmediate(resolve));
}

function testConversationBindingAndCacheNamespace() {
  const conversation = {
    nodes: [
      {
        kind: "tool-result",
        seq: 4,
        call: { name: "reca_create_video" },
        content: { run_id: "old123run456" },
      },
      {
        kind: "tool-result",
        seq: 9,
        call: { name: "reca_resume" },
        content: JSON.stringify({ run_id: RUN_ID }),
      },
      {
        kind: "tool-result",
        seq: 20,
        call: { name: "reca_list_runs" },
        content: { run_id: "ignored123456" },
      },
    ],
  };
  const detected = RecaTrace.latestRunBindingFromConversation(conversation, "session-a");
  assert.equal(detected.runId, RUN_ID);
  assert.equal(detected.sessionId, "session-a");
  assert.deepEqual(detected.source, { kind: "tool-result", seq: 9, tool: "reca_resume" });

  const interactive = RecaTrace.latestRunBindingFromConversation({
    nodes: [{
      kind: "tool-result",
      seq: 11,
      call: { name: "reca_create_video_interactive" },
      content: {
        run_id: "interactive123",
        state: "queued",
        interaction: { mode: "creative-brief", approved: true, brief_version: 1 },
      },
    }],
  }, "session-interactive");
  assert.equal(interactive.runId, "interactive123");
  assert.deepEqual(interactive.source, {
    kind: "tool-result",
    seq: 11,
    tool: "reca_create_video_interactive",
  });

  RecaTrace.rememberRunBinding(binding());
  RecaTrace.rememberRunBinding(binding({ gatewayInstance: "gw-other", sessionId: "session-b" }));
  assert.equal(sessionStorage.length, 2);
  const cachedA = RecaTrace.cachedRunBinding("session-a");
  const cachedB = RecaTrace.cachedRunBinding("session-b");
  assert.equal(cachedA.gatewayInstance, "gw-old");
  assert.equal(cachedB.gatewayInstance, "gw-other");
  assert.equal(cachedA.source.kind, "cache-window");

  const live = RecaTrace.useSessionRunBinding((select) => select(conversation), "session-a");
  assert.equal(live.source.kind, "tool-result", "cache is only a missing-window fallback");

  window.__RECA_RUN_ID__ = "debug123456";
  const debug = RecaTrace.useSessionRunBinding((select) => select(conversation), "session-a");
  assert.equal(debug.runId, "debug123456");
  assert.equal(debug.debug, true);
  assert.equal(debug.source.kind, "debug-override");
  delete window.__RECA_RUN_ID__;
}

async function testRunNotFoundStopsAndClearsEveryGatewayInstance() {
  sessionStorage.clear();
  scheduled.clear();
  RecaTrace.rememberRunBinding(binding({ gatewayInstance: "gw-old" }));
  RecaTrace.rememberRunBinding(binding({ gatewayInstance: "gw-new" }));
  assert.equal(sessionStorage.length, 2);

  const calls = [];
  const connection = {
    rpc: {
      async call(channel, endpoint, payload) {
        calls.push({ channel, endpoint, payload });
        return {
          ok: false,
          error: {
            code: "run-not-found",
            message: "run expired",
            details: {
              httpStatus: 410,
              upstreamCode: "run-gone",
              gateway_instance_id: "gw-new",
            },
          },
        };
      },
    },
  };
  const store = RecaTrace.createTraceStore(connection, binding(), 1600);
  const unsubscribe = store.subscribe(() => {});
  await tick();
  const view = store.getSnapshot();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].payload.sessionId, "session-a");
  assert.equal(calls[0].payload.source.seq, 8);
  assert.equal(calls[0].payload.source.tool, "reca_create_video");
  assert.equal(view.mode, "run-not-found");
  assert.equal(view.errorCode, "run-not-found");
  assert.equal(view.httpStatus, 410);
  assert.equal(view.upstreamCode, "run-gone");
  assert.equal(view.binding.gatewayInstance, "gw-new");
  assert.equal(sessionStorage.length, 0, "old and new Gateway cache keys must both be cleared");
  assert.equal(scheduled.size, 0, "run-not-found must not schedule another poll");
  unsubscribe();
}

async function testRetryableFailurePreservesStatusAndCode() {
  scheduled.clear();
  const connection = {
    rpc: {
      async call() {
        return {
          ok: false,
          error: {
            code: "gateway-error",
            message: "Gateway unavailable",
            details: { httpStatus: 503, upstreamCode: "overloaded" },
          },
        };
      },
    },
  };
  const store = RecaTrace.createTraceStore(connection, binding(), 1600);
  const unsubscribe = store.subscribe(() => {});
  await tick();
  const view = store.getSnapshot();
  assert.equal(view.mode, "error");
  assert.equal(view.errorCode, "gateway-error");
  assert.equal(view.httpStatus, 503);
  assert.equal(view.upstreamCode, "overloaded");
  assert.equal(scheduled.size, 1, "retryable Gateway failures should keep polling");
  unsubscribe();
  assert.equal(scheduled.size, 0);
}

function testInactiveAndHiddenHooksDoNotSubscribe() {
  const calls = [];
  const connection = { rpc: { call() { calls.push(true); return new Promise(() => {}); } } };

  RecaTrace.useTraceSnapshot({ connection, binding: binding(), active: false, visible: true });
  const inactiveSubscribe = capturedSubscribe;
  const stopInactive = inactiveSubscribe(() => {});
  assert.equal(calls.length, 0);
  stopInactive();

  RecaTrace.useTraceSnapshot({ connection, binding: binding(), active: true, visible: false });
  const hiddenSubscribe = capturedSubscribe;
  const stopHidden = hiddenSubscribe(() => {});
  assert.equal(calls.length, 0);
  stopHidden();

  const idle = RecaTrace.useTraceSnapshot({ connection, binding: null });
  assert.equal(idle.mode, "idle");
}

async function testClientCapabilitiesAndErrorMetadata() {
  const originalFetch = globalThis.fetch;
  const requests = [];
  try {
    globalThis.fetch = async (url, options) => {
      requests.push({ url, options });
      return Response.json({ gateway_instance_id: "gw-client" });
    };
    const client = new RecaClient("https://gateway.example.test/", "host-token");
    const capabilities = await client.capabilities({ headers: { accept: "application/json" } });
    assert.equal(capabilities.gateway_instance_id, "gw-client");
    assert.equal(requests[0].url, "https://gateway.example.test/v1/capabilities");
    assert.equal(requests[0].options.headers.authorization, "Bearer host-token");

    globalThis.fetch = async () => Response.json({
      error: { message: "run is gone", code: "run-gone" },
    }, { status: 410 });
    await assert.rejects(
      () => client.status(RUN_ID),
      (error) => {
        assert.equal(error instanceof RecaGatewayError, true);
        assert.equal(error.message, "run is gone");
        assert.equal(error.status, 410);
        assert.equal(error.httpStatus, 410);
        assert.equal(error.code, "run-gone");
        assert.equal(error.path, `/v1/runs/${RUN_ID}`);
        return true;
      },
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
}

testConversationBindingAndCacheNamespace();
await testRunNotFoundStopsAndClearsEveryGatewayInstance();
await testRetryableFailurePreservesStatusAndCode();
testInactiveAndHiddenHooksDoNotSubscribe();
await testClientCapabilitiesAndErrorMetadata();

console.log("ok - trace session binding, cache, polling, and client error contracts");
