import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

const TRACE_CHANNEL = "/reca-trace";
const MEDIA_PREFIX = "/reca-media";
const RUN_ID_RE = /^[A-Za-z0-9_-]{1,128}$/;
const TRACE_AUTHORITIES = new Set(["loopback", "trusted-host"]);
const UI_JSON_PATHS = new Set([
  "render_plan.json",
  "request.json",
  "run/audit.json",
  "run/run_report.json",
]);
const MEDIA_MIME_RE = /^(?:audio|image|video)\//i;
const MEDIA_PATH_RE = /\.(?:avif|gif|jpe?g|m4a|m4v|mov|mp3|mp4|ogg|opus|png|wav|webm|webp)$/i;
const TERMINAL_STATES = new Set(["succeeded", "failed", "cancelled", "interrupted"]);
const FINAL_AUDIT_STATES = new Set(["audited", "audit_repaired", "audit_failed", "audit_skipped"]);
const RUN_SOURCE_TOOLS = new Set([
  "reca_create_video",
  "reca_create_video_interactive",
  "reca_start",
  "reca_resume",
]);
const MAX_TRACE_CACHE_ENTRIES = 128;
const CAPABILITIES_CACHE_MS = 5000;

function rpcError(message, code = "internal", details = {}) {
  return {
    ok: false,
    error: {
      code,
      message,
      details: {
        ...(code === "bad-request" ? { issues: [] } : {}),
        ...details,
      },
    },
  };
}

function readRunId(payload) {
  const runId = typeof payload?.runId === "string" ? payload.runId.trim() : "";
  return RUN_ID_RE.test(runId) ? runId : undefined;
}

function boundedIdentifier(value, maximum = 256) {
  const text = typeof value === "string" ? value.trim() : "";
  return text && text.length <= maximum && !/[\u0000-\u001f\u007f]/.test(text)
    ? text
    : undefined;
}

function readTraceBinding(payload) {
  const runId = readRunId(payload);
  const sessionId = boundedIdentifier(payload?.sessionId);
  if (payload?.gatewayInstance != null && payload?.gateway_instance_id != null
      && payload.gatewayInstance !== payload.gateway_instance_id) {
    return undefined;
  }
  const suppliedGatewayInstance = payload?.gatewayInstance ?? payload?.gateway_instance_id;
  const gatewayInstance = boundedIdentifier(
    suppliedGatewayInstance,
  );
  const debug = payload?.debug === true;
  const source = payload?.source && typeof payload.source === "object" ? payload.source : {};
  const sourceKind = typeof source.kind === "string" ? source.kind : "";
  const sourceTool = typeof source.tool === "string" ? source.tool : "";
  const sourceSeq = Number(source.seq);

  if (!runId || !sessionId || (suppliedGatewayInstance != null && !gatewayInstance)) {
    return undefined;
  }
  if (debug) {
    if (sourceKind !== "debug-override") return undefined;
    return {
      gatewayInstance,
      sessionId,
      runId,
      source: { kind: sourceKind, seq: null, tool: "debug-override" },
      debug: true,
    };
  }
  if (!["tool-result", "cache-window"].includes(sourceKind)
      || !RUN_SOURCE_TOOLS.has(sourceTool)
      || !Object.prototype.hasOwnProperty.call(source, "seq")
      || !Number.isFinite(sourceSeq)
      || sourceSeq < 0) {
    return undefined;
  }
  return {
    gatewayInstance,
    sessionId,
    runId,
    source: { kind: sourceKind, seq: sourceSeq, tool: sourceTool },
    debug: false,
  };
}

function gatewayInstanceFromCapabilities(value) {
  return boundedIdentifier(value?.gateway_instance_id);
}

function upstreamErrorDetails(error) {
  const status = Number(error?.status);
  const upstreamCode = typeof error?.code === "string" && error.code ? error.code : undefined;
  return {
    ...(Number.isInteger(status) ? { httpStatus: status } : {}),
    ...(upstreamCode ? { upstreamCode } : {}),
  };
}

function isRunNotFoundError(error) {
  const status = Number(error?.status);
  return status === 404 || status === 410;
}

function cacheKey(gatewayInstance, binding) {
  return JSON.stringify([
    gatewayInstance,
    binding.sessionId,
    binding.runId,
    binding.source.seq,
    binding.source.tool,
  ]);
}

