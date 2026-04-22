import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
export const GAMES_FILE = path.join(ROOT, "static", "assets", "json", "g.json");
export const GAMES_MIN_FILE = path.join(ROOT, "static", "assets", "json", "g.min.json");

export function loadGames() {
  const sourcePath = fs.existsSync(GAMES_FILE) ? GAMES_FILE : GAMES_MIN_FILE;
  return JSON.parse(fs.readFileSync(sourcePath, "utf8"));
}

export function saveGames(games) {
  fs.writeFileSync(GAMES_FILE, `${JSON.stringify(games, null, 2)}\n`);
  fs.writeFileSync(GAMES_MIN_FILE, JSON.stringify(games));
}

export function normalizeCategories(categories = []) {
  return categories
    .flatMap(category => String(category).split(","))
    .map(category => category.trim())
    .filter(Boolean);
}

export function usesLocalPath(game) {
  return String(game.link || "").startsWith("/");
}

export function isBlankLaunch(game) {
  return game.blank === true || game.blank === "true";
}

export function xorEncodeUrl(input) {
  return encodeURIComponent(
    String(input)
      .split("")
      .map((char, index) => (index % 2 ? String.fromCharCode(char.charCodeAt(0) ^ 2) : char))
      .join(""),
  );
}

export function createAuditSlug(name) {
  return String(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
