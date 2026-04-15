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

function unauthorizedResponse() {
  return new Response("Authentication required", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Interstellar"',
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

export default {
  async fetch(request, env) {
    if (!isAuthorized(request)) {
      return unauthorizedResponse();
    }

    const url = new URL(request.url);

    if (url.pathname.startsWith("/ca/") || url.pathname === "/ca") {
      return new Response(
        "The /ca Bare server endpoint is not supported in the Cloudflare Workers runtime.",
        { status: 501 },
      );
    }

    const remoteAssetResponse = await fetchRemoteAsset(request);
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

    return env.ASSETS.fetch(new Request(new URL("/404.html", request.url)));
  },
};
