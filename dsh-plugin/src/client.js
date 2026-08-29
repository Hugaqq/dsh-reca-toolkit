const DEFAULT_GATEWAY_URL = "http://127.0.0.1:8787";

export class RecaGatewayError extends Error {
  constructor(message, { status, code, path, payload } = {}) {
    super(message);
    this.name = "RecaGatewayError";
    this.status = status;
    this.httpStatus = status;
    this.code = code;
    this.path = path;
    this.payload = payload;
  }
}

export class RecaClient {
  constructor(
    baseUrl = process.env.RECA_GATEWAY_URL || DEFAULT_GATEWAY_URL,
    token = process.env.RECA_GATEWAY_TOKEN,
  ) {
    this.baseUrl = String(baseUrl).replace(/\/+$/, "");
    this.token = typeof token === "string" ? token.trim() : "";
  }

  rawFetch(path, options = {}) {
    return fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        ...(this.token ? { authorization: `Bearer ${this.token}` } : {}),
        ...(options.headers || {}),
      },
    });
  }

  async request(path, options = {}) {
    const response = await this.rawFetch(path, {
      ...options,
      headers: {
        "content-type": "application/json",
        ...(options.headers || {}),
      },
    });
    const text = await response.text();
    let payload;
    try {
      payload = text ? JSON.parse(text) : {};
    } catch {
      payload = { raw: text };
    }
    if (!response.ok) {
      const gatewayError = payload?.error;
      const message = typeof gatewayError === "string"
        ? gatewayError
        : gatewayError?.message || payload?.message || `Gateway returned HTTP ${response.status}`;
      const code = (typeof gatewayError === "object" && gatewayError
        ? gatewayError.code
        : undefined) || payload?.code;
      throw new RecaGatewayError(message, {
        status: response.status,
        code: typeof code === "string" && code ? code : undefined,
        path,
        payload,
      });
    }
    return payload;
  }

  capabilities(options = {}) {
    return this.request("/v1/capabilities", options);
  }

  start(input, options = {}) {
    return this.request("/v1/runs", {
      ...options,
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  createVideo(input, options = {}) {
    return this.start(input, options);
  }

  status(runId, options = {}) {
    return this.request(`/v1/runs/${encodeURIComponent(runId)}`, options);
  }

  events(runId, options = {}) {
    return this.request(`/v1/runs/${encodeURIComponent(runId)}/events`, options);
  }

  cancel(runId) {
    return this.request(`/v1/runs/${encodeURIComponent(runId)}/cancel`, {
      method: "POST",
      body: "{}",
    });
  }

  resume(runId) {
    return this.request(`/v1/runs/${encodeURIComponent(runId)}/resume`, {
      method: "POST",
      body: "{}",
    });
  }

  listRuns(options = {}) {
    return this.request("/v1/runs", options);
  }

  getArtifact(runId, relativePath = "") {
    return this.request(`/v1/runs/${encodeURIComponent(runId)}/artifacts`).then((manifest) => {
      if (!relativePath) return manifest;
      const wanted = relativePath.replace(/^\/+/, "");
      const item = (manifest.artifacts || []).find((entry) => entry.path === wanted);
      return item || { error: "artifact not found", path: wanted };
    });
  }

  artifactJson(runId, relativePath, options = {}) {
    const path = String(relativePath)
      .split("/")
      .filter(Boolean)
      .map(encodeURIComponent)
      .join("/");
    return this.request(`/v1/runs/${encodeURIComponent(runId)}/artifacts/${path}`, options);
  }
}