function runIncarnationChanged(previous, current) {
  if (!previous || !current) return false;
  if (previous.created_at != null && current.created_at != null) {
    return previous.created_at !== current.created_at;
  }
  return TERMINAL_STATES.has(String(previous.state || ""))
    && !TERMINAL_STATES.has(String(current.state || ""));
}

async function optionalJson(load) {
  try {
    return await load();
  } catch (error) {
    if (error?.status === 404) return undefined;
    throw error;
  }
}

function encodeArtifactPath(path) {
  return path.split("/").filter(Boolean).map(encodeURIComponent).join("/");
}

function normalizeAuthority(options) {
  const value = typeof options === "string"
    ? options
    : options?.traceAuthority ?? options?.authority ?? "loopback";
  if (!TRACE_AUTHORITIES.has(value)) {
    throw new Error("traceAuthority must be loopback or trusted-host");
  }
  return value;
}

function header(request, name) {
  const value = request?.headers?.[name];
  return typeof value === "string" ? value : undefined;
}

function parseAuthority(value) {
  try {
    return new URL(`http://${value}`);
  } catch {
    return undefined;
  }
}

function canonicalAuthority(value, parsed) {
  const port = parsed.port !== "" ? parsed.port : new URL(`https://${value}`).port;
  return port === "" ? parsed.hostname : `${parsed.hostname}:${port}`;
}

function isLoopbackHostname(hostname) {
  if (hostname === "localhost" || hostname === "[::1]") return true;
  const parts = hostname.split(".");
  return parts.length === 4
    && parts[0] === "127"
    && parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255);
}

function isTrustedAuthority(host, trustedHosts) {
  return trustedHosts.some((entry) => {
    if (typeof entry !== "string") return false;
    const parsed = parseAuthority(entry);
    if (!parsed) return false;
    return canonicalAuthority(entry, parsed) === parsed.hostname
      ? parsed.hostname === host.hostname
      : parsed.host === host.host;
  });
}

// Mirrors the rc.7 Connection Host/Origin/Sec-Fetch trust fence for the raw
// media route. RPC already applies this policy inside connection.rpc.handle().
function isTrustedMediaRequest(request, authority, trustedHosts) {
  const hostValue = header(request, "host");
  if (!hostValue) return false;
  const host = parseAuthority(hostValue);
  if (!host) return false;
  if (!isLoopbackHostname(host.hostname)) {
    if (authority !== "trusted-host" || !isTrustedAuthority(host, trustedHosts)) return false;
  }
  if (header(request, "sec-fetch-site") === "cross-site") return false;
  const origin = header(request, "origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === host.host;
  } catch {
    return false;
  }
}

function normalizeRelativePath(value) {
  const parts = String(value || "").replace(/\\/g, "/").split("/").filter(Boolean);
  if (parts.length === 0 || parts.some((part) => part === "." || part === "..")) return undefined;
  return parts.join("/");
}

function artifactPathFromReference(value, runId) {
  let source = typeof value === "string" ? value.trim() : "";
  if (!source) return undefined;
  source = source.replace(/\\/g, "/");

  if (/^https?:\/\//i.test(source)) {
    try {
      const parsed = new URL(source);
      const marker = `/v1/runs/${encodeURIComponent(runId)}/artifacts/`;
      const markerAt = parsed.pathname.indexOf(marker);
      if (markerAt < 0) return undefined;
      source = decodeURIComponent(parsed.pathname.slice(markerAt + marker.length));
    } catch {
      return undefined;
    }
  } else {
    const runMarker = `/.dsh_runs/${runId}/`;
    const runAt = source.lastIndexOf(runMarker);
    if (runAt >= 0) source = source.slice(runAt + runMarker.length);
    else if (source.startsWith("/")) {
      const publicRunAt = source.lastIndexOf("/run/");
      if (publicRunAt < 0) return undefined;
      source = source.slice(publicRunAt + 1);
    } else {
      source = source.replace(/^\.\//, "");
    }
  }
  return normalizeRelativePath(source);
}

function manifestMediaPaths(manifest, runId) {
  const result = new Set();
  for (const item of Array.isArray(manifest?.artifacts) ? manifest.artifacts : []) {
    if (!item || typeof item !== "object" || item.status !== "ready") continue;
    if (!MEDIA_MIME_RE.test(String(item.mime || ""))) continue;
    const path = artifactPathFromReference(item.path || item.url, runId);
    if (path && MEDIA_PATH_RE.test(path)) result.add(path);
  }
  return result;
}

function renderPlanMediaPaths(renderPlan, runId) {
  const result = new Set();
  const visit = (value) => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (!value || typeof value !== "object") return;
    for (const [key, candidate] of Object.entries(value)) {
      if (key === "output_path" && typeof candidate === "string") {
        const path = artifactPathFromReference(candidate, runId);
        if (path && MEDIA_PATH_RE.test(path)) {
          result.add(path);
          if (path.endsWith(".mp4")) result.add(`${path.slice(0, -4)}.tail.png`);
        }
      } else if (candidate && typeof candidate === "object") {
        visit(candidate);
      }
    }
  };
  visit(renderPlan);
  return result;
}

