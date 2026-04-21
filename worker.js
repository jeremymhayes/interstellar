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
  "/e/": "https://raw.githubusercontent.com/qrs/x/fixy/",
};

const CACHE_CONTROL = "public, max-age=2592000";
const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "SAMEORIGIN",
};

function unauthorizedResponse() {
  return new Response("Authentication required", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Jeremy Hayes Nexus"',
    },
  });
}

function isAuthorized(request) {
  if (config.challenge !== true) {
    return true;
  }

  const auth = request.headers.get("Authorization");
  if (!auth?.startsWith("Basic ")) {
    return false;
  }

  const base64 = auth.slice("Basic ".length);
  const decoded = atob(base64);
  const separator = decoded.indexOf(":");

  if (separator === -1) {
    return false;
  }

  const username = decoded.slice(0, separator);
  const password = decoded.slice(separator + 1);

  return config.users[username] === password;
}

async function fetchRemoteAsset(request) {
  const { pathname } = new URL(request.url);

  for (const [prefix, baseUrl] of Object.entries(REMOTE_ASSET_BASE_URLS)) {
    if (!pathname.startsWith(prefix)) {
      continue;
    }

    const cache = caches.default;
    const cacheKey = new Request(request.url, request);
    const cached = await cache.match(cacheKey);

    if (cached) {
      return cached;
    }

    const remotePath = pathname.slice(prefix.length);
    const target = new URL(remotePath, baseUrl);
    const remoteResponse = await fetch(target.toString());

    if (!remoteResponse.ok) {
      return null;
    }

    const response = new Response(remoteResponse.body, remoteResponse);
    response.headers.set("Cache-Control", CACHE_CONTROL);
    response.headers.set("Access-Control-Allow-Origin", "*");

    await cache.put(cacheKey, response.clone());
    return response;
  }

  return null;
}

async function handleBareRequest(request) {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS",
        "Access-Control-Allow-Headers": "*",
      },
    });
  }

  const protocol = request.headers.get("x-bare-protocol") ?? "https:";
  const host = request.headers.get("x-bare-host");
  const path = request.headers.get("x-bare-path") ?? "/";
  const port = request.headers.get("x-bare-port");
  const rawHeaders = request.headers.get("x-bare-headers") ?? "{}";

  if (!host) {
    return new Response("Missing x-bare-host header", { status: 400 });
  }

  const target = new URL(`${protocol}//${host}${path}`);
  if (port && !target.port) {
    target.port = port;
  }

  let bareHeaders = {};
  try {
    bareHeaders = JSON.parse(rawHeaders);
  } catch {
    bareHeaders = {};
  }
  const outboundHeaders = new Headers();

  for (const [headerName, headerValue] of Object.entries(bareHeaders)) {
    const normalized = headerName.toLowerCase();
    if (
      normalized === "host" ||
      normalized === "origin" ||
      normalized === "referer" ||
      normalized.startsWith("cf-")
    ) {
      continue;
    }
    if (typeof headerValue === "string") {
      outboundHeaders.set(headerName, headerValue);
    }
  }

  const upstream = await fetch(target, {
    method: request.method,
    headers: outboundHeaders,
    body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
    redirect: "manual",
  });

  const responseHeaders = {};
  for (const [headerName, headerValue] of upstream.headers.entries()) {
    responseHeaders[headerName] = headerValue;
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "x-bare-status": String(upstream.status),
      "x-bare-status-text": upstream.statusText,
      "x-bare-headers": JSON.stringify(responseHeaders),
    },
  });
}

function withSecurityHeaders(response) {
  const secured = new Response(response.body, response);
  for (const [header, value] of Object.entries(SECURITY_HEADERS)) {
    secured.headers.set(header, value);
  }
  return secured;
}

export default {
  async fetch(request, env) {
    if (!isAuthorized(request)) {
      return unauthorizedResponse();
    }

    const url = new URL(request.url);

    if (url.pathname === "/ca/v1/" || url.pathname === "/ca/v1") {
      return handleBareRequest(request);
    }

    if (url.pathname === "/ca" || url.pathname === "/ca/") {
      return new Response("Bare endpoint is available at /ca/v1/", { status: 200 });
    }

    const remoteAssetResponse = await fetchRemoteAsset(request);
    if (remoteAssetResponse) {
      return remoteAssetResponse;
    }

    const mappedFile = ROUTES[url.pathname] ?? url.pathname.slice(1);

    if (mappedFile) {
      const assetResponse = await env.ASSETS.fetch(new Request(new URL(`/${mappedFile}`, request.url)));
      if (assetResponse.status !== 404) {
        return withSecurityHeaders(assetResponse);
      }
    }

    const fallbackResponse = await env.ASSETS.fetch(new Request(new URL("/404.html", request.url)));
    return withSecurityHeaders(fallbackResponse);
  },
};
