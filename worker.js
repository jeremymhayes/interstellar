import config from "./config.js";

const ROUTES = {
  "/": "index.html",
  "/a": "games.html",
  "/b": "apps.html",
  "/c": "settings.html",
  "/d": "tabs.html",
  "/play.html": "games.html",
};

const REMOTE_ASSET_BASE_URLS = {
  "/e/1/": "https://raw.githubusercontent.com/qrs/x/fixy/",
  "/e/2/": "https://raw.githubusercontent.com/3v1/V5-Assets/main/",
  "/e/3/": "https://raw.githubusercontent.com/3v1/V5-Retro/master/",
};

const CACHE_CONTROL = "public, max-age=2592000";
const BASIC_AUTH_PREFIX = "Basic ";
const TEXT_ENCODER = new TextEncoder();
const BARE_PREFIX = "/ca";
const BARE_V1_PATH = `${BARE_PREFIX}/v1/`;
const BARE_V3_PATH = `${BARE_PREFIX}/v3/`;
const BARE_CORS_HEADERS = {
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "*",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Expose-Headers": "*",
  "Access-Control-Max-Age": "7200",
  "X-Robots-Tag": "noindex",
};
const FORBIDDEN_BARE_REQUEST_HEADERS = new Set(["accept-encoding", "connection", "content-length", "host", "origin", "referer", "transfer-encoding"]);
const FORBIDDEN_BARE_RESPONSE_HEADERS = new Set(["access-control-allow-headers", "access-control-allow-methods", "access-control-allow-origin", "access-control-expose-headers", "access-control-max-age", "connection", "transfer-encoding", "vary"]);
const NULL_BODY_METHODS = new Set(["GET", "HEAD"]);
const NULL_BODY_STATUSES = new Set([101, 204, 205, 304]);

function unauthorizedResponse() {
  return new Response("Authentication required", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Interstellar"',
    },
  });
}

function decodeBasicAuth(authHeader) {
  if (!authHeader?.startsWith(BASIC_AUTH_PREFIX)) {
    return null;
  }

  try {
    const decoded = atob(authHeader.slice(BASIC_AUTH_PREFIX.length));
    const separator = decoded.indexOf(":");

    if (separator === -1) {
      return null;
    }

    return {
      username: decoded.slice(0, separator),
      password: decoded.slice(separator + 1),
    };
  } catch {
    return null;
  }
}

function constantTimeEqual(actual, expected) {
  const actualBytes = TEXT_ENCODER.encode(actual);
  const expectedBytes = TEXT_ENCODER.encode(expected);
  const length = Math.max(actualBytes.length, expectedBytes.length);
  let diff = actualBytes.length ^ expectedBytes.length;

  for (let index = 0; index < length; index += 1) {
    diff |= (actualBytes[index] ?? 0) ^ (expectedBytes[index] ?? 0);
  }

  return diff === 0;
}

function isAuthorized(request) {
  if (config.challenge !== true) {
    return true;
  }

  const credentials = decodeBasicAuth(request.headers.get("Authorization"));
  if (!credentials) {
    return false;
  }

  if (!Object.hasOwn(config.users, credentials.username)) {
    return false;
  }

  return constantTimeEqual(credentials.password, config.users[credentials.username]);
}

async function fetchRemoteAsset(request, ctx) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return null;
  }

  const { pathname } = new URL(request.url);

  for (const [prefix, baseUrl] of Object.entries(REMOTE_ASSET_BASE_URLS)) {
    if (!pathname.startsWith(prefix)) {
      continue;
    }

    const cache = caches.default;
    const cacheKey = new Request(new URL(pathname, request.url).toString(), { method: "GET" });
    const cached = request.method === "GET" ? await cache.match(cacheKey) : null;

    if (cached) {
      return cached;
    }

    const remotePath = pathname.slice(prefix.length).replace(/^\/+/, "");
    const remoteResponse = await fetch(`${baseUrl}${remotePath}`, { method: request.method });

    if (!remoteResponse.ok) {
      return null;
    }

    const response = new Response(request.method === "HEAD" ? null : remoteResponse.body, remoteResponse);
    response.headers.set("Cache-Control", CACHE_CONTROL);
    response.headers.set("Access-Control-Allow-Origin", "*");

    if (request.method === "GET") {
      ctx.waitUntil(cache.put(cacheKey, response.clone()));
    }

    return response;
  }

  return null;
}

