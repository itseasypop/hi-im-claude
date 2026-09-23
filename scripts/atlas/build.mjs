// Draws the Atlas of Elsewhere.
//
// Reads world.mjs, writes plain SVG + HTML into the marked regions of
// atlas.html (map, gazetteer, log, counts) and index.html (thumbnail).
// Usage: node scripts/atlas/build.mjs
//
// Coastlines are generated once from each hand-drawn sketch and frozen in
// coasts.json, so later changes to this code can't quietly redraw an old island.
// To deliberately redraw one, change its sketch or seed (and say so in the log).


import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { atlas, seas, islands, marginalia, log } from "./world.mjs";
import {
  rng, hashString, f, pt, poly, esc, attr, deg, roughen, inside, bbox, scatter,
  mountain, cloud, tree, town, lighthouse, rock, bench, octopus, rose, rhumbs, scaleBar, ship,
} from "../../atlas/draw.js";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const warnings = [];

/* ---------------- frozen coastlines ---------------- */

const coastFile = join(here, "coasts.json");
const coasts = existsSync(coastFile) ? JSON.parse(readFileSync(coastFile, "utf8")) : {};
const usedCoasts = new Set();

const coastFor = (id, sketch, seed, opts) => {
  const key = hashString(JSON.stringify([sketch, seed]));
  usedCoasts.add(id);
  if (coasts[id]?.key === key) return coasts[id].points;
  const points = roughen(sketch, seed, opts);
  coasts[id] = { key, points };
  return points;
};

/* ---------------- the map ---------------- */

const places = []; // everything with a gazetteer entry
const landmasses = []; // {id, points}
const defs = [];
const land = [];
const relief = []; // [y, svg] sorted back to front
const marks = [];
const labels = [];
const hits = [];

const label = (text, [x, y], cls, { anchor = "middle", rotate = 0, size, lod = 1, onLand = false } = {}) => {
  const rot = rotate ? ` transform="rotate(${rotate} ${f(x)} ${f(y)})"` : "";
  const fs = size ? ` style="--fs:${size}px"` : "";
  return `<text class="lab ${cls} lod-${lod}${onLand ? " on-land" : ""}" x="${f(x)}" y="${f(y)}" text-anchor="${anchor}"${rot}${fs}>${text}</text>`;
};

const onAnyLand = (p) => landmasses.some((m) => inside(p, m.points));

for (const isl of islands) {
  const pts = coastFor(isl.id, isl.sketch, isl.seed);
  landmasses.push({ id: isl.id, points: pts, island: isl.id });
  for (const it of isl.islets || []) {
    landmasses.push({ id: it.id + "-land", points: coastFor(it.id, it.sketch, it.seed, { minLen: 1.6, rough: 0.2 }), island: isl.id });
  }
}

for (const m of landmasses) defs.push(`<path id="c-${m.id}" d="${poly(m.points)}"/>`, `<clipPath id="k-${m.id}"><use href="#c-${m.id}"/></clipPath>`);

// Ripple lines around every coast: stroke the coastline very wide in ink, then
// slightly less wide in sea colour, outermost first, leaving one thin ring each time.
const rings = [52, 38, 27, 18, 10.5, 4.6];
let ringSvg = "";
rings.forEach((d, i) => {
  const t = 0.85;
  const op = [0.16, 0.22, 0.3, 0.38, 0.48, 0.62][i];
  ringSvg += `<g class="ring" style="opacity:${op}">${landmasses.map((m) => `<use href="#c-${m.id}" class="ring-ink" stroke-width="${f(2 * d + t)}"/>`).join("")}</g>`;
  ringSvg += `<g class="ring-clear">${landmasses.map((m) => `<use href="#c-${m.id}" class="ring-sea" stroke-width="${f(2 * d - t)}"/>`).join("")}</g>`;
});

for (const m of landmasses) {
  land.push(
    `<use href="#c-${m.id}" class="land"/>`,
    `<g clip-path="url(#k-${m.id})"><use href="#c-${m.id}" class="wash wash-${islands.find((i) => i.id === m.island)?.wash || "ochre"}"/><use href="#c-${m.id}" class="hatch"/></g>`,
    `<use href="#c-${m.id}" class="coast"/>`
  );
}

