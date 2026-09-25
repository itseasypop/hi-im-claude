// Checks that Fathom plays: casts, soundings, the bird, resuming after a reload,
// running out of casts, landfall, keyboard casting, and the ?no= archive.
// Usage (from scripts/browser): node fathom-test.mjs [outDir]   (exits 1 on failure)
import { launch, serve } from "./site.mjs";

const out = process.argv[2];
const browser = await launch();
let failed = 0;
const ok = (name, cond) => {
  if (!cond) failed++;
  console.log((cond ? "✓ " : "✗ ") + name);
};

const open = async (ctx, path = "/fathom") => {
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  page.on("console", (m) => m.type() === "error" && errs.push(m.text()));
  await page.clock.setFixedTime(new Date("2026-09-27T15:00:00"));
  // http://site.test isn't a secure context, so there's no clipboard: stand one in.
  await page.addInitScript(() => {
    if (!navigator.clipboard) Object.defineProperty(navigator, "clipboard", { value: { writeText: async (t) => (window.__copied = t), readText: async () => window.__copied } });
  });
  await serve(page);
  await page.goto("http://site.test" + path, { waitUntil: "networkidle" });
  page.errs = errs;
  return page;
};

// Click the sea at a world point.
const castAt = async (page, p, { touch = false } = {}) => {
  const [x, y] = await page.evaluate(([x, y]) => {
    const r = document.getElementById("fa-viewport").getBoundingClientRect();
    const [x0, y0, x1, y1] = window.fathom.pz.sea;
    return [r.left + ((x - x0) / (x1 - x0)) * r.width, r.top + ((y - y0) / (y1 - y0)) * r.height];
  }, p);
  const before = await page.evaluate(() => window.fathom.game.casts.length);
  if (touch) await page.touchscreen.tap(x, y);
  else await page.mouse.click(x, y);
  await page.waitForFunction((n) => window.fathom.game.casts.length > n && !document.getElementById("fa-viewport").classList.contains("is-busy"), before, { timeout: 8000 });
};

// Points in the sea sorted by what the lead would find there.
const survey = (page) =>
  page.evaluate(() => {
    const { pz, sound } = window.fathom;
    const [x0, y0] = pz.sea;
    const pts = [];
    for (let i = 1; i < 12; i++) for (let j = 1; j < 12; j++) {
      const p = [Math.round(x0 + (i * 2400) / 12), Math.round(y0 + (j * 2400) / 12)];
      pts.push({ p, r: sound(p) });
    }
    return { none: pts.filter((q) => q.r.none).map((q) => q.p), bottom: pts.filter((q) => !q.r.none && !q.r.land).map((q) => q.p), centre: pz.centre, land: window.fathom.sound(pz.centre).land };
  });

/* ----- a lost game, with the bird, and a reload in the middle ----- */
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  let page = await open(ctx);
  ok("today is No. 3 on 27 September", (await page.textContent("#fa-no")) === "No. 3");
  ok("ten lead weights", (await page.$$eval("#fa-pips li", (l) => l.length)) === 10);
  const s = await survey(page);
  ok(`the sea has deep water (${s.none.length}) and banks (${s.bottom.length})`, s.none.length >= 3 && s.bottom.length >= 7);
  ok("the island's middle is land", s.land);
  for (const p of s.none.slice(0, 3)) await castAt(page, p);
  ok("three casts drawn", (await page.$$eval("#fa-marks .fa-sounding", (g) => g.length)) === 3);
  ok("no bottom is called", (await page.textContent("#fa-call")).includes("No bottom at forty"));
  ok("a frigatebird flies over", (await page.textContent("#fa-call")).includes("frigatebird") && (await page.$$("#fa-birds path")).length === 2);
  ok("pips show three used", (await page.$$eval("#fa-pips .is-used", (l) => l.length)) === 3);
  if (out) await page.screenshot({ path: `${out}/fathom-bird.png` });

  await page.reload({ waitUntil: "networkidle" });
  ok("reload keeps the casts", (await page.$$eval("#fa-marks .fa-sounding", (g) => g.length)) === 3 && (await page.evaluate(() => window.fathom.game.casts.length)) === 3);
  ok("reload keeps the bird", (await page.$$("#fa-birds path")).length === 2);
  ok("reload says how many are left", (await page.textContent("#fa-call")).includes("7 casts left"));

  for (const p of s.bottom.slice(0, 7)) await castAt(page, p);
  await page.waitForSelector("#fa-result:not([hidden])", { timeout: 8000 });
  await page.waitForTimeout(400);
  ok("ten casts and the fog closes in", (await page.textContent("#fa-result-title")) === "The fog closed in.");
  ok("the island is charted anyway", (await page.$$("#fa-chart .lf-cartouche")).length === 1);
  ok("the fog is gone", (await page.$$("#fa-fog")).length === 0);
  ok("the gazetteer is shown", await page.$eval("#fa-gazetteer", (s) => !s.hidden && s.querySelectorAll(".gz-entry").length > 4));
  ok("squares end in fog", (await page.textContent("#fa-squares")).endsWith("🌫️"));
  ok("further casts do nothing", await (async () => {
    await page.mouse.click(300, 300);
    await page.waitForTimeout(300);
    return (await page.evaluate(() => window.fathom.game.casts.length)) === 10;
  })());
  ok("stats: played 1, found 0", (await page.textContent("#fa-stats")).replace(/\s+/g, " ").includes("Played1") || (await page.$$eval("#fa-stats dd", (d) => d.map((x) => x.textContent))).slice(0, 2).join() === "1,0");
  if (out) await page.screenshot({ path: `${out}/fathom-lost.png`, fullPage: true });
  ok("no errors: " + page.errs.join(" | "), page.errs.length === 0);
  await ctx.close();
}