function bareJson(status, payload) {
  return new Response(JSON.stringify(payload, null, "\t"), {
    status,
    headers: {
      ...BARE_CORS_HEADERS,
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

function bareManifest() {
  return bareJson(200, {
    language: "Cloudflare Workers",
    memoryUsage: 0,
    project: {
      description: "Worker-native Bare v1 fetch bridge",
      name: "interstellar-worker-bare",
      version: "1.0.0",
    },
    versions: ["v1", "v3"],
  });
}

function getBareHeaderValue(request, headerName) {
  const rawValue = request.headers.get(headerName);
  if (rawValue !== null) {
    return rawValue;
  }

  const chunks = [];
  const chunkPrefix = `${headerName}-`;

  for (const [name, value] of request.headers.entries()) {
    if (!name.startsWith(chunkPrefix)) {
      continue;
    }

    const chunkIndex = Number.parseInt(name.slice(chunkPrefix.length), 10);
    if (!Number.isNaN(chunkIndex) && value.startsWith(";")) {
      chunks[chunkIndex] = value.slice(1);
    }
  }

  return chunks.length ? chunks.join("") : null;
}

function parseBareJsonHeader(request, headerName, fallback) {
  const rawValue = getBareHeaderValue(request, headerName);
  if (rawValue === null) {
    if (fallback !== undefined) {
      return fallback;
    }

    throw new TypeError(`Missing ${headerName}`);
  }

  return JSON.parse(rawValue);
}

function getBareForwardHeaders(request) {
  const rawValue = request.headers.get("x-bare-forward-headers");
  if (rawValue === null) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawValue);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return rawValue
      .split(",")
      .map(value => value.trim())
      .filter(Boolean);
  }
}

function appendBareHeader(headers, name, value) {
  const lowerName = name.toLowerCase();
  if (FORBIDDEN_BARE_REQUEST_HEADERS.has(lowerName)) {
    return;
  }

  const values = Array.isArray(value) ? value : [value];
  for (const headerValue of values) {
    if (typeof headerValue !== "string") {
      continue;
    }

    try {
      headers.append(name, headerValue);
    } catch {
      // Some browser/client headers cannot be replayed by Workers fetch.
    }
  }
}

function getBareRequestHeaders(request) {
  const headers = new Headers();
  const bareHeaders = parseBareJsonHeader(request, "x-bare-headers", {});

  for (const [name, value] of Object.entries(bareHeaders)) {
    appendBareHeader(headers, name, value);
  }

  for (const name of getBareForwardHeaders(request)) {
    if (typeof name !== "string") {
      continue;
    }

    const value = request.headers.get(name);
    if (value !== null) {
      appendBareHeader(headers, name, value);
    }
  }

  return headers;
}

function getBareV1RemoteUrl(request) {
  const protocol = request.headers.get("x-bare-protocol");
  const host = request.headers.get("x-bare-host");
  const port = request.headers.get("x-bare-port");
  const path = request.headers.get("x-bare-path");

  if (!protocol || !host || !port || path === null) {
    throw new TypeError("Missing required Bare remote headers");
  }

  if (protocol !== "http:" && protocol !== "https:") {
    throw new TypeError(`Unsupported Bare protocol: ${protocol}`);
  }

  return new URL(`${protocol}//${host}:${port}${path}`);
}

function getBareV3RemoteUrl(request) {
  const bareUrl = request.headers.get("x-bare-url");
  if (!bareUrl) {
    throw new TypeError("Missing x-bare-url");
  }

  const url = new URL(bareUrl);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new TypeError(`Unsupported Bare protocol: ${url.protocol}`);
  }

  return url;
}

function getBareResponseHeaders(response) {
  const headers = {};

  for (const [name, value] of response.headers.entries()) {
    if (!FORBIDDEN_BARE_RESPONSE_HEADERS.has(name.toLowerCase())) {
      headers[name] = value;
    }
  }

  return headers;
}

async function fetchBareRemote(request, remoteUrl) {
  return fetch(remoteUrl, {
    body: NULL_BODY_METHODS.has(request.method.toUpperCase()) ? undefined : request.body,
    headers: getBareRequestHeaders(request),
    method: request.method,
    redirect: "manual",
  });
}

async function handleBareTunnel(request, getRemoteUrl) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: BARE_CORS_HEADERS });
  }

  let remoteResponse;
  try {
    remoteResponse = await fetchBareRemote(request, getRemoteUrl(request));
  } catch (error) {
    return bareJson(500, {
      code: "FETCH_FAILED",
      id: "request",
      message: error instanceof Error ? error.message : String(error),
    });
  }

  const responseHeaders = new Headers(BARE_CORS_HEADERS);
  responseHeaders.set("x-bare-headers", JSON.stringify(getBareResponseHeaders(remoteResponse)));
  responseHeaders.set("x-bare-status", remoteResponse.status.toString());
  responseHeaders.set("x-bare-status-text", remoteResponse.statusText);

  return new Response(NULL_BODY_STATUSES.has(remoteResponse.status) ? null : remoteResponse.body, {
    headers: responseHeaders,
    status: 200,
  });
}

function handleBareRequest(request, url) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: BARE_CORS_HEADERS });
  }

  if (url.pathname === BARE_PREFIX || url.pathname === `${BARE_PREFIX}/`) {
    return bareManifest();
  }

  if (url.pathname === BARE_V1_PATH) {
    return handleBareV1(request);
  }

  if (url.pathname === BARE_V3_PATH) {
    return handleBareV3(request);
  }

  return bareJson(404, {
    code: "NOT_FOUND",
    id: "bare.route",
    message: "Bare route not found.",
  });
}

function handleBareV1(request) {
  return handleBareTunnel(request, getBareV1RemoteUrl);
}

function handleBareV3(request) {
  return handleBareTunnel(request, getBareV3RemoteUrl);
}

async function notFoundResponse(env, request) {
  const response = await env.ASSETS.fetch(new Request(new URL("/404.html", request.url)));

  return new Response(response.body, {
    status: 404,
    headers: response.headers,
  });
}

export default {
  async fetch(request, env, ctx) {
    if (!isAuthorized(request)) {
      return unauthorizedResponse();
    }

    const url = new URL(request.url);

    if (url.pathname === BARE_PREFIX || url.pathname.startsWith(`${BARE_PREFIX}/`)) {
      return handleBareRequest(request, url);
    }

    const remoteAssetResponse = await fetchRemoteAsset(request, ctx);
    if (remoteAssetResponse) {
      return remoteAssetResponse;
    }

    const mappedFile = ROUTES[url.pathname] ?? url.pathname.slice(1);

    if (mappedFile) {
      const assetResponse = await env.ASSETS.fetch(new Request(new URL(`/${mappedFile}`, request.url)));
      if (assetResponse.status !== 404) {
        return assetResponse;
      }
    }

    return notFoundResponse(env, request);
  },
};