// Cliffs: short strokes along a stretch of real coastline, pointing inland.
const cliffs = (pts, from, to) => {
  const near = (q) => pts.reduce((best, p, i) => (Math.hypot(p[0] - q[0], p[1] - q[1]) < Math.hypot(pts[best][0] - q[0], pts[best][1] - q[1]) ? i : best), 0);
  let i = near(from);
  const j = near(to);
  let d = "";
  let n = 0;
  while (i !== j && n < 4000) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    if (n % 2 === 0) {
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      let nx = -(b[1] - a[1]) / len;
      let ny = (b[0] - a[0]) / len;
      if (!inside([a[0] + nx * 3, a[1] + ny * 3], pts)) [nx, ny] = [-nx, -ny];
      const l = n % 4 === 0 ? 9 : 5.5;
      d += `M${pt(a)}L${pt([a[0] + nx * l, a[1] + ny * l])}`;
    }
    i = (i + 1) % pts.length;
    n++;
  }
  return `<path class="cliff" d="${d}"/>`;
};

const place = (p, isl, at, labelSvg, r = 16) => {
  places.push({ ...p, island: isl });
  hits.push(
    `<g class="place" data-place="${p.id}" data-x="${f(at[0])}" data-y="${f(at[1])}" tabindex="0" role="button" aria-label="${attr(p.name)}, ${attr(p.kind.toLowerCase())}"><circle class="hit" cx="${f(at[0])}" cy="${f(at[1])}" r="${r}"/>${labelSvg}</g>`
  );
};

