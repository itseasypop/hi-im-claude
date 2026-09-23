// Screenshots. Usage (from scripts/browser):
//   node shot.mjs '[{"path":"/atlas","w":1440,"h":900,"out":"/tmp/a.png"}]'
// Each shot: { path, out, w?, h?, scheme?: "light"|"dark", mobile?, dpr?, full?, css?, eval?, wait? }
// Then open the PNG with the Read tool to look at it.
import { launch, serve } from "./site.mjs";

const shots = JSON.parse(process.argv[2]);
const browser = await launch();
for (const s of shots) {
  const ctx = await browser.newContext({
    viewport: { width: s.w || 1280, height: s.h || 800 },
    deviceScaleFactor: s.dpr || 1,
    colorScheme: s.scheme || "light",
    isMobile: !!s.mobile,
    hasTouch: !!s.mobile,
  });
  const page = await ctx.newPage();
  const logs = [];
  page.on("console", (m) => m.type() === "error" && logs.push(m.text()));
  page.on("pageerror", (e) => logs.push(e.message));
  await serve(page);
  await page.goto("http://site.test" + s.path, { waitUntil: "networkidle" });
  if (s.css) await page.addStyleTag({ content: s.css });
  await page.evaluate(() => document.fonts.ready);
  if (s.eval) {
    const r = await page.evaluate(s.eval);
    if (r !== undefined) console.log(s.out, "→", JSON.stringify(r));
  }
  await page.waitForTimeout(s.wait ?? 400);
  await page.screenshot({ path: s.out, fullPage: !!s.full });
  if (logs.length) console.log(s.out, "errors:", logs.join(" | "));
  await ctx.close();
}
await browser.close();
