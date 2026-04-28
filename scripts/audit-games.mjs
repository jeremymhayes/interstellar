import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";
import { createAuditSlug, isBlankLaunch, loadGames, usesLocalPath, xorEncodeUrl } from "./games-catalog.mjs";

const DEFAULT_BASE_URL = "http://127.0.0.1:8080";
const DEFAULT_TIMEOUT_MS = 15000;
const COMMON_BROWSER_PATHS = ["C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe", "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe", "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"];
const ERROR_PATTERNS = [
  /error(?: code)?\s*1016/i,
  /404 not found/i,
  /404[:|]\s*that page is mia/i,
  /404:\s*this page could not be found/i,
  /418 forbidden/i,
  /429 too many requests/i,
  /access denied/i,
  /attention required!\s*\|\s*cloudflare/i,
  /bad gateway/i,
  /domain has expired/i,
  /error code 502/i,
  /error 404\s*\|\s*rawgit\.hack/i,
  /item is no longer available/i,
  /just a moment/i,
  /origin is unreachable/i,
  /performing security verification/i,
  /related searches/i,
  /resources and information/i,
  /ng guard/i,
  /page not found/i,
  /page could not be found/i,
  /site not found/i,
  /sorry,\s*you have been blocked/i,
  /something is wrong\.\s*that'?s all we know/i,
  /there isn't a github pages site here/i,
  /unable to fetch bare meta/i,
  /missing[- ]header/i,
  /site can[’']?t be reached/i,
];

function parseArgs(argv) {
  const args = new Map();
  for (let index = 2; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!argument.startsWith("--")) {
      continue;
    }

    const [key, inlineValue] = argument.slice(2).split("=", 2);
    if (inlineValue !== undefined) {
      args.set(key, inlineValue);
      continue;
    }

    const nextValue = argv[index + 1];
    if (!nextValue || nextValue.startsWith("--")) {
      args.set(key, "true");
      continue;
    }

    args.set(key, nextValue);
    index += 1;
  }

  return {
    baseUrl: args.get("base-url") || DEFAULT_BASE_URL,
    browserPath: args.get("browser-path") || process.env.GAMES_BROWSER_PATH || findBrowserPath(),
    inputFile: args.get("input-file") || null,
    limit: args.has("limit") ? Number.parseInt(args.get("limit"), 10) : Number.POSITIVE_INFINITY,
    match: args.get("match") ? new RegExp(args.get("match"), "i") : null,
    mode: args.get("mode") || "network",
    output: args.get("output") || null,
    timeoutMs: args.has("timeout") ? Number.parseInt(args.get("timeout"), 10) : DEFAULT_TIMEOUT_MS,
  };
}

function findBrowserPath() {
  return COMMON_BROWSER_PATHS.find(candidate => fs.existsSync(candidate)) || null;
}

function selectGames(games, options) {
  let selectedGames = games.filter(game => game.link);
  if (options.inputFile) {
    const rawInput = JSON.parse(fs.readFileSync(path.resolve(options.inputFile), "utf8"));
    const candidateEntries = rawInput.filter(entry => entry && typeof entry === "object" && typeof entry.link === "string");
    if (candidateEntries.length > 0) {
      selectedGames = candidateEntries.map(entry => ({
        categories: Array.isArray(entry.categories) ? entry.categories : [],
        link: entry.link,
        name: entry.name || entry.link,
        ...(entry.blank !== undefined ? { blank: entry.blank } : {}),
      }));
    } else {
      const wantedNames = new Set(rawInput.map(entry => (typeof entry === "string" ? entry : entry.name)).filter(Boolean));
      selectedGames = selectedGames.filter(game => wantedNames.has(game.name));
    }
  }
  if (options.match) {
    selectedGames = selectedGames.filter(game => options.match.test(game.name) || options.match.test(game.link));
  }
  if (Number.isFinite(options.limit)) {
    selectedGames = selectedGames.slice(0, options.limit);
  }
  return selectedGames;
}

function classifyNetworkResult(result) {
  if (result.error) {
    return "error";
  }
  if (!result.statusCode) {
    return "unknown";
  }
  if (result.statusCode >= 500) {
    return "broken";
  }
  if (result.statusCode === 404) {
    return "broken";
  }
  if (result.statusCode >= 400) {
    return "blocked";
  }
  if (result.matchedError) {
    return "suspicious";
  }
  return "ok";
}

async function readResponsePreview(response, limit = 2048) {
  const text = await response.text();
  return {
    preview: text.slice(0, limit).replace(/\s+/g, " "),
    size: text.length,
  };
}

async function auditNetwork(game, options) {
  const target = usesLocalPath(game) ? new URL(game.link, options.baseUrl).toString() : game.link;
  const result = {
    categories: game.categories,
    link: game.link,
    mode: "network",
    name: game.name,
    slug: createAuditSlug(game.name),
    target,
  };

  try {
    const response = await fetch(target, {
      headers: {
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36",
      },
      redirect: "follow",
    });
    const { preview, size } = await readResponsePreview(response);
    result.contentType = response.headers.get("content-type");
    result.finalUrl = response.url;
    result.preview = preview;
    result.responseSize = size;
    result.statusCode = response.status;
    result.matchedError = ERROR_PATTERNS.find(pattern => pattern.test(preview))?.toString() ?? null;
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
  }

  result.classification = classifyNetworkResult(result);
  result.ok = result.classification === "ok";
  return result;
}

async function ensureServiceWorker(page, baseUrl, timeoutMs) {
  await page.goto(baseUrl, { timeout: timeoutMs, waitUntil: "domcontentloaded" });
  await page.evaluate(async () => {
    localStorage.setItem("dy", "false");
    if ("serviceWorker" in navigator) {
      await Promise.race([navigator.serviceWorker.ready, new Promise(resolve => setTimeout(resolve, 5000))]);
    }
  });
}

