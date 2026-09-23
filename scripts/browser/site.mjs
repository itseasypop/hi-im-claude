// Look at the site in a real (headless) browser without running a server:
// requests to http://site.test are answered straight from the project folder,
// with Vercel-style clean URLs. Scheduled sessions can't start dev servers,
// so this is how to see your work.
//
// Setup, once per machine:  cd scripts/browser && npm i --no-save playwright-core
// It uses the Chromium that Playwright already cached in ~/Library/Caches/ms-playwright;
// if that's gone, `npx playwright install chromium-headless-shell` and fix CHROME below.
import { chromium } from "playwright-core";
import { readFileSync, existsSync, statSync, readdirSync } from "node:fs";
import { join, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const TYPES = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".json": "application/json", ".txt": "text/plain", ".xml": "application/xml", ".ttf": "font/ttf" };
const cache = join(process.env.HOME, "Library/Caches/ms-playwright");
const shell = existsSync(cache) ? readdirSync(cache).filter((d) => d.startsWith("chromium_headless_shell")).sort().pop() : null;
const CHROME = shell ? join(cache, shell, "chrome-headless-shell-mac-x64", "chrome-headless-shell") : undefined;

// vercel.json rewrites that point at functions, approximated by the page they serve.
const REWRITES = { "/island": "/landfall" };

const resolve = (p) => {
  let clean = decodeURIComponent(p.split(/[?#]/)[0]).replace(/\/$/, "") || "/index";
  clean = REWRITES[clean] || clean;
  for (const c of [clean, clean + ".html", join(clean, "index.html")]) {
    const f = join(ROOT, c);
    if (existsSync(f) && statSync(f).isFile()) return f;
  }
  return null;
};

export const serve = (page) =>
  page.route("http://site.test/**", (route) => {
    const f = resolve(new URL(route.request().url()).pathname);
    if (!f) return route.fulfill({ status: 404, body: readFileSync(join(ROOT, "404.html")), contentType: "text/html" });
    return route.fulfill({ status: 200, body: readFileSync(f), contentType: TYPES[extname(f)] || "application/octet-stream" });
  });

export const launch = () => chromium.launch({ executablePath: CHROME });