async function fetchJson(client, path, signal) {
  const response = await client.rawFetch(path, {
    method: "GET",
    headers: { accept: "application/json" },
    cache: "no-store",
    signal,
  });
  if (response.status === 404) return undefined;
  if (!response.ok) throw new Error(`Gateway returned HTTP ${response.status}`);
  return response.json();
}

async function isDisplayableArtifact(client, runId, path, signal) {
  if (UI_JSON_PATHS.has(path)) return true;
  if (!MEDIA_PATH_RE.test(path)) return false;

  const prefix = `/v1/runs/${encodeURIComponent(runId)}/artifacts`;
  const manifest = await fetchJson(client, prefix, signal);
  if (manifestMediaPaths(manifest, runId).has(path)) return true;

  const renderPlan = await fetchJson(client, `${prefix}/render_plan.json`, signal);
  return renderPlanMediaPaths(renderPlan, runId).has(path);
}

function parseMediaTarget(rawUrl) {
  try {
    const pathname = new URL(rawUrl || "/", "http://dsh.local").pathname;
    const prefix = `${MEDIA_PREFIX}/v1/runs/`;
    if (!pathname.startsWith(prefix)) return undefined;
    const tail = pathname.slice(prefix.length);
    const marker = "/artifacts/";
    const markerAt = tail.indexOf(marker);
    if (markerAt <= 0) return undefined;
    const runId = decodeURIComponent(tail.slice(0, markerAt));
    const path = tail.slice(markerAt + marker.length)
      .split("/")
      .map((part) => decodeURIComponent(part));
    if (!RUN_ID_RE.test(runId) || path.length === 0 || path.some((part) => !part || part === "." || part === "..")) {
      return undefined;
    }
    return { runId, path: path.join("/") };
  } catch {
    return undefined;
  }
}

function registerMediaProxy(ctx, client, authority, trustedHosts) {
  ctx.effect(() => ctx.webServer.register({
    kind: "prefix",
    path: MEDIA_PREFIX,
    handler: async (req, res) => {
      if (!isTrustedMediaRequest(req, authority, trustedHosts)) {
        res.writeHead(403);
        res.end("forbidden");
        return;
      }
      if (req.method !== "GET" && req.method !== "HEAD") {
        res.writeHead(405, { allow: "GET, HEAD" });
        res.end();
        return;
      }
      const target = parseMediaTarget(req.url);
      if (!target) {
        res.writeHead(404);
        res.end();
        return;
      }

      const controller = new AbortController();
      const abort = () => {
        if (!res.writableEnded) controller.abort();
      };
      req.once?.("aborted", abort);
      res.once?.("close", abort);
      try {
        const allowed = await isDisplayableArtifact(
          client,
          target.runId,
          target.path,
          controller.signal,
        );
        if (!allowed) {
          res.writeHead(404);
          res.end();
          return;
        }

        const upstreamPath = `/v1/runs/${encodeURIComponent(target.runId)}/artifacts/${encodeArtifactPath(target.path)}`;
        const headers = {};
        for (const name of ["if-modified-since", "if-none-match", "if-range", "range"]) {
          const value = header(req, name);
          if (value) headers[name] = value;
        }
        const upstream = await client.rawFetch(upstreamPath, {
          method: req.method,
          headers,
          signal: controller.signal,
        });
        const responseHeaders = {};
        for (const name of ["accept-ranges", "cache-control", "content-length", "content-range", "content-type", "etag", "last-modified"]) {
          const value = upstream.headers.get(name);
          if (value) responseHeaders[name] = value;
        }
        res.writeHead(upstream.status, responseHeaders);
        if (req.method === "HEAD" || !upstream.body) {
          res.end();
          return;
        }
        await pipeline(Readable.fromWeb(upstream.body), res, { signal: controller.signal });
      } catch (error) {
        if (controller.signal.aborted) return;
        if (!res.headersSent) {
          res.writeHead(502, { "content-type": "text/plain; charset=utf-8" });
          res.end("ReCA Gateway media proxy failed");
          return;
        }
        res.destroy(error instanceof Error ? error : new Error(String(error)));
      } finally {
        req.off?.("aborted", abort);
        res.off?.("close", abort);
      }
    },
  }), "dsh-reca-toolkit: media proxy");
}

