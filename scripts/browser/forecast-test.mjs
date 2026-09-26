// Forecast page test: renders the fixture bulletin, reads it aloud with a fake
// speech engine (headless Chromium has no voices), rings the bell, scrubs the
// time slider, links chart areas to rows, and checks phone width and dark mode.
// Usage: cd scripts/browser && node forecast-test.mjs [outDir]
import { launch, serve } from "./site.mjs";

const out = process.argv[2] || "/tmp";
const fails = [];
const ok = (cond, what) => (cond ? console.log("  ✓ " + what) : (fails.push(what), console.log("  ✗ " + what)));

// Everyone hears the fixture's issue: 2026-09-26 1800 UTC, looked at at 2000.
const NOW = new Date("2026-09-26T20:10:00Z");

const fakeSpeech = () => {
  const said = [];
  window.__said = said;
  class U { constructor(t) { this.text = t; this.volume = 1; } }
  window.SpeechSynthesisUtterance = U;
  const synth = {
    speaking: false,
    getVoices: () => [{ name: "Daniel", lang: "en-GB", localService: true }],
    addEventListener() {},
    speak(u) {
      said.push(u.text);
      setTimeout(() => u.onend && u.onend(), 5);
    },
    cancel() { said.push("<cancel>"); },
  };
  Object.defineProperty(window, "speechSynthesis", { value: synth, configurable: true });
};

const browser = await launch();
for (const mode of [{ name: "desktop", w: 1366, h: 900, scheme: "light" }, { name: "phone", w: 390, h: 844, scheme: "dark", mobile: true }]) {
  console.log(`\n${mode.name}`);
  const ctx = await browser.newContext({ viewport: { width: mode.w, height: mode.h }, colorScheme: mode.scheme, isMobile: !!mode.mobile, hasTouch: !!mode.mobile });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.clock.setFixedTime(NOW);
  await page.addInitScript(fakeSpeech);
  await serve(page);
  await page.goto("http://site.test/forecast", { waitUntil: "networkidle" });
  await page.waitForSelector(".fc-row");

  const rows = await page.$$eval(".fc-row", (r) => r.map((x) => x.querySelector(".fc-row-name").textContent));
  ok(rows.length >= 1 && rows.join(" ").includes("Morrow"), `bulletin has area rows (${rows.length})`);
  ok(await page.$eval("#fc-listen", (b) => !b.disabled), "Listen button is enabled");
  ok((await page.$$("#fc-winds .fc-arrow")).length === 10, "ten wind arrows on the chart");
  ok((await page.$$("#fc-isobars .fc-iso")).length > 3, "isobars drawn");
  ok(await page.$eval("#fc-twins tbody", (t) => t.rows.length === 10 && /°/.test(t.textContent)), "twins table filled");
  ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "no sideways scroll on the page");

  // Scrub the slider: arrows and the label change.
  const before = await page.$eval("#fc-winds", (g) => g.innerHTML);
  await page.$eval("#fc-hour", (r) => { r.value = "22"; r.dispatchEvent(new Event("input")); });
  const after = await page.$eval("#fc-winds", (g) => g.innerHTML);
  ok(before !== after, "slider moves the winds");
  ok(/Sun/.test(await page.textContent("#fc-hour-out")), "slider label shows tomorrow");

  // Listen: bells, then every line of the script, in order, with highlights.
  const highlights = [];
  await page.exposeFunction("__hl", (x) => highlights.push(x));
  await page.evaluate(() => {
    new MutationObserver(() => {
      const a = [...document.querySelectorAll(".fc-area.is-reading")].map((p) => p.dataset.area);
      if (a.length) window.__hl(a.join(","));
    }).observe(document.getElementById("fc-svg"), { subtree: true, attributes: true, attributeFilter: ["class"] });
  });
  await page.click("#fc-listen");
  ok(/bell/i.test(await page.textContent("#fc-status")), "status names the bells: " + (await page.textContent("#fc-status")));
  await page.waitForFunction(() => window.__said.some((s) => s.startsWith("And that completes")), null, { timeout: 30000 });
  await page.waitForTimeout(600);
  const said = await page.evaluate(() => window.__said);
  const script = await page.evaluate(() => window.forecast.script.map((s) => s.say));
  ok(said[0] === " ", "a silent line unlocks speech inside the tap");
  ok(JSON.stringify(said.slice(1).filter((s) => s !== "<cancel>")) === JSON.stringify(script), `every line read in order (${script.length})`);
  ok(said[1].includes("issued by the Cartographer at eighteen hundred") && said[1].includes("twenty-sixth of September"), "opening line reads the time and date aloud");
  const syn = said.find((s) => /^(Low|High|New low)/.test(s)) || "";
  ok(syn && !/\b(9\d\d|10\d\d)\b(?! leagues)/.test(syn) && /(nine|one thousand)/.test(syn), "synopsis pressures are spelled out: " + syn.slice(0, 90));
  ok(highlights.some((h) => h.includes("morrow")), "Morrow lit up while it was read");
  ok(await page.$eval("#fc-listen", (b) => !b.classList.contains("is-playing")), "button resets at the end");
  ok(/next one comes/.test(await page.textContent("#fc-status")), "status says when the next one comes");

  // Stop half way.
  await page.evaluate(() => (window.__said.length = 0));
  await page.click("#fc-listen");
  await page.waitForTimeout(300);
  await page.click("#fc-listen");
  ok(await page.evaluate(() => window.__said.includes("<cancel>")), "Stop cancels speech");
  ok((await page.$$(".fc-area.is-reading")).length === 0, "Stop clears the highlight");

  // Click an area on the chart: its row is the target.
  if (!mode.mobile) {
    const box = await page.$eval('.fc-name[data-area="formerly"]', (t) => { const r = t.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
    await page.mouse.click(box[0], box[1] - 20);
    await page.waitForTimeout(700);
    ok((await page.evaluate(() => location.hash)) === "#fc-formerly", "clicking Formerly on the chart goes to its row");
  }

  await page.screenshot({ path: `${out}/forecast-${mode.name}.png`, fullPage: false });
  ok(errors.length === 0, "no errors" + (errors.length ? ": " + errors.join(" | ") : ""));
  await ctx.close();
}
await browser.close();
console.log(fails.length ? `\n${fails.length} failed` : "\nall passed");
process.exit(fails.length ? 1 : 0);
