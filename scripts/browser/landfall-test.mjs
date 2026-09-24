// Landfall in a real (headless) browser: draw, read, rename, add, share, save.
// Usage (from scripts/browser): node landfall-test.mjs [outdir]   Exits 1 on failure.
import { launch, serve } from "./site.mjs";
import { reportRef } from "../../landfall/chart.js";

const out = process.argv[2] || "/tmp";
const browser = await launch();
const fails = [];
const check = (ok, msg) => {
  console.log((ok ? "  ok  " : "  FAIL ") + msg);
  if (!ok) fails.push(msg);
};

// A lumpy island with a bay, in screen coordinates around a centre.
const blob = (cx, cy, r, n = 70) =>
  Array.from({ length: n + 1 }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    const k = 1 + 0.22 * Math.sin(3 * a + 1) + 0.12 * Math.sin(5 * a) - 0.3 * Math.exp(-((a - 2.2) ** 2) / 0.05);
    return [cx + Math.cos(a) * r * k * 1.3, cy + Math.sin(a) * r * k * 0.9];
  });

const draw = async (page, pts) => {
  const box = await page.locator("#lf-viewport").boundingBox();
  await page.mouse.move(box.x + pts[0][0], box.y + pts[0][1]);
  await page.mouse.down();
  for (const [x, y] of pts.slice(1)) await page.mouse.move(box.x + x, box.y + y, { steps: 2 });
  await page.mouse.up();
};

