// Checks that the atlas map still behaves: drag, click, keyboard, deep links, zoom.
// Usage (from scripts/browser): node atlas-test.mjs   (exits 1 on failure)
import { launch, serve } from "./site.mjs";

const browser = await launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
const errs = [];
page.on("pageerror", (e) => errs.push(e.message));
page.on("console", (m) => m.type() === "error" && errs.push(m.text()));
await serve(page);
await page.goto("http://site.test/atlas", { waitUntil: "networkidle" });
const vb = () => page.$eval("#atlas-svg", (s) => s.getAttribute("viewBox"));
let failed = 0;
const ok = (name, cond) => { if (!cond) failed++; console.log((cond ? "✓ " : "✗ ") + name); };
const v0 = await vb();
await page.mouse.move(900, 500); await page.mouse.down(); await page.mouse.move(800, 450, { steps: 5 }); await page.mouse.up();
await page.waitForTimeout(100);
ok("drag pans the map", (await vb()) !== v0);
ok("drag does not open a panel", await page.$eval("#atlas-panel", (p) => p.hidden));
// Click whichever town is on screen (the home view shows the newest island
// once the whole world is too wide to fit).
const town = await page.evaluate(() => {
  const vp = document.getElementById("atlas-viewport").getBoundingClientRect();
  for (const t of document.querySelectorAll(".place .lab-town")) {
    const r = t.getBoundingClientRect();
    if (r.left > vp.left + 20 && r.right < vp.right - 20 && r.top > vp.top + 20 && r.bottom < vp.bottom - 20) {
      return { id: t.closest(".place").dataset.place, name: t.textContent, x: r.x + r.width / 2, y: r.y + r.height / 2 };
    }
  }
});
ok("a town is on screen", !!town);
await page.mouse.click(town.x, town.y);
await page.waitForTimeout(900);
ok("click opens panel", !(await page.$eval("#atlas-panel", (p) => p.hidden)));
ok(`panel title is ${town.name}`, (await page.textContent(".panel-title")) === town.name);
ok(`hash is #${town.id}`, (await page.evaluate(() => location.hash)) === "#" + town.id);
await page.keyboard.press("Escape");
ok("escape closes", await page.$eval("#atlas-panel", (p) => p.hidden));
ok("hash cleared", (await page.evaluate(() => location.hash)) === "");
await page.click('[data-show="the-unrun"]');
await page.waitForTimeout(1200);
ok("gazetteer button opens The Unrun", (await page.textContent(".panel-title")) === "The Unrun");
ok("scrolled back to map", (await page.evaluate(() => window.scrollY)) < 120);
const z0 = await vb();
await page.mouse.move(700, 450);
await page.keyboard.down("Control"); await page.mouse.wheel(0, -200); await page.keyboard.up("Control");
await page.waitForTimeout(100);
const w = (s) => Number(s.split(" ")[2]);
ok("ctrl+wheel zooms in", w(await vb()) < w(z0));
const sy = await page.evaluate(() => window.scrollY);
await page.mouse.wheel(0, 300); await page.waitForTimeout(300);
ok("plain wheel scrolls the page", (await page.evaluate(() => window.scrollY)) > sy);
await page.evaluate(() => window.scrollTo(0, 0));
await page.focus("#atlas-viewport");
const k0 = await vb(); await page.keyboard.press("ArrowRight"); await page.waitForTimeout(80);
ok("arrow key pans", (await vb()) !== k0);
await page.click('[data-act="home"]');
await page.focus("#atlas-viewport");
await page.keyboard.press("Tab");
const focused = await page.evaluate(() => document.activeElement?.dataset?.place);
ok("tab reaches a place: " + focused, !!focused);
await page.keyboard.press("Enter"); await page.waitForTimeout(900);
ok("enter opens it", (await page.textContent(".panel-title")).length > 0 && !(await page.$eval("#atlas-panel", (p) => p.hidden)));
await page.click('[data-act="home"]'); await page.waitForTimeout(900);
ok("home closes panel", await page.$eval("#atlas-panel", (p) => p.hidden));
await page.goto("http://site.test/atlas#cape-almost", { waitUntil: "networkidle" }); await page.waitForTimeout(1200);
ok("deep link opens Cape Almost", (await page.textContent(".panel-title")) === "Cape Almost");
ok("no errors: " + errs.join(" | "), errs.length === 0);

// Anon's causeway follows the live tide (Day 3). Low water on the evening of
// 2026-09-25 (UTC), high water early the next morning.
for (const [when, open] of [["2026-09-25T22:10:00Z", true], ["2026-09-26T04:10:00Z", false]]) {
  const c = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const p = await c.newPage();
  await p.clock.install({ time: new Date(when) });
  await serve(p);
  await p.goto("http://site.test/atlas", { waitUntil: "networkidle" });
  const d = await p.$eval(".tidal-0", (g) => g.style.getPropertyValue("--d"));
  const said = await p.textContent(".gz-tide");
  ok(`tide at ${when}: causeway ${open ? "dry" : "covered"} (--d ${d})`, open ? d === "1.00" : d === "0.00");
  ok(`gazetteer says ${open ? "open" : "under water"}`, said.includes(open ? "causeway is open" : "under water"));
  await c.close();
}
// Fair Warning follows the live forecast (Day 4): no cone in the fixture's
// calm, the south cone for a southwesterly gale in Hereafter.
{
  const { readFileSync } = await import("node:fs");
  const calm = JSON.parse(readFileSync(new URL("./fixtures/forecast.json", import.meta.url)));
  for (const gale of [null, { force: 8, onset: 8, dir: "southwesterly", text: "Southwesterly gale force 8 expected soon" }]) {
    const b = structuredClone(calm);
    b.areas.find((a) => a.id === "hereafter").gale = gale;
    const c = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const p = await c.newPage();
    await p.clock.install({ time: new Date("2026-09-26T20:10:00Z") });
    await serve(p);
    await p.route("**/api/forecast*", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(b) }));
    await p.goto("http://site.test/atlas#fair-warning", { waitUntil: "networkidle" });
    await p.waitForTimeout(300);
    const cls = await p.$eval(".mast", (m) => m.getAttribute("class"));
    const said = await p.textContent("#gz-fair-warning .gz-signal");
    const pennant = await p.$eval(".mast .pennant", (g) => g.getAttribute("transform"));
    if (gale) {
      ok("gale: south cone hoisted", /is-south/.test(cls) && !/is-north/.test(cls));
      ok("gale: gazetteer says the south cone is up", said.includes("south cone is up") && said.includes("expected soon"));
    } else {
      ok("calm: no cone", !/is-(north|south)/.test(cls));
      ok("calm: gazetteer says no cone", said.includes("No cone is flying"));
    }
    ok("pennant turned by the wind: " + pennant, !pennant.startsWith("rotate(-20"));
    await c.close();
  }
}
await browser.close();
process.exit(failed ? 1 : 0);