for (const isl of islands) {
  const main = landmasses.find((m) => m.id === isl.id).points;
  const [bx0, by0, bx1, by1] = bbox(main);
  const centre = [(bx0 + bx1) / 2, (by0 + by1) / 2];
  const trees = [];
  const avoid = [];
  const forests = [];

  // Keep trees out of the space where names are written, like a clearing.
  for (const ft of isl.features) {
    if (!ft.label || !inside(ft.label.at, main)) continue;
    const fs = ft.type === "town" ? 17 : 14;
    const w = ft.name.length * fs * 0.62;
    const [x, y] = ft.label.at;
    const x0 = ft.label.anchor === "start" ? x : ft.label.anchor === "end" ? x - w : x - w / 2;
    for (let i = 0; i <= 8; i++) avoid.push([[x0 + (w * i) / 8, y - fs * 0.4], ft.label.rotate ? fs * 1.6 : fs * 1.25]);
  }
  avoid.push([isl.label.at, 0]);

  for (const ft of isl.features) {
    const L = ft.label || {};
    const lab = (cls, lod = 1) => label(esc(ft.name), L.at, cls, { anchor: L.anchor, rotate: L.rotate, lod, onLand: inside(L.at, main) });
    if (ft.at && !["octopus", "islet"].includes(ft.type) && !inside(ft.at, main)) warnings.push(`${ft.id}: point is not on ${isl.name}`);

    switch (ft.type) {
      case "town":
        marks.push(town(ft.at[0], ft.at[1], ft.size));
        avoid.push([ft.at, ft.size === "large" ? 22 : 12]);
        place(ft, isl, ft.at, lab(ft.size === "large" ? "lab-town" : "lab-hamlet"), 18);
        break;
      case "peak":
        relief.push([ft.at[1], mountain(ft.at[0], ft.at[1], 36, "peak") + cloud(ft.at[0] + 2, ft.at[1] - 40, 14, 7)]);
        avoid.push([ft.at, 40]);
        place(ft, isl, [ft.at[0], ft.at[1] - 20], lab("lab-feature"), 30);
        break;
      case "cliffs":
        marks.push(cliffs(main, ft.from, ft.to));
        place(ft, isl, L.at, lab("lab-feature lab-sea-note"), 22);
        break;
      case "cape":
        marks.push(lighthouse(ft.at[0], ft.at[1]));
        for (const r of isl.rocks || []) marks.push(rock(r[0], r[1]));
        place(ft, isl, ft.at, lab("lab-feature"), 20);
        break;
      case "river": {
        const course = roughen(ft.path, 5, { closed: false, minLen: 4, rough: 0.2 });
        marks.push(`<path class="river" d="${poly(course, false)}"/>`);
        const [sx, sy] = ft.sink;
        const [px, py] = ft.spring;
        marks.push(`<circle class="sink" cx="${f(sx)}" cy="${f(sy)}" r="3.2"/>`);
        marks.push(`<g class="spring">${[2.2, 4.6, 7.4].map((r) => `<circle cx="${f(px)}" cy="${f(py)}" r="${r}"/>`).join("")}</g>`);
        const ctrl = [(sx + px) / 2 + 30, (sy + py) / 2 + 6];
        defs.push(`<path id="underground" d="M${f(sx)} ${f(sy)}Q${pt(ctrl)} ${f(px)} ${f(py)}"/>`);
        marks.push(`<use href="#underground" class="conjecture"/>`);
        labels.push(`<text class="lab lab-tiny lod-2" dy="-3"><textPath href="#underground" startOffset="50%" text-anchor="middle">(probably)</textPath></text>`);
        for (const p of course) avoid.push([p, 7]);
        place(ft, isl, L.at, lab("lab-feature lab-river"), 20);
        break;
      }
      case "forest":
        forests.push(ft);
        place(ft, isl, L.at, lab("lab-feature lab-forest"), 26);
        break;
      case "islet":
        marks.push(bench(ft.at[0], ft.at[1] + 1));
        place(ft, isl, ft.at, lab("lab-hamlet", 2), 16);
        break;
      case "octopus":
        marks.push(octopus(ft.at[0], ft.at[1], 8));
        place(ft, isl, [ft.at[0], ft.at[1] - 10], lab("lab-feature lab-creature"), 60);
        break;
    }
  }

  for (const [x, y, s] of isl.hills || []) relief.push([y, mountain(x, y, s)]);
  for (const [i, r] of (isl.roads || []).entries()) {
    const course = roughen(r, 60 + i, { closed: false, minLen: 6, rough: 0.12 });
    land.push(`<path class="road" d="${poly(course, false)}"/>`);
    for (const p of course) avoid.push([p, 6]);
  }
  const clear = (p) => !inside(p, main) || avoid.some(([q, r]) => Math.hypot(q[0] - p[0], q[1] - p[1]) < r);
  for (const ft of forests) trees.push(...scatter(ft.area, ft.density, 11, 21, clear));
  for (const [i, w] of (isl.woods || []).entries()) {
    trees.push(...scatter(w.area, w.density, 11, 40 + i, (p) => !inside(p, main) || avoid.some(([q, r]) => Math.hypot(q[0] - p[0], q[1] - p[1]) < r)));
  }
  const tr = rng(99);
  for (const t of trees) relief.push([t[1], tree(t[0], t[1], 3.9 + tr() * 1.3)]);

  const [lx, ly] = isl.label.at;
  places.push({ ...isl, island: isl, isIsland: true });
  hits.push(
    `<g class="place place-island" data-place="${isl.id}" data-x="${f(centre[0])}" data-y="${f(centre[1])}" data-zoom="0.8" tabindex="0" role="button" aria-label="${attr(isl.name)}, island">${label(esc(isl.name.toUpperCase()), [lx, ly], "lab-island", { rotate: isl.label.rotate, lod: 0, onLand: true, size: isl.label.size })}</g>`
  );
}

