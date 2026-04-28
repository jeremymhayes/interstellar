import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createBareServer } from "@nebula-services/bare-server-node";
import chalk from "chalk";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import basicAuth from "express-basic-auth";
import mime from "mime";
import fetch from "node-fetch";
// import { setupMasqr } from "./Masqr.js";
import config from "./config.js";

console.log(chalk.yellow("🚀 Starting server..."));

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const server = http.createServer();
const app = express();
const bareServer = createBareServer("/ca/");
const requestedPort = Number.parseInt(process.env.PORT ?? "8080", 10);
const PORT = Number.isNaN(requestedPort) ? 8080 : requestedPort;
const cache = new Map();
const CACHE_TTL = 30 * 24 * 60 * 60 * 1000; // Cache for 30 Days
const MAX_CACHE_ENTRIES = 250;
const REMOTE_ASSET_BASE_URLS = {
  "/e/1/": "https://raw.githubusercontent.com/qrs/x/fixy/",
  "/e/2/": "https://raw.githubusercontent.com/3v1/V5-Assets/main/",
  "/e/3/": "https://raw.githubusercontent.com/3v1/V5-Retro/master/",
};

function isIgnorableServerError(error) {
  return error?.code === "ECONNRESET" || error?.code === "HPE_INVALID_EOF_STATE" || error?.message === "aborted";
}

function setCachedAsset(cacheKey, payload) {
  cache.set(cacheKey, payload);

  if (cache.size <= MAX_CACHE_ENTRIES) {
    return;
  }

  const oldestKey = cache.keys().next().value;
  cache.delete(oldestKey);
}

function getRemoteAssetTarget(requestPath) {
  for (const [prefix, baseUrl] of Object.entries(REMOTE_ASSET_BASE_URLS)) {
    if (requestPath.startsWith(prefix)) {
      return `${baseUrl}${requestPath.slice(prefix.length).replace(/^\/+/, "")}`;
    }
  }

  return null;
}

if (config.challenge === true) {
  console.log(chalk.green("🔒 Password protection is enabled."));
  console.log(chalk.blue(`Configured users: ${Object.keys(config.users).join(", ")}`));
  app.use(basicAuth({ users: config.users, challenge: true }));
}

app.get("/e/*", async (req, res, next) => {
  try {
    if (cache.has(req.path)) {
      const { data, contentType, timestamp } = cache.get(req.path);
      if (Date.now() - timestamp > CACHE_TTL) {
        cache.delete(req.path);
      } else {
        res.writeHead(200, {
          "Cache-Control": "public, max-age=2592000",
          "Content-Type": contentType,
        });
        return res.end(data);
      }
    }

    const reqTarget = getRemoteAssetTarget(req.path);
    if (!reqTarget) {
      return next();
    }

    const asset = await fetch(reqTarget);
    if (!asset.ok) {
      return next();
    }

    const data = Buffer.from(await asset.arrayBuffer());
    const ext = path.extname(reqTarget);
    const no = [".unityweb"];
    const contentType = no.includes(ext) ? "application/octet-stream" : (mime.getType(ext) ?? "application/octet-stream");

    setCachedAsset(req.path, { data, contentType, timestamp: Date.now() });
    res.writeHead(200, {
      "Cache-Control": "public, max-age=2592000",
      "Content-Type": contentType,
    });
    res.end(data);
  } catch (error) {
    console.error("Error fetching asset:", error);
    res.setHeader("Content-Type", "text/html");
    res.status(500).send("Error fetching the asset");
  }
});

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* if (process.env.MASQR === "true") {
  console.log(chalk.green("Masqr is enabled"));
  setupMasqr(app);
} */

app.use(express.static(path.join(__dirname, "static")));
app.use("/ca", cors({ origin: true }));

const routes = [
  { path: "/b", file: "apps.html" },
  { path: "/a", file: "games.html" },
  { path: "/play.html", file: "games.html" },
  { path: "/c", file: "settings.html" },
  { path: "/d", file: "tabs.html" },
  { path: "/", file: "index.html" },
];

routes.forEach(route => {
  app.get(route.path, (_req, res) => {
    res.sendFile(path.join(__dirname, "static", route.file));
  });
});

app.use((_req, res) => {
  res.status(404).sendFile(path.join(__dirname, "static", "404.html"));
});

app.use((err, _req, res, _next) => {
  console.error(err.stack);
  res.status(500).sendFile(path.join(__dirname, "static", "404.html"));
});

server.on("request", (req, res) => {
  req.on("error", error => {
    if (!isIgnorableServerError(error)) {
      console.error("Request stream error:", error);
    }
  });
  res.on("error", error => {
    if (!isIgnorableServerError(error)) {
      console.error("Response stream error:", error);
    }
  });
  if (bareServer.shouldRoute(req)) {
    bareServer.routeRequest(req, res);
  } else {
    app(req, res);
  }
});

server.on("upgrade", (req, socket, head) => {
  if (bareServer.shouldRoute(req)) {
    bareServer.routeUpgrade(req, socket, head);
  } else {
    socket.end();
  }
});

server.on("listening", () => {
  console.log(chalk.green(`🌍 Server is running on http://localhost:${PORT}`));
});

server.on("clientError", (error, socket) => {
  if (!isIgnorableServerError(error)) {
    console.error("Client connection error:", error);
  }

  if (socket.writable) {
    socket.end("HTTP/1.1 400 Bad Request\r\n\r\n");
  }
});

server.on("connection", socket => {
  socket.on("error", error => {
    if (!isIgnorableServerError(error)) {
      console.error("Socket error:", error);
    }
  });
});

process.on("uncaughtException", error => {
  if (isIgnorableServerError(error)) {
    console.warn("Ignored transient server error:", error.code ?? error.message);
    return;
  }

  console.error("Uncaught exception:", error);
  process.exit(1);
});

process.on("unhandledRejection", error => {
  if (isIgnorableServerError(error)) {
    console.warn("Ignored transient rejection:", error.code ?? error.message);
    return;
  }

  console.error("Unhandled rejection:", error);
  process.exit(1);
});

server.listen({ port: PORT });
