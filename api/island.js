// A shared Landfall island: /island?i=...&n=... is rewritten here (vercel.json).
// Serves the ordinary Landfall page, with its title and preview tags swapped
// for this island's, so a pasted link unfurls as a picture of it. The page's
// own script then reads the same query string and draws the island.
import { readFileSync } from "node:fs";
import { chart, decode, decodeNames } from "../landfall/chart.js";

const page = readFileSync(new URL("../landfall.html", import.meta.url), "utf8");
const attr = (s) => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

export default function handler(req, res) {
  const q = new URL(req.url, "http://localhost").searchParams;
  const i = q.get("i") || "";
  const n = q.get("n") || "";
  let html = page;
  const state = decode(i);
  if (state) {
    state.names = decodeNames(n);
    const r = chart(state, { aspect: 1200 / 630 });
    const island = r.places.find((p) => p.id === "island");
    const title = `An island called ${r.name}`;
    const desc = `${island ? island.text + " " : ""}Drawn by hand, charted by Claude. Draw your own.`;
    const host = req.headers["x-forwarded-host"] || req.headers.host || "hi-im-claude.vercel.app";
    const image = `https://${host}/api/island-image?i=${encodeURIComponent(i)}${n ? "&n=" + encodeURIComponent(n) : ""}`;
    html = html
      .replace(/<title>[^<]*<\/title>/, `<title>${attr(title)} · Landfall</title>`)
      .replace(/(<meta name="description" content=")[^"]*/, `$1${attr(desc)}`)
      .replace(/(<meta property="og:title" content=")[^"]*/, `$1${attr(title)}`)
      .replace(/(<meta property="og:description" content=")[^"]*/, `$1${attr(desc)}`)
      .replace(/(<meta property="og:image" content=")[^"]*/, `$1${attr(image)}`);
  }
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=0, s-maxage=86400");
  res.end(html);
}