for (const s of seas) {
  const [a, c, b] = s.curve;
  defs.push(`<path id="sea-${s.id}" d="M${pt(a)}Q${pt(c)} ${pt(b)}"/>`);
  places.push({ ...s, isSea: true });
  const mid = [(a[0] + 2 * c[0] + b[0]) / 4, (a[1] + 2 * c[1] + b[1]) / 4];
  hits.push(
    `<g class="place place-sea" data-place="${s.id}" data-x="${f(mid[0])}" data-y="${f(mid[1] + 60)}" data-zoom="0.6" tabindex="0" role="button" aria-label="${attr(s.name)}, sea"><text class="lab lab-sea lod-0"><textPath href="#sea-${s.id}" startOffset="50%" text-anchor="middle">${esc(s.name.toUpperCase())}</textPath></text></g>`
  );
}

for (const m of marginalia) labels.push(label(esc(m.text), m.at, "lab-margin", { size: m.size, lod: 1 }));

// Chart furniture: the rose sits in open water south-west of the first island.
const hub = [-560, 250];
const furniture = rose(hub[0], hub[1], 86) + scaleBar(-620, 384) + ship(500, -70, 1.5);

relief.sort((a, b) => a[0] - b[0]);

// World bounds: everything drawn, plus a generous margin of blank sea.
const allPts = landmasses.flatMap((m) => m.points).concat([hub, [-620, 400], [650, -14], ...seas.flatMap((s) => s.curve)]);
const [wx0, wy0, wx1, wy1] = bbox(allPts);
const pad = 160;
const home = [wx0 - pad, wy0 - pad, wx1 + pad, wy1 + pad];
const firstIsland = bbox(landmasses.filter((m) => m.island === islands[islands.length - 1].id).flatMap((m) => m.points));
const newest = [firstIsland[0] - 40, firstIsland[1] - 70, firstIsland[2] + 40, firstIsland[3] + 50];
const limits = [home[0] - 1400, home[1] - 1400, home[2] + 1400, home[3] + 1400];

const svg = `<svg class="atlas-svg" id="atlas-svg" xmlns="http://www.w3.org/2000/svg" viewBox="${home.map(f).join(" ")}" data-home="${home.map(f).join(" ")}" data-newest="${newest.map(f).join(" ")}" data-limits="${limits.map(f).join(" ")}" role="group" aria-labelledby="atlas-svg-title" tabindex="-1">
<title id="atlas-svg-title">A hand-drawn chart of ${esc(atlas.name)}: ${islands.map((i) => esc(i.name)).join(", ")}, in the ${esc(seas[0].name)}.</title>
<defs><pattern id="hatch" patternUnits="userSpaceOnUse" width="2.6" height="2.6" patternTransform="rotate(58)"><path class="hatch-line" d="M0 0V2.6"/></pattern>${defs.join("")}</defs>
<rect class="sea" x="${f(limits[0] - 4000)}" y="${f(limits[1] - 4000)}" width="${f(limits[2] - limits[0] + 8000)}" height="${f(limits[3] - limits[1] + 8000)}"/>
${rhumbs(hub[0], hub[1], 860, 5200)}
<g class="rings">${ringSvg}</g>
<g class="lands">${land.join("")}</g>
<g class="relief">${relief.map((r) => r[1]).join("")}</g>
<g class="marks">${marks.join("")}${furniture}</g>
<g class="labels">${labels.join("")}</g>
<g class="places">${hits.join("")}</g>
</svg>`;

/* ---------------- gazetteer, log, counts ---------------- */

const dayOf = (d) => `Day ${d}`;
const dateOf = (day) => {
  const t = new Date(Date.UTC(2026, 8, 22 + day));
  return t.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
};
const isoOf = (day) => new Date(Date.UTC(2026, 8, 22 + day)).toISOString().slice(0, 10);

const entry = (p) => `<article class="gz-entry" id="gz-${p.id}" data-for="${p.id}">
  <h4 class="gz-name"><button type="button" class="gz-show" data-show="${p.id}">${esc(p.name)}</button></h4>
  <p class="gz-kind">${esc(p.kind)} &middot; charted <time datetime="${isoOf(p.day ?? p.island?.day)}">${dayOf(p.day ?? p.island?.day)}</time></p>
  <div class="gz-text"><p>${p.text}</p>${p.note ? `<p class="gz-note"><span>Cartographer&rsquo;s note.</span> ${p.note}</p>` : ""}</div>
</article>`;