/**
 * Register one Host-owned RPC channel for every ReCA UI surface.
 *
 * Browser plugins never see RECA_GATEWAY_URL. The Host may reach a co-located
 * Gateway, a remote HTTPS endpoint, or a local SSH tunnel with the same client
 * contract. Polling is plain HTTP/RPC and never enters the Agent or LLM loop.
 */
export function registerTraceBridge(ctx, client, options = {}) {
  if (typeof ctx?.inject !== "function") return;
  const authority = normalizeAuthority(options);
  const snapshotCache = new Map();
  let capabilityCache;

  const gatewayInstance = async (signal, { force = false } = {}) => {
    const now = Date.now();
    if (!force && capabilityCache && now - capabilityCache.loadedAt < CAPABILITIES_CACHE_MS) {
      return capabilityCache.gatewayInstance;
    }
    if (typeof client.capabilities !== "function") {
      throw new Error("ReCA client does not expose capabilities()");
    }
    const capabilities = await client.capabilities({ cache: "no-store", signal });
    const value = gatewayInstanceFromCapabilities(capabilities);
    if (!value) throw new Error("ReCA Gateway capabilities omitted gateway_instance_id");
    capabilityCache = { gatewayInstance: value, loadedAt: Date.now() };
    return value;
  };

  const clearSnapshots = (binding, gatewayInstances = []) => {
    const identities = new Set(gatewayInstances.filter(Boolean));
    for (const [key, cached] of snapshotCache) {
      if (cached.binding?.sessionId !== binding.sessionId
          || cached.binding?.runId !== binding.runId) continue;
      if (identities.size > 0 && !identities.has(cached.gatewayInstance)) continue;
      snapshotCache.delete(key);
    }
  };

  const rememberSnapshot = (gatewayId, binding, value) => {
    const key = cacheKey(gatewayId, binding);
    snapshotCache.delete(key);
    snapshotCache.set(key, { ...value, gatewayInstance: gatewayId, binding });
    while (snapshotCache.size > MAX_TRACE_CACHE_ENTRIES) {
      snapshotCache.delete(snapshotCache.keys().next().value);
    }
  };

  ctx.inject(["connection", "webServer"], (connectionCtx) => {
    const configuredHosts = Array.isArray(options?.trustedHosts) ? options.trustedHosts : undefined;
    const connectionHosts = Array.isArray(connectionCtx.connection?.trustedHosts)
      ? connectionCtx.connection.trustedHosts
      : [];
    const trustedHosts = configuredHosts || connectionHosts;
    registerMediaProxy(connectionCtx, client, authority, trustedHosts);
    connectionCtx.connection.rpc.handle(
      TRACE_CHANNEL,
      async (endpoint, payload, signal) => {
        if (endpoint !== "snapshot") {
          return rpcError(`unknown ReCA trace endpoint: ${endpoint}`, "bad-request");
        }

        const binding = readTraceBinding(payload);
        if (!binding) {
          return rpcError(
            "snapshot requires a session-bound runId and source seq/tool, or an explicit debug override",
            "bad-request",
          );
        }

        let gatewayId;
        try {
          gatewayId = await gatewayInstance(signal);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          return rpcError(
            `ReCA Gateway capabilities failed: ${message}`,
            "gateway-error",
            upstreamErrorDetails(error),
          );
        }

        if (binding.gatewayInstance && binding.gatewayInstance !== gatewayId) {
          clearSnapshots(binding);
          return rpcError(
            "ReCA Gateway instance changed; the cached run binding is no longer valid",
            "run-not-found",
            {
              reason: "gateway-instance-changed",
              gatewayInstance: gatewayId,
              gateway_instance_id: gatewayId,
            },
          );
        }

        const runId = binding.runId;
        const effectiveBinding = { ...binding, gatewayInstance: gatewayId };
        const snapshotKey = cacheKey(gatewayId, effectiveBinding);

        try {
          const [status, eventPayload] = await Promise.all([
            client.status(runId, { cache: "no-store", signal }),
            client.events(runId, { cache: "no-store", signal }),
          ]);
          if (status?.run_id != null && String(status.run_id) !== runId) {
            throw Object.assign(new Error("Gateway status returned a different run_id"), {
              code: "gateway-contract",
            });
          }
          if (eventPayload?.run_id != null && String(eventPayload.run_id) !== runId) {
            throw Object.assign(new Error("Gateway events returned a different run_id"), {
              code: "gateway-contract",
            });
          }

          let cached = snapshotCache.get(snapshotKey) || {};
          if (runIncarnationChanged(cached.status, status)) {
            snapshotCache.delete(snapshotKey);
            cached = {};
          }
          const terminal = TERMINAL_STATES.has(String(status?.state || ""));
          const auditFinal = terminal || FINAL_AUDIT_STATES.has(String(status?.audit_state || ""));
          const [loadedRenderPlan, loadedRequest, loadedAudit, loadedRunReport] = await Promise.all([
            cached.renderPlan !== undefined
              ? cached.renderPlan
              : optionalJson(() => client.artifactJson(runId, "render_plan.json", { cache: "no-store", signal })),
            cached.request !== undefined
              ? cached.request
              : optionalJson(() => client.artifactJson(runId, "request.json", { cache: "no-store", signal })),
            auditFinal
              ? (cached.audit !== undefined
                ? cached.audit
                : optionalJson(() => client.artifactJson(runId, "run/audit.json", { cache: "no-store", signal })))
              : undefined,
            terminal
              ? (cached.runReport !== undefined
                ? cached.runReport
                : optionalJson(() => client.artifactJson(runId, "run/run_report.json", { cache: "no-store", signal })))
              : undefined,
          ]);
          const renderPlan = loadedRenderPlan ?? cached.renderPlan;
          const request = loadedRequest ?? cached.request;
          const audit = auditFinal ? (loadedAudit ?? cached.audit) : undefined;
          const runReport = terminal ? (loadedRunReport ?? cached.runReport) : undefined;
          rememberSnapshot(gatewayId, effectiveBinding, {
            status,
            renderPlan,
            request,
            audit,
            runReport,
          });
          return {
            ok: true,
            value: {
              gatewayInstance: gatewayId,
              gateway_instance_id: gatewayId,
              binding: effectiveBinding,
              runId,
              status,
              events: Array.isArray(eventPayload?.events) ? eventPayload.events : [],
              artifacts: status?.artifact_manifest || {},
              renderPlan,
              audit,
              request,
              runReport,
              gatewayBaseUrl: MEDIA_PREFIX,
              fetchedAt: Date.now(),
            },
          };
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          if (isRunNotFoundError(error)) {
            let currentGatewayId = gatewayId;
            try {
              currentGatewayId = await gatewayInstance(signal, { force: true });
            } catch {
              // Preserve the run lookup failure and the last verified identity.
            }
            clearSnapshots(binding);
            return rpcError(
              `ReCA Gateway run was not found: ${message}`,
              "run-not-found",
              {
                ...upstreamErrorDetails(error),
                gatewayInstance: currentGatewayId,
                gateway_instance_id: currentGatewayId,
              },
            );
          }
          return rpcError(
            `ReCA Gateway snapshot failed: ${message}`,
            "gateway-error",
            {
              ...upstreamErrorDetails(error),
              gatewayInstance: gatewayId,
              gateway_instance_id: gatewayId,
            },
          );
        }
      },
      { authority },
    );
  });
}

export { MEDIA_PREFIX, TRACE_CHANNEL };
