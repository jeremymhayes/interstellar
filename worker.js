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

    if (url.pathname.startsWith("/ca/") || url.pathname === "/ca") {
      return new Response("The /ca Bare server endpoint is not supported in the Cloudflare Workers runtime.", {
        status: 501,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
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