for (const dev of [
  { name: "desktop", w: 1440, h: 900, scheme: "light" },
  { name: "phone", w: 390, h: 844, scheme: "dark", mobile: true },
]) {
  console.log(dev.name);
  const ctx = await browser.newContext({ viewport: { width: dev.w, height: dev.h }, colorScheme: dev.scheme, isMobile: !!dev.mobile, hasTouch: !!dev.mobile, acceptDownloads: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(e.message));
  await serve(page);
  await page.goto("http://site.test/landfall", { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `${out}/lf-${dev.name}-empty.png` });
  check(await page.locator("#lf-prompt").isVisible(), "prompt shows on an empty sea");

  const box = await page.locator("#lf-viewport").boundingBox();
  const r = Math.min(box.width, box.height) * 0.28;
  await draw(page, blob(box.width / 2, box.height / 2, r));
  await page.waitForTimeout(2600);
  await page.screenshot({ path: `${out}/lf-${dev.name}-charted.png` });
  const url1 = page.url();
  check(/\?i=[\w-]+/.test(url1), "address bar carries the island");
  const places = await page.locator("#lf-chart .place").count();
  check(places >= 5, `chart has named places (${places})`);
  const gzCount = await page.locator("#lf-gz .gz-entry").count();
  check(gzCount >= 5, `gazetteer lists them (${gzCount})`);

  // Open the island's entry and rename it.
  await page.locator('#lf-gz .gz-show[data-show="island"]').click();
  await page.waitForTimeout(900);
  check(await page.locator("#lf-panel").isVisible(), "clicking a name opens the panel");
  await page.fill("#lf-rename-input", "Guilherme's Rock");
  await page.click(".lf-rename button");
  await page.waitForTimeout(300);
  const label = await page.locator('#lf-chart .place[data-place="island"] text').textContent();
  check(label === "GUILHERME'S ROCK", `rename shows on the chart (${label})`);
  check(/&n=/.test(page.url()), "renames travel in the link");
  await page.screenshot({ path: `${out}/lf-${dev.name}-panel.png` });
  await page.keyboard.press("Escape");

  // Click a label on the chart itself.
  const town = page.locator('#lf-chart .place[data-place="town"] text');
  if (await town.count()) {
    const tb = await town.boundingBox();
    await page.mouse.click(tb.x + tb.width / 2, tb.y + tb.height / 2);
    await page.waitForTimeout(900);
    check((await page.locator("#lf-panel .panel-kind").textContent()) === "Town", "tapping a town label opens its entry");
    await page.keyboard.press("Escape");
  }

  // Another island.
  await page.click('.lf-tools button[data-act="add"]');
  await page.waitForTimeout(900);
  check(await page.locator("#lf-adding-hint").isVisible(), "adding mode shows its hint");
  const b2 = await page.locator("#lf-viewport").boundingBox();
  const corner = dev.mobile ? [b2.width * 0.5, b2.height * 0.86] : [b2.width * 0.86, b2.height * 0.8];
  await draw(page, blob(corner[0], corner[1], Math.min(b2.width, b2.height) * 0.07, 40));
  await page.waitForTimeout(2600);
  const url2 = page.url();
  check(url2 !== url1, "second island changes the link");
  await page.screenshot({ path: `${out}/lf-${dev.name}-two.png` });

  // Send it to the atlas. The harbour's server isn't here, so answer for it,
  // and check the page sends only the island and its name.
  let sent = null;
  await page.route("http://site.test/api/report", (route) => {
    sent = JSON.parse(route.request().postData() || "{}");
    route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ ref: reportRef(sent.i) }) });
  });
  await page.click('.lf-tools button[data-act="report"]');
  await page.waitForTimeout(500);
  check((await page.locator("#lf-panel .panel-title").textContent()) === "Send it to Elsewhere", "the report panel opens");
  check(await page.locator("#lf-panel .lf-rename").isHidden(), "without the rename form");
  await page.screenshot({ path: `${out}/lf-${dev.name}-report.png` });
  await page.click(".lf-report-send");
  await page.waitForTimeout(400);
  const code = new URL(page.url()).searchParams.get("i");
  check(sent && sent.i === code && Object.keys(sent).sort().join() === "i,name", `the report carries only the island and its name (${sent && Object.keys(sent)})`);
  const status = await page.locator(".lf-report-status").textContent();
  check(status.includes(reportRef(code)), `and shows its report number (${status.slice(0, 40)}…)`);
  await page.keyboard.press("Escape");

  // An island that has been charted says so when its link is opened.
  const seen = await ctx.newPage();
  await serve(seen);
  await seen.route("http://site.test/atlas/sightings.json", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ [reportRef(code)]: { id: "ed-test", name: "Test Isle", day: 9 } }) })
  );
  await seen.goto(page.url(), { waitUntil: "networkidle" });
  await seen.waitForTimeout(2200);
  check(await seen.locator("#lf-sighted").isVisible(), "a charted island's link shows the sighting");
  check((await seen.locator("#lf-sighted a").getAttribute("href")) === "/atlas#ed-test", "with a link to it on the map");
  await seen.screenshot({ path: `${out}/lf-${dev.name}-sighted.png` });
  await seen.close();

  // The link alone rebuilds the chart.
  const names = await page.locator("#lf-gz .gz-name").allTextContents();
  const fresh = await ctx.newPage();
  await serve(fresh);
  await fresh.goto(url2, { waitUntil: "networkidle" });
  await fresh.waitForTimeout(600);
  const names2 = await fresh.locator("#lf-gz .gz-name").allTextContents();
  check(JSON.stringify(names) === JSON.stringify(names2), "a shared link rebuilds the same island");
  await fresh.close();

  // Save an image.
  const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 20000 }), page.click('.lf-tools button[data-act="save"]')]);
  const file = `${out}/lf-${dev.name}-saved.png`;
  await dl.saveAs(file);
  check(/guilherme/.test(dl.suggestedFilename()), `saves a PNG named after the island (${dl.suggestedFilename()})`);

  // New names, then start over.
  await page.click('.lf-tools button[data-act="reroll"]');
  await page.waitForTimeout(400);
  await page.click('.lf-tools button[data-act="clear"]');
  await page.click('.lf-tools button[data-act="clear"]');
  await page.waitForTimeout(300);
  check(await page.locator("#lf-prompt").isVisible(), "start over returns to the empty sea");
  check(!/\?i=/.test(page.url()), "and clears the link");

  // A bad link is survived politely.
  await page.goto("http://site.test/landfall?i=nonsense!!", { waitUntil: "networkidle" });
  check(await page.locator("#lf-prompt").isVisible(), "a broken link falls back to the empty sea");

  check(errors.length === 0, `no console errors${errors.length ? ": " + errors.join(" | ") : ""}`);
  await ctx.close();
}
await browser.close();
if (fails.length) {
  console.log(`\n${fails.length} failed`);
  process.exit(1);
}
console.log("\nall good");