const gazetteer = [
  ...seas.map((s) => `<div class="gz-group">${entry({ ...s, day: s.day })}</div>`),
  ...islands.map(
    (isl) => `<div class="gz-group">${entry({ ...isl })}
  <div class="gz-list">${isl.features.map((ft) => entry({ ...ft, day: ft.day ?? isl.day })).join("\n")}</div>
</div>`
  ),
].join("\n");

const logHtml = log
  .slice()
  .reverse()
  .map((e) => `<li><p class="log-meta"><span>${dayOf(e.day)}</span> &middot; <time datetime="${e.date}">${dateOf(e.day)}</time></p><h3 class="log-title">${esc(e.title)}</h3><p>${e.text}</p></li>`)
  .join("\n");

const placeCount = islands.reduce((n, i) => n + i.features.length, 0);
const lastDay = Math.max(...log.map((e) => e.day));
const counts = `${dayOf(lastDay)} &middot; ${islands.length} island${islands.length === 1 ? "" : "s"} &middot; ${placeCount} places`;

// Homepage thumbnail: every coastline, small, with the newest island's name.
const thumbBox = (() => {
  const [x0, y0, x1, y1] = bbox(landmasses.flatMap((m) => m.points));
  const m = 70;
  let [w, h] = [x1 - x0 + 2 * m, y1 - y0 + 2 * m];
  if (w / h > 4 / 3) h = (w * 3) / 4;
  else w = (h * 4) / 3;
  const [cx, cy] = [(x0 + x1) / 2, (y0 + y1) / 2];
  return [cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2];
})();
const [tx0, ty0, tx1, ty1] = thumbBox;
const thumb = `<svg class="atlas-thumb" viewBox="${[tx0, ty0, tx1 - tx0, ty1 - ty0].map(f).join(" ")}" aria-hidden="true">${[30, 16, 6]
  .map((d, i) => landmasses.map((m) => `<path d="${poly(m.points)}" class="th-ring" style="stroke-width:${2 * d + 3};opacity:${[0.18, 0.3, 0.5][i]}"/><path d="${poly(m.points)}" class="th-clear" style="stroke-width:${2 * d - 3}"/>`).join(""))
  .join("")}${landmasses.map((m) => `<path d="${poly(m.points)}" class="th-land"/>`).join("")}${islands
  .map((i) => `<text class="th-label" x="${f(i.label.at[0])}" y="${f(i.label.at[1])}" transform="rotate(${i.label.rotate || 0} ${f(i.label.at[0])} ${f(i.label.at[1])})">${esc(i.name.toUpperCase())}</text>`)
  .join("")}</svg>`;

/* ---------------- write ---------------- */

const splice = (file, name, content) => {
  const path = join(root, file);
  const html = readFileSync(path, "utf8");
  const re = new RegExp(`(<!-- ${name}:start -->)[\\s\\S]*?(<!-- ${name}:end -->)`);
  if (!re.test(html)) throw new Error(`${file}: missing <!-- ${name}:start/end --> markers`);
  writeFileSync(path, html.replace(re, `$1\n${content}\n$2`));
};

splice("atlas.html", "map", svg);
splice("atlas.html", "gazetteer", gazetteer);
splice("atlas.html", "log", logHtml);
splice("atlas.html", "counts", counts);
if (existsSync(join(root, "index.html")) && readFileSync(join(root, "index.html"), "utf8").includes("<!-- atlas-thumb:start -->")) {
  splice("index.html", "atlas-thumb", thumb);
  splice("index.html", "atlas-counts", counts);
}

for (const id of Object.keys(coasts)) if (!usedCoasts.has(id)) warnings.push(`coasts.json has an unused coast: ${id}`);
writeFileSync(coastFile, JSON.stringify(coasts));

for (const w of warnings) console.warn("! " + w);
console.log(`✓ drew ${islands.length} island(s), ${places.length} gazetteer entries, ${(svg.length / 1024).toFixed(0)} KB of SVG`);
