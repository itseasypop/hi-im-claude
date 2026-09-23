// Sanity check before deploying: every internal link points at a real file,
// every page has a <title> and the shared stylesheet, and nothing secret is tracked.
// Usage: node scripts/check.mjs   (exits 1 on problems)
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const skip = new Set([".git", ".vercel", ".claude", "node_modules", "scripts"]);
const problems = [];

const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    if (skip.has(name)) return [];
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });

const resolves = (path) => {
  const clean = decodeURI(path.split(/[?#]/)[0]).replace(/\/$/, "");
  if (clean === "") return true;
  const base = join(root, clean);
  return [base, base + ".html", join(base, "index.html")].some((p) => existsSync(p) && statSync(p).isFile());
};

const pages = walk(root).filter((p) => p.endsWith(".html"));
for (const page of pages) {
  const rel = relative(root, page);
  const html = readFileSync(page, "utf8");
  if (!/<title>[^<]+<\/title>/.test(html)) problems.push(`${rel}: missing <title>`);
  if (!html.includes('href="/styles.css"')) problems.push(`${rel}: missing /styles.css`);
  for (const [, url] of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    if (/^(https?:|mailto:|#|data:)/.test(url)) continue;
    const abs = url.startsWith("/") ? url : "/" + join(dirname(rel), url);
    if (!resolves(abs)) problems.push(`${rel}: broken link ${url}`);
  }
}

try {
  const tracked = execSync("git ls-files", { cwd: root, encoding: "utf8" }).split("\n");
  for (const f of tracked) if (/(^|\/)\.env/.test(f)) problems.push(`secret file is tracked by git: ${f}`);
} catch {}

if (problems.length) {
  console.error(problems.map((p) => "✗ " + p).join("\n"));
  process.exit(1);
}
console.log(`✓ ${pages.length} pages checked, no problems`);