function getLaunchPayload(game) {
  if (usesLocalPath(game)) {
    return {
      launchUrl: "/d",
      goUrl: game.link,
      inspector: "iframe",
    };
  }

  const encodedUrl = xorEncodeUrl(game.link);
  if (isBlankLaunch(game)) {
    return {
      launchUrl: `/a/${encodedUrl}`,
      goUrl: encodedUrl,
      inspector: "page",
    };
  }

  return {
    launchUrl: "/d",
    goUrl: encodedUrl,
    inspector: "iframe",
  };
}

async function inspectFrame(frame) {
  return frame.evaluate(() => {
    const text = document.body?.innerText?.replace(/\s+/g, " ").trim() ?? "";
    const html = document.documentElement?.outerHTML ?? "";
    const media = document.querySelectorAll("canvas, iframe, embed, object, svg, video").length;
    const buttons = document.querySelectorAll("button, [role='button'], input[type='button']").length;
    const bodyHtml = document.body?.innerHTML ?? "";
    return {
      buttonCount: buttons,
      hasRuffle: Boolean(document.getElementById("ruffle")) || /RufflePlayer|player\.load\(/.test(bodyHtml),
      htmlLength: html.length,
      mediaCount: media,
      scriptCount: document.scripts.length,
      textSample: text.slice(0, 400),
      title: document.title,
      url: location.href,
    };
  });
}

function classifyBrowserResult(result) {
  if (result.error) {
    return "error";
  }

  const combinedSummary = [result.summary?.title, result.summary?.textSample, result.summary?.url].filter(Boolean).join("\n");
  result.matchedError = ERROR_PATTERNS.find(pattern => pattern.test(combinedSummary))?.toString() ?? null;

  if (result.matchedError) {
    return "broken";
  }
  if (result.summary?.url?.startsWith("chrome-error://")) {
    return "broken";
  }
  if (result.summary?.hasRuffle) {
    return "ok";
  }
  if ((result.summary?.mediaCount ?? 0) > 0) {
    return "ok";
  }
  if ((result.summary?.scriptCount ?? 0) >= 3 && (result.summary?.title ?? "").trim().length > 0) {
    return "ok";
  }
  if ((result.summary?.htmlLength ?? 0) > 3000 && (result.summary?.buttonCount ?? 0) > 0) {
    return "ok";
  }
  if ((result.summary?.htmlLength ?? 0) > 8000) {
    return "suspicious";
  }
  return "broken";
}

async function auditBrowser(game, options, browser) {
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: { height: 900, width: 1440 },
  });
  const page = await context.newPage();
  const result = {
    categories: game.categories,
    link: game.link,
    mode: "browser",
    name: game.name,
    slug: createAuditSlug(game.name),
  };

  try {
    console.log(`Browser auditing: ${game.name}`);
    await ensureServiceWorker(page, options.baseUrl, options.timeoutMs);
    const { goUrl, inspector, launchUrl } = getLaunchPayload(game);
    await page.evaluate(value => {
      sessionStorage.removeItem("URL");
      sessionStorage.setItem("GoUrl", value);
    }, goUrl);

    await page.goto(new URL(launchUrl, options.baseUrl).toString(), {
      timeout: options.timeoutMs,
      waitUntil: "domcontentloaded",
    });

    if (inspector === "page") {
      await page.waitForTimeout(2500);
      result.summary = await inspectFrame(page.mainFrame());
    } else {
      const iframeLocator = page.locator("#frame-container iframe.active");
      await iframeLocator.waitFor({ state: "attached", timeout: options.timeoutMs });
      const frameHandle = await iframeLocator.elementHandle();
      const frame = await frameHandle?.contentFrame();
      if (!frame) {
        throw new Error("Active game iframe was not available.");
      }
      await frame.waitForLoadState("domcontentloaded", { timeout: options.timeoutMs }).catch(() => {});
      await page.waitForTimeout(2500);
      result.summary = await inspectFrame(frame);
    }
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
  } finally {
    await context.close();
  }

  result.classification = classifyBrowserResult(result);
  result.ok = result.classification === "ok";
  return result;
}

async function main() {
  const options = parseArgs(process.argv);
  const games = selectGames(loadGames(), options);
  const results = [];

  if (options.mode === "network") {
    for (const game of games) {
      results.push(await auditNetwork(game, options));
      if (results.length % 25 === 0) {
        console.log(`Network checked ${results.length}/${games.length}`);
      }
    }
  } else if (options.mode === "browser") {
    if (!options.browserPath) {
      throw new Error("A Chromium-based browser path is required for browser mode. Use --browser-path.");
    }

    const browser = await chromium.launch({
      executablePath: options.browserPath,
      headless: true,
    });
    try {
      for (const game of games) {
        results.push(await auditBrowser(game, options, browser));
        if (results.length % 10 === 0) {
          console.log(`Browser checked ${results.length}/${games.length}`);
        }
      }
    } finally {
      await browser.close();
    }
  } else {
    throw new Error(`Unsupported mode: ${options.mode}`);
  }

  const summary = {
    broken: results.filter(result => result.classification === "broken").length,
    errors: results.filter(result => result.classification === "error").length,
    ok: results.filter(result => result.ok).length,
    suspicious: results.filter(result => result.classification === "suspicious").length,
    total: results.length,
  };

  const payload = { summary, results };
  if (options.output) {
    const outputPath = path.resolve(options.output);
    fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`);
  }

  console.log(JSON.stringify(summary, null, 2));
}

await main();
