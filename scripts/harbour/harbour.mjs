// The harbour log: islands reported from Landfall, waiting to be read.
//
//   node scripts/harbour/harbour.mjs list [outDir]
//       Lists reports not yet reviewed, and draws them onto contact sheets
//       (PNG) in outDir (default: a temp folder) so they can be looked at.
//   node scripts/harbour/harbour.mjs chart REF --text "One line about it." [--name "Name" | --charted] [--scale 1] [--at x,y]
//       Charts a report at the edge of the atlas as an E.D. island. By default
//       it keeps the name it was reported under; --charted uses Landfall's own
//       name instead (use that when the reported name won't do).
//   node scripts/harbour/harbour.mjs decline REF [REF...]
//       Marks reports as read and not charted.
//
// Then run `node scripts/atlas/build.mjs`. Decisions live in
// scripts/atlas/harbour.json (public, in the repo): charted islands keep their
// code and my line about them; declined ones keep only their number and day.
// Reports themselves stay in the Blob store; nothing here deletes them.
// Needs BLOB_READ_WRITE_TOKEN in .env.local (see JOURNAL.md, "Storage").
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
import { list, head } from "@vercel/blob";
import { chart, decode, reportRef } from "../../landfall/chart.js";
import { place } from "./place.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const logFile = join(root, "scripts/atlas/harbour.json");
const DAY0 = Date.UTC(2026, 8, 22);
const today = Math.floor((Date.now() - DAY0) / 86400000);

const env = existsSync(join(root, ".env.local")) ? readFileSync(join(root, ".env.local"), "utf8") : "";
const token = process.env.BLOB_READ_WRITE_TOKEN || env.match(/^BLOB_READ_WRITE_TOKEN="?([^"\n]+)"?/m)?.[1];
if (!token) throw new Error("No BLOB_READ_WRITE_TOKEN in the environment or .env.local");

const load = () => (existsSync(logFile) ? JSON.parse(readFileSync(logFile, "utf8")) : { reviewed: {}, sightings: [] });
const save = (log) => writeFileSync(logFile, JSON.stringify(log, null, 2) + "\n");

const allReports = async () => {
  const out = [];
  let cursor;
  do {
    const page = await list({ prefix: "harbour/", cursor, token });
    out.push(...page.blobs);
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return out;
};

const fetchReport = async (url) => {
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return r.json();
};

/* ---------- commands ---------- */

const [cmd, ...args] = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf("--" + name);
  return i >= 0 ? args[i + 1] : undefined;
};

if (cmd === "list") {
  const log = load();
  const blobs = (await allReports()).filter((b) => /^harbour\/[0-9A-Z]{6}\.json$/.test(b.pathname));
  const fresh = blobs.filter((b) => !log.reviewed[b.pathname.slice(8, 14)]).sort((a, b) => new Date(a.uploadedAt) - new Date(b.uploadedAt));
  console.log(`${blobs.length} report(s) in the harbour, ${fresh.length} not yet read.`);
  if (!fresh.length) process.exit(0);
  const outDir = args[0] || join(tmpdir(), "harbour-" + today);
  mkdirSync(outDir, { recursive: true });
  const cards = [];
  for (const b of fresh) {
    let r;
    try {
      r = await fetchReport(b.url);
    } catch (e) {
      console.log(`  ?      ${b.pathname}: unreadable (${e.message})`);
      continue;
    }
    const st = decode(r.i);
    if (!st || reportRef(r.i) !== r.ref) {
      console.log(`  ?      ${r.ref}: the code doesn't decode or doesn't match its number`);
      continue;
    }
    const c = chart(st, { aspect: 1.5, theme: "light", paper: "plain" });
    console.log(`  ${r.ref}  day ${r.day}  ${st.islands.length} island(s)  charted "${c.name}"${r.name ? `  reported as "${r.name}"` : ""}`);
    cards.push({ r, svg: c.svg, name: c.name });
  }
  // Contact sheets, six to a page, drawn by the same headless browser the tests use.
  const fontCss = ["IMFellEnglish-Regular", "IMFellEnglish-Italic", "IMFellEnglishSC-Regular"]
    .map((n, i) => `@font-face{font-family:'${i === 2 ? "IM Fell English SC" : "IM Fell English"}';font-style:${i === 1 ? "italic" : "normal"};src:url('${pathToFileURL(join(root, "landfall/fonts", n + ".ttf"))}')}`)
    .join("");
  const { launch } = await import("../browser/site.mjs");
  const browser = await launch();
  const page = await browser.newPage({ viewport: { width: 1500, height: 1100 } });
  for (let s = 0; s * 6 < cards.length; s++) {
    const html = `<style>${fontCss}body{margin:0;display:grid;grid-template-columns:repeat(3,1fr);align-items:start;gap:8px;padding:8px;background:#ddd;font:14px monospace}figure{margin:0;background:#fff}figure svg{display:block;width:100%;height:auto}figcaption{padding:4px 8px}</style>${cards
      .slice(s * 6, s * 6 + 6)
      .map((c) => `<figure>${c.svg}<figcaption><b>${c.r.ref}</b> · ${c.name.replace(/</g, "&lt;")}${c.r.name ? ` · reported as “${c.r.name.replace(/</g, "&lt;")}”` : ""} · day ${c.r.day}</figcaption></figure>`)
      .join("")}`;
    await page.setContent(html, { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    const file = join(outDir, `sheet-${s + 1}.png`);
    await page.screenshot({ path: file, fullPage: true });
    console.log(`→ ${file}`);
  }
  await browser.close();
} else if (cmd === "chart") {
  const ref = (args[0] || "").toUpperCase();
  const text = opt("text");
  if (!/^[0-9A-Z]{6}$/.test(ref) || !text) throw new Error('Usage: chart REF --text "..." [--name "..." | --charted] [--scale k] [--at x,y]');
  const log = load();
  if (log.sightings.some((s) => s.ref === ref)) throw new Error(`${ref} is already charted`);
  const h = await head(`harbour/${ref}.json`, { token });
  const r = await fetchReport(h.url);
  if (!decode(r.i) || reportRef(r.i) !== ref) throw new Error(`${ref}: bad code`);
  const scale = Number(opt("scale") || 1);
  const at = opt("at") ? opt("at").split(",").map(Number) : place(ref, log, 170 * scale);
  const name = args.includes("--charted") ? r.charted : opt("name") || r.name || r.charted;
  log.sightings.push({ ref, i: r.i, name, charted: r.charted, reported: r.day, day: today, at, scale, text });
  log.reviewed[ref] = { day: today, decision: "charted" };
  save(log);
  console.log(`Charted ${ref} as ${name} (E.D.) at ${at.join(", ")}. Now run: node scripts/atlas/build.mjs`);
} else if (cmd === "decline") {
  const log = load();
  for (const a of args) {
    const ref = a.toUpperCase();
    if (!/^[0-9A-Z]{6}$/.test(ref)) continue;
    log.reviewed[ref] = { day: today, decision: "declined" };
  }
  save(log);
  console.log(`Marked ${args.length} report(s) as read.`);
} else {
  console.log(readFileSync(fileURLToPath(import.meta.url), "utf8").split("\n").slice(0, 18).join("\n"));
}
