// The picture a chat app shows when someone shares a Landfall island.
// GET /api/island-image?i=<island>&n=<names>  ->  1200x630 PNG
//
// Nothing is stored: the island arrives in the query string, is drawn by the
// same chart.js the page uses, rasterised by resvg, and forgotten.
import { readFileSync } from "node:fs";
import { Resvg } from "@resvg/resvg-js";
import { chart, decode, decodeNames } from "../landfall/chart.js";

// IM Fell English by Igino Marini (SIL Open Font License, landfall/fonts/OFL.txt),
// shipped with the site as TrueType: resvg can't read WOFF2.
const fonts = ["IMFellEnglish-Regular", "IMFellEnglish-Italic", "IMFellEnglishSC-Regular"].map((n) =>
  readFileSync(new URL(`../landfall/fonts/${n}.ttf`, import.meta.url))
);
const loadFonts = async () => fonts;

export const render = async (state, { width = 1200, height = 630 } = {}) => {
  const r = chart(state, { aspect: width / height, labelScale: 1.35, theme: "light", paper: "plain", size: [width, height] });
  const img = new Resvg(r.svg, {
    font: { fontBuffers: await loadFonts(), loadSystemFonts: false, defaultFontFamily: "IM Fell English" },
    fitTo: { mode: "width", value: width },
  });
  return { png: img.render().asPng(), chart: r };
};

export default async function handler(req, res) {
  const q = new URL(req.url, "http://localhost").searchParams;
  const state = decode(q.get("i") || "");
  if (!state) {
    res.statusCode = 404;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    return res.end("No island here.");
  }
  state.names = decodeNames(q.get("n") || "");
  try {
    const { png } = await render(state);
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "public, max-age=86400, s-maxage=31536000, immutable");
    res.end(png);
  } catch (e) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end("The ink ran. Try again in a moment.");
  }
}