/* ----- a found game on a phone, in the dark ----- */
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, colorScheme: "dark" });
  const page = await open(ctx);
  const s = await survey(page);
  await castAt(page, s.bottom[0], { touch: true });
  await castAt(page, s.centre, { touch: true });
  await page.waitForSelector("#fa-result:not([hidden])", { timeout: 8000 });
  await page.waitForTimeout(600);
  const title = await page.textContent("#fa-result-title");
  ok(`landfall: "${title}"`, /^Land! You found .+\.$/.test(title));
  ok("the landfall link is an island link", (await page.getAttribute("#fa-landfall", "href")).startsWith("/island?i="));
  ok("the chart is dark", (await page.$eval("#fa-chart svg .sea", (r) => getComputedStyle(r).fill)) === "rgb(27, 24, 20)");
  ok("the ship went ashore", await page.$eval("#fa-ship", (g) => g.classList.contains("is-ashore")));
  if (out) await page.screenshot({ path: `${out}/fathom-found-phone.png` });
  ok("no errors: " + page.errs.join(" | "), page.errs.length === 0);
  await ctx.close();
}

/* ----- keyboard, sharing, and the archive ----- */
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  let page = await open(ctx, "/fathom?no=1");
  ok("?no=1 plays No. 1", (await page.textContent("#fa-no")) === "No. 1");
  await page.focus("#fa-viewport");
  await page.keyboard.press("ArrowRight");
  ok("arrow keys show a cross-hair", await page.$eval("#fa-reticle", (g) => g.classList.contains("is-on")));
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => window.fathom.game.casts.length === 1 && !document.getElementById("fa-viewport").classList.contains("is-busy"));
  ok("enter casts", (await page.$$("#fa-marks .fa-sounding")).length === 1);
  const c = await page.evaluate(() => window.fathom.pz.centre);
  await castAt(page, c);
  await page.waitForSelector("#fa-result:not([hidden])", { timeout: 8000 });
  await page.click("#fa-share");
  const shared = await page.evaluate(() => navigator.clipboard.readText());
  ok("share text names the puzzle and the count", shared.startsWith("Fathom No. 1 · found in 2/10") && shared.includes("?no=1"));
  await page.click("#fa-zoom");
  await page.waitForTimeout(1400);
  const vb = (await page.getAttribute("#fa-over", "viewBox")).split(" ").map(Number);
  ok("whole sea view", Math.abs(vb[2] - 2400) < 1);
  page = await open(ctx, "/fathom?no=999");
  ok("a future number falls back to today", (await page.textContent("#fa-no")) === "No. 3");
  ok("no errors: " + page.errs.join(" | "), page.errs.length === 0);
  await ctx.close();
}

/* ----- the same island for everyone ----- */
{
  const { puzzle, sound, numberFor } = await import("../../fathom/game.js");
  const a = puzzle(7);
  const b = puzzle(7);
  ok("puzzles are deterministic", a.code === b.code && a.sea.join() === b.sea.join());
  ok("puzzles differ from day to day", puzzle(8).code !== a.code);
  ok("local midnight turns the day", numberFor(new Date(2026, 8, 25, 0, 1)) === 1 && numberFor(new Date(2026, 8, 25, 23, 59)) === 1 && numberFor(new Date(2026, 8, 26, 0, 1)) === 2);
  let centreHits = 0;
  for (let n = 1; n <= 120; n++) {
    const pz = puzzle(n);
    if (!sound(pz, [pz.sea[0] + 1200, pz.sea[1] + 1200]).none && sound(pz, [pz.sea[0] + 1200, pz.sea[1] + 1200]).depth < 21) centreHits++;
  }
  ok(`the middle of the sea is never the island's shallows (${centreHits}/120)`, centreHits === 0);
}

await browser.close();
if (failed) {
  console.log(`\n${failed} failed`);
  process.exit(1);
}
