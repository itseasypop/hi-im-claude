// Landfall: turns a hand-drawn outline into a chart in the Elsewhere style.
//
// chart(state, opts) is a pure function: the same drawing and seed always give
// the same island, names and layout, in the browser or in Node. The page
// (landfall.js) calls it on every change; the share-image function on the
// server calls it too. Glyphs come from /atlas/draw.js, shared with the atlas.
//
// state = { seed, day, islands: [sketch, ...], names: { placeId: "New name" } }
// A sketch is a list of integer [x, y] points in world units (y grows south).
// The first island drawn sets the scale; see normalizer() and prepare().

import {
  rng, hashString, f, pt, poly, chaikin, roughen, inside, bbox,
  mountain, cloud, tree, town, lighthouse, rock, waves, octopus, rose, rhumbs, scaleBar, ship, deg,
} from "../atlas/draw.js";
import * as pools from "./names.js";

const C = 8; // grid cell, world units
const LEAGUE = 2.4; // world units per league, as on the atlas's scale bar
export const SITE = "hi-im-claude.vercel.app/landfall";

/* ---------------- small geometry ---------------- */

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const unit = (v) => {
  const l = Math.hypot(v[0], v[1]) || 1;
  return [v[0] / l, v[1] / l];
};
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const signedArea = (p) => {
  let a = 0;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) a += p[j][0] * p[i][1] - p[i][0] * p[j][1];
  return a / 2;
};
export const areaOf = (p) => Math.abs(signedArea(p));
const perimeter = (p) => p.reduce((s, q, i) => s + dist(q, p[(i + 1) % p.length]), 0);

const resample = (pts, step) => {
  const out = [pts[0]];
  let acc = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const len = dist(a, b);
    let pos = 0;
    while (len > 0 && acc + (len - pos) >= step) {
      pos += step - acc;
      out.push(lerp(a, b, pos / len));
      acc = 0;
    }
    acc += len - pos;
  }
  if (out.length > 2 && dist(out[out.length - 1], out[0]) < step * 0.5) out.pop();
  return out;
};

const rdp = (pts, eps) => {
  if (pts.length < 3) return pts.slice();
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [s, e] = stack.pop();
    const [ax, ay] = pts[s];
    const [bx, by] = pts[e];
    const L = Math.hypot(bx - ax, by - ay);
    let md = 0;
    let mi = -1;
    for (let i = s + 1; i < e; i++) {
      const d = L ? Math.abs((bx - ax) * (ay - pts[i][1]) - (ax - pts[i][0]) * (by - ay)) / L : dist(pts[i], pts[s]);
      if (d > md) [md, mi] = [d, i];
    }
    if (md > eps) {
      keep[mi] = 1;
      stack.push([s, mi], [mi, e]);
    }
  }
  return pts.filter((_, i) => keep[i]);
};

const overlaps = (a, b) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
const grow = (r, m) => [r[0] - m, r[1] - m, r[2] + m, r[3] + m];
const union = (boxes) => [
  Math.min(...boxes.map((b) => b[0])),
  Math.min(...boxes.map((b) => b[1])),
  Math.max(...boxes.map((b) => b[2])),
  Math.max(...boxes.map((b) => b[3])),
];

const xml = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/* ---------------- from a stroke to a sketch ---------------- */

// The first stroke is scaled so every island comes out about the same size
// (glyphs are drawn at a fixed size), and centred on the origin.
export function normalizer(points, target = 470, maxDim = 1100) {
  const A = Math.abs(signedArea(points));
  const [x0, y0, x1, y1] = bbox(points);
  const s = Math.min(target / Math.sqrt(Math.max(A, 1)), maxDim / Math.max(x1 - x0, y1 - y0, 1));
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  return { s, cx, cy, map: (p) => [(p[0] - cx) * s, (p[1] - cy) * s] };
}

// Simplify a stroke (world units) into a compact integer sketch, or null if
// there's nothing there to stand on.
export function prepare(points) {
  let p = points.filter((q, i) => i === 0 || dist(q, points[i - 1]) >= 1);
  if (p.length < 6) return null;
  let k = 0;
  let md = 0;
  p.forEach((q, i) => {
    const d = dist(q, p[0]);
    if (d > md) [md, k] = [d, i];
  });
  p = [...rdp(p.slice(0, k + 1), 2.2).slice(0, -1), ...rdp(p.slice(k), 2.2)];
  if (p.length > 3 && dist(p[0], p[p.length - 1]) < 6) p.pop();
  const q = [];
  for (let i = 0; i < p.length; i++) {
    const a = p[i];
    const b = p[(i + 1) % p.length];
    q.push(a);
    const n = Math.ceil(dist(a, b) / 90);
    for (let s = 1; s < n; s++) q.push(lerp(a, b, s / n));
  }
  let out = [];
  for (const [x, y] of q) {
    const r = [Math.round(x), Math.round(y)];
    const l = out[out.length - 1];
    if (!l || l[0] !== r[0] || l[1] !== r[1]) out.push(r);
  }
  if (out.length > 3 && out[0][0] === out[out.length - 1][0] && out[0][1] === out[out.length - 1][1]) out.pop();
  if (out.length < 5 || Math.abs(signedArea(out)) < 150) return null;
  if (signedArea(out) < 0) out.reverse();
  if (out.length > 400) out = out.filter((_, i) => i % Math.ceil(out.length / 400) === 0);
  return out;
}

/* ---------------- sharing: the whole island fits in a link ---------------- */

const b64 = (bytes) => {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const unb64 = (s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

export const today = () => Math.floor(Date.now() / 86400000);

export function encode({ seed, day, islands }) {
  const bytes = [1, (seed >> 16) & 255, (seed >> 8) & 255, seed & 255, (day >> 8) & 255, day & 255, islands.length];
  for (const sk of islands) {
    const n = sk.length;
    bytes.push((n >> 8) & 255, n & 255);
    const [x0, y0] = sk[0];
    bytes.push((x0 >> 8) & 255, x0 & 255, (y0 >> 8) & 255, y0 & 255);
    for (let i = 1; i < n; i++) {
      bytes.push(clamp(sk[i][0] - sk[i - 1][0], -127, 127) & 255, clamp(sk[i][1] - sk[i - 1][1], -127, 127) & 255);
    }
  }
  return b64(bytes);
}

export function decode(code) {
  try {
    const b = unb64(code);
    if (b[0] !== 1 || b.length < 7) return null;
    const s8 = (v) => (v > 127 ? v - 256 : v);
    const s16 = (hi, lo) => ((hi << 8) | lo) << 16 >> 16;
    const seed = (b[1] << 16) | (b[2] << 8) | b[3];
    const day = (b[4] << 8) | b[5];
    const count = b[6];
    const islands = [];
    let o = 7;
    for (let k = 0; k < count && k < 12; k++) {
      const n = (b[o] << 8) | b[o + 1];
      if (n < 3 || n > 400 || o + 6 + (n - 1) * 2 > b.length) return null;
      let x = s16(b[o + 2], b[o + 3]);
      let y = s16(b[o + 4], b[o + 5]);
      o += 6;
      const sk = [[x, y]];
      for (let i = 1; i < n; i++, o += 2) {
        x += s8(b[o]);
        y += s8(b[o + 1]);
        sk.push([x, y]);
      }
      islands.push(sk);
    }
    return islands.length ? { seed, day, islands } : null;
  } catch (e) {
    return null;
  }
}

export const encodeNames = (names) => {
  const keys = Object.keys(names || {});
  if (!keys.length) return "";
  return b64(new TextEncoder().encode(JSON.stringify(names)));
};

export const decodeNames = (s) => {
  try {
    const o = JSON.parse(new TextDecoder().decode(unb64(s)));
    const out = {};
    for (const [k, v] of Object.entries(o)) if (/^[a-z0-9-]{1,16}$/.test(k) && typeof v === "string") out[k] = v.slice(0, 40);
    return out;
  } catch (e) {
    return {};
  }
};

/* ---------------- lettering ---------------- */

// Rough advance widths for IM Fell English, in ems. Good enough to keep
// labels from colliding; the real text is set by the browser (or resvg).
const widthOf = (s, size, { caps = false, italic = false, spacing = 0 } = {}) => {
  let w = 0;
  for (const ch of s) {
    if (ch === " ") w += 0.25;
    else if (caps) w += /[MW]/.test(ch) ? 0.9 : /[IJ]/.test(ch) ? 0.36 : 0.68;
    else if (/[MW]/.test(ch)) w += 0.86;
    else if (/[A-Z]/.test(ch)) w += 0.66;
    else if (/[mw]/.test(ch)) w += 0.7;
    else if (/[iljtfr'’.,:;!-]/.test(ch)) w += 0.28;
    else w += 0.45;
  }
  if (italic) w *= 0.9;
  return (w + spacing * [...s].length) * size;
};

const DIRS = ["east", "south-east", "south", "south-west", "west", "north-west", "north", "north-east"];
const DIRN = ["eastern", "south-eastern", "southern", "south-western", "western", "north-western", "northern", "north-eastern"];
const dirIndex = (dx, dy) => ((Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) % 8) + 8) % 8;

/* ---------------- colours ---------------- */

export const THEMES = {
  light: { sea: "#efe3c7", land: "#f8efdc", ink: "#3b2d20", soft: "rgba(59,45,32,0.62)", red: "#a8432a", green: "#56693f", ochre: "#dcb775", gold: "#c98f2a", river: "#4d6f86", tree: "#e2e4c3", cloud: "#fdf9f0", octo: "#ecc6ac", scale: "#cfd8b8" },
  dark: { sea: "#1b1814", land: "#27221b", ink: "#e7d9bf", soft: "rgba(231,217,191,0.62)", red: "#e58c65", green: "#a9ba8a", ochre: "#7c5f33", gold: "#e9b95f", river: "#8db4c8", tree: "#36402c", cloud: "#342e26", octo: "#5b3a2c", scale: "#3c4430" },
};

const FELL = "'IM Fell English', 'Iowan Old Style', Georgia, serif";
const FELL_SC = "'IM Fell English SC', 'IM Fell English', Georgia, serif";

// The chart carries its own stylesheet so it looks the same inline on the
// page, saved as an image, or rasterised on the server. Plain selectors and
// literal colours only (resvg understands those).
export const sheet = (t) => `
.lf .sea{fill:${t.sea}}
.lf .rh{fill:none;stroke-width:0.8}
.lf .rh-0{stroke:${t.ink};opacity:0.15}
.lf .rh-1{stroke:${t.green};opacity:0.24}
.lf .rh-2{stroke:${t.red};opacity:0.2}
.lf .ring-ink{fill:none;stroke:${t.ink};stroke-linejoin:round}
.lf .ring-sea{fill:none;stroke:${t.sea};stroke-linejoin:round}
.lf .land{fill:${t.land}}
.lf .wash{fill:none;stroke:${t.ochre};stroke-width:24;stroke-linejoin:round;opacity:0.55}
.lf .hatch{fill:none;stroke:${t.ink};stroke-width:5;stroke-dasharray:0.6 2.8;opacity:0.22}
.lf .coast{fill:none;stroke:${t.ink};stroke-width:1.35;stroke-linejoin:round}
.lf .hatch-line{stroke:${t.ink};stroke-width:0.55}
.lf .mtn-body{fill:${t.land}}
.lf .mtn-shade{fill:url(#lf-hatch)}
.lf .mtn-line{fill:none;stroke:${t.ink};stroke-width:1;stroke-linejoin:round;stroke-linecap:round}
.lf .peak-line{stroke-width:1.35}
.lf .mtn-foot{stroke:${t.ink};stroke-width:0.8;opacity:0.55;stroke-linecap:round}
.lf .cloud-edge{fill:${t.ink};stroke:${t.ink};stroke-width:2.4}
.lf .cloud-fill{fill:${t.cloud}}
.lf .tree-trunk{stroke:${t.ink};stroke-width:0.8}
.lf .tree-crown{fill:${t.tree};stroke:${t.ink};stroke-width:0.75}
.lf .tree-shade{fill:none;stroke:${t.ink};stroke-width:1.1;opacity:0.5}
.lf .tree-foot{stroke:${t.ink};stroke-width:0.7;opacity:0.4}
.lf .bldg{fill:${t.land};stroke:${t.ink};stroke-width:0.7;stroke-linejoin:round}
.lf .roof{fill:${t.red};stroke:${t.ink};stroke-width:0.6;stroke-linejoin:round}
.lf .ink-thin{fill:none;stroke:${t.ink};stroke-width:0.7;stroke-linecap:round}
.lf .rays{stroke:${t.gold};stroke-width:1.1;stroke-linecap:round}
.lf .band{fill:${t.red}}
.lf .lamp{fill:${t.gold};stroke:${t.ink};stroke-width:0.6}
.lf .rock{stroke:${t.ink};stroke-width:0.8}
.lf .dot{fill:${t.ink}}
.lf .road{fill:none;stroke:${t.ink};stroke-width:0.9;stroke-dasharray:3.2 2.6;stroke-linecap:round;opacity:0.55}
.lf .river{fill:none;stroke:${t.river};stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}
.lf .lake{fill:${t.sea};stroke:${t.ink};stroke-width:1.1;stroke-linejoin:round}
.lf .lake-ring{fill:none;stroke:${t.river};stroke-width:0.7;opacity:0.7}
.lf .arm-body{fill:${t.octo};stroke:${t.ink};stroke-width:0.8;stroke-linejoin:round}
.lf .mantle{fill:${t.octo};stroke:${t.ink};stroke-width:1.1;stroke-linejoin:round}
.lf .mantle-shade{fill:url(#lf-hatch);opacity:0.8}
.lf .sucker{fill:${t.land};stroke:${t.ink};stroke-width:0.35}
.lf .eye{fill:${t.land};stroke:${t.ink};stroke-width:0.7}
.lf .pupil{stroke:${t.ink};stroke-width:1.4;stroke-linecap:round}
.lf .wave{fill:none;stroke:${t.ink};stroke-width:0.8;stroke-linecap:round;opacity:0.5}
.lf .whale-body{fill:${t.cloud};stroke:${t.ink};stroke-width:1.1;stroke-linejoin:round}
.lf .whale-shade{fill:url(#lf-hatch);opacity:0.9}
.lf .spout{fill:none;stroke:${t.river};stroke-width:1.1;stroke-linecap:round}
.lf .scales{fill:${t.scale};stroke:${t.ink};stroke-width:1;stroke-linejoin:round}
.lf .fin{fill:${t.red};stroke:${t.ink};stroke-width:0.7;stroke-linejoin:round}
.lf .rose-disc{fill:${t.land};opacity:0.55}
.lf .rose-ring{fill:none;stroke:${t.ink};stroke-width:0.9}
.lf .rose-ring-thin{fill:none;stroke:${t.ink};stroke-width:0.5;opacity:0.7}
.lf .rose-ticks{stroke:${t.ink};stroke-width:0.5}
.lf .pt-dark{stroke:${t.ink};stroke-width:0.6;stroke-linejoin:round}
.lf .pt-light{fill:${t.land};stroke:${t.ink};stroke-width:0.6;stroke-linejoin:round}
.lf .t0{fill:${t.ink}}
.lf .t1{fill:${t.green}}
.lf .t2{fill:${t.red}}
.lf .t3{fill:${t.soft}}
.lf .rose-hub{fill:${t.red};stroke:${t.ink};stroke-width:0.6}
.lf .fleur{fill:${t.red};stroke:${t.ink};stroke-width:0.5;stroke-linejoin:round}
.lf .sb-dark{fill:${t.ink}}
.lf .sb-light{fill:${t.land};stroke:${t.ink};stroke-width:0.6}
.lf .sb-num{font-family:${FELL};font-size:9px;fill:${t.ink}}
.lf .sb-title{font-family:${FELL};font-size:11px;font-style:italic;fill:${t.ink}}
.lf .sail{fill:${t.cloud};stroke:${t.ink};stroke-width:0.7;stroke-linejoin:round}
.lf .flag{fill:${t.red}}
.lf .wake{fill:none;stroke:${t.ink};stroke-width:0.7;stroke-dasharray:2 3;opacity:0.45}
.lf .lab{font-family:${FELL};fill:${t.ink};paint-order:stroke;stroke:${t.sea};stroke-width:3.2px;stroke-linejoin:round}
.lf .lab-l{stroke:${t.land}}
.lf .lab-island{font-family:${FELL_SC};letter-spacing:0.3em;stroke-width:4px}
.lf .lab-sea{font-style:italic;letter-spacing:0.42em;fill:${t.soft}}
.lf .lab-town{fill:${t.red}}
.lf .lab-feature{font-style:italic}
.lf .hit{fill:#000;fill-opacity:0}
.lf .ct-bg{fill:${t.land};stroke:${t.ink};stroke-width:1.1}
.lf .ct-rule{fill:none;stroke:${t.ink};stroke-width:0.7}
.lf .ct-k{font-family:${FELL};font-style:italic;fill:${t.ink}}
.lf .ct-t{font-family:${FELL_SC};fill:${t.ink};letter-spacing:0.08em}
.lf .ct-m{font-family:${FELL_SC};fill:${t.red};letter-spacing:0.14em}
`;

/* ---------------- new glyphs: a whale and a sea serpent ---------------- */

// A right whale in the old style: spouting, a little too pleased with itself.
const whale = (x, y, k = 1, flip = false) => {
  const g = (d) => d.replace(/(-?\d+\.?\d*) (-?\d+\.?\d*)/g, (_, a, b) => `${f(x + (flip ? -a : +a) * k)} ${f(y + b * k)}`);
  const body = "M-46 -2 C-30 -16 -2 -24 26 -22 C44 -21 60 -14 64 -2 C66 6 60 12 50 13 C30 16 6 16 -14 12 C-28 9 -40 5 -46 2 Z";
  const tail = "M-44 0 C-54 -3 -62 -12 -70 -24 C-70 -16 -67 -9 -62 -5 C-70 -6 -78 -2 -86 6 C-74 4 -62 4 -46 3 Z";
  const shade = "M-14 12 C6 16 30 16 50 13 C58 12 63 8 64 3 C52 8 30 10 6 9 C-8 9 -18 8 -26 6 C-22 9 -18 11 -14 12 Z";
  const fin = "M14 11 C12 18 6 24 -2 27 C4 20 6 15 6 12 Z";
  const lines = "M34 5 Q46 8 58 4 M-6 12 Q8 14 22 13 M2 15 Q12 16 24 15";
  const spout = "M42 -21 C40 -32 32 -38 24 -40 M42 -21 C44 -32 52 -38 60 -40 M42 -21 L42 -44";
  return `<g class="whale"><path class="spout" d="${g(spout)}"/><path class="whale-body" d="${g(tail)}"/><path class="whale-body" d="${g(body)}"/><path class="whale-shade" d="${g(shade)}"/><path class="whale-body" d="${g(fin)}"/><path class="ink-thin" d="${g(lines)}"/><circle class="dot" cx="${f(x + (flip ? -50 : 50) * k)}" cy="${f(y - 3 * k)}" r="${f(1.5 * k)}"/>${waves(x - 70 * k, y + 22 * k, 3, 6)}${waves(x + 18 * k, y + 26 * k, 2, 6)}</g>`;
};

// A sea serpent in three coils and a head, riding the swell.
const serpent = (x, y, k = 1, flip = false) => {
  const g = (d) => d.replace(/(-?\d+\.?\d*) (-?\d+\.?\d*)/g, (_, a, b) => `${f(x + (flip ? -a : +a) * k)} ${f(y + b * k)}`);
  const hump = (cx, w, h) => `M${cx - w} 0 C${cx - w} ${-h * 1.3} ${cx + w} ${-h * 1.3} ${cx + w} 0 L${cx + w - 7} 0 C${cx + w - 7} ${-h * 0.8} ${cx - w + 7} ${-h * 0.8} ${cx - w + 7} 0 Z`;
  const humps = [hump(-64, 15, 20), hump(-26, 17, 24), hump(14, 15, 20)].map((d) => `<path class="scales" d="${g(d)}"/>`).join("");
  const neck = "M40 0 C40 -20 44 -34 56 -42 C62 -46 72 -46 80 -42 L84 -36 C78 -36 72 -36 68 -33 C60 -28 54 -18 50 0 Z";
  const jaw = "M80 -42 C88 -40 94 -36 96 -32 C88 -32 82 -33 76 -34 Z";
  const frill = "M56 -42 L50 -54 L60 -47 L60 -58 L66 -47 L72 -55 L72 -45";
  const tail = "M-92 0 C-96 -10 -104 -14 -110 -10 C-104 -10 -100 -6 -100 0 Z";
  const lines = [-64, -26, 14].map((c) => `M${c - 8} -12 Q${c} -16 ${c + 8} -12`).join("") + "M52 -24 Q56 -22 60 -24M54 -14 Q58 -12 62 -14";
  const w = [-100, -48, -8, 30, 58].map((wx, i) => waves(x + (flip ? -wx : wx) * k - 6, y + 2, i % 2 ? 2 : 3, 6)).join("");
  return `<g class="serpent"><path class="scales" d="${g(tail)}"/>${humps}<path class="fin" d="${g(frill)}"/><path class="scales" d="${g(neck)}"/><path class="scales" d="${g(jaw)}"/><path class="ink-thin" d="${g(lines)}"/><circle class="dot" cx="${f(x + (flip ? -72 : 72) * k)}" cy="${f(y - 39 * k)}" r="${f(1.6 * k)}"/>${w}</g>`;
};

// Grain and age for saved images (on the page, CSS does this instead).
const paper = ([x0, y0, x1, y1], dark, grain = true) => {
  const box = `x="${f(x0)}" y="${f(y0)}" width="${f(x1 - x0)}" height="${f(y1 - y0)}"`;
  const tint = dark ? "#000000" : "#5c3a16";
  const vignette = `<radialGradient id="lf-vig" cx="0.5" cy="0.46" r="0.72"><stop offset="0.55" stop-color="${tint}" stop-opacity="0"/><stop offset="1" stop-color="${tint}" stop-opacity="${dark ? 0.45 : 0.2}"/></radialGradient>`;
  if (!grain) return `<defs>${vignette}</defs><rect ${box} fill="url(#lf-vig)"/>`;
  return `<defs><filter id="lf-grain" x="0" y="0" width="1" height="1"><feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" stitchTiles="stitch" seed="3"/><feColorMatrix values="0 0 0 0 0.4  0 0 0 0 0.3  0 0 0 0 0.18  0 0 0 ${dark ? 0.14 : 0.3} 0"/></filter>${vignette}</defs><rect ${box} filter="url(#lf-grain)"/><rect ${box} fill="url(#lf-vig)"/>`;
};

// The blank sea you draw on: just the rhumb lines, waiting.
export function emptySea(theme = "light") {
  const T = THEMES[theme === "dark" ? "dark" : "light"];
  return `<svg xmlns="http://www.w3.org/2000/svg" class="lf lf-empty" viewBox="-700 -400 1400 800" aria-hidden="true"><style>${sheet(T)}</style><rect class="sea" x="-9000" y="-9000" width="18000" height="18000"/><g class="lf-web">${rhumbs(-380, 160, 820, 4200)}</g></svg>`;
}

/* ---------------- the chart ---------------- */

export function chart(state, opts = {}) {
  const { seed = 1, islands: sketches = [], names = {}, day = today() } = state;
  if (!sketches.length) return null;
  const aspect = clamp(opts.aspect || 1.6, 0.45, 2.4);
  const T = THEMES[opts.theme === "dark" ? "dark" : "light"];
  // On small screens names are set larger (and fewer of them fit): legible beats complete.
  const LS = clamp(opts.labelScale || 1, 1, 2.6);
  const LS2 = Math.sqrt(LS);
  const R = rng((seed * 2654435761) % 2147483647 || 1);
  const pick = (list) => list[Math.floor(R() * list.length)];

  // Names: one shuffled deck per kind, dealt in order.
  const decks = {};
  const taken = new Set();
  const deal = (kind) => {
    if (!decks[kind]) {
      const a = pools[kind].slice();
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(R() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      decks[kind] = a;
    }
    const d = decks[kind];
    for (let i = 0; i < d.length; i++) {
      const cand = d.shift();
      d.push(cand);
      const word = cand[0].replace(/\b(The|Bay|of|Cape|Point|Mount|Lake|Mare|Lesser|Old)\b/g, "").trim() || cand[0];
      if (!taken.has(word)) {
        taken.add(word);
        return cand;
      }
    }
    return d[0];
  };

  /* ----- coasts ----- */
  const lands = sketches.map((sk, i) => {
    const cs = parseInt(hashString(JSON.stringify(sk)), 36) % 99991;
    const coast = roughen(sk, cs, { minLen: 5, rough: 0.26 });
    return { i, sketch: sk, coast, area: Math.abs(signedArea(coast)), box: bbox(coast) };
  });
  const main = lands.reduce((b, L) => (L.area > b.area ? L : b), lands[0]);

  /* ----- a grid over the sea: what's land, and how far from the coast ----- */
  const gb = grow(union(lands.map((l) => l.box)), 280);
  const cols = Math.ceil((gb[2] - gb[0]) / C);
  const rows = Math.ceil((gb[3] - gb[1]) / C);
  const land = new Int16Array(cols * rows);
  const fill = (pts, v) => {
    for (let r = 0; r < rows; r++) {
      const y = gb[1] + (r + 0.5) * C;
      const xs = [];
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i];
        const [xj, yj] = pts[j];
        if (yi > y !== yj > y) xs.push(xi + ((y - yi) * (xj - xi)) / (yj - yi));
      }
      xs.sort((a, b) => a - b);
      for (let q = 0; q + 1 < xs.length; q += 2) {
        const c0 = Math.max(0, Math.ceil((xs[q] - gb[0]) / C - 0.5));
        const c1 = Math.min(cols - 1, Math.floor((xs[q + 1] - gb[0]) / C - 0.5));
        for (let c = c0; c <= c1; c++) land[r * cols + c] = v;
      }
    }
  };
  lands.forEach((L) => fill(L.coast, L.i + 1));

  const chamfer = (isSource) => {
    const d = new Float32Array(cols * rows);
    for (let i = 0; i < d.length; i++) d[i] = isSource(i) ? 0 : 1e9;
    const D = Math.SQRT2;
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        if (!d[i]) continue;
        let v = d[i];
        if (c > 0) v = Math.min(v, d[i - 1] + 1);
        if (r > 0) {
          v = Math.min(v, d[i - cols] + 1);
          if (c > 0) v = Math.min(v, d[i - cols - 1] + D);
          if (c < cols - 1) v = Math.min(v, d[i - cols + 1] + D);
        }
        d[i] = v;
      }
    for (let r = rows - 1; r >= 0; r--)
      for (let c = cols - 1; c >= 0; c--) {
        const i = r * cols + c;
        if (!d[i]) continue;
        let v = d[i];
        if (c < cols - 1) v = Math.min(v, d[i + 1] + 1);
        if (r < rows - 1) {
          v = Math.min(v, d[i + cols] + 1);
          if (c < cols - 1) v = Math.min(v, d[i + cols + 1] + D);
          if (c > 0) v = Math.min(v, d[i + cols - 1] + D);
        }
        d[i] = v;
      }
    return d;
  };
  let dSea = chamfer((i) => land[i] === 0);
  let dLand = chamfer((i) => land[i] !== 0);
  const refresh = () => {
    dSea = chamfer((i) => land[i] === 0);
    dLand = chamfer((i) => land[i] !== 0);
  };

  const cell = (x, y) => {
    const c = Math.floor((x - gb[0]) / C);
    const r = Math.floor((y - gb[1]) / C);
    return c < 0 || r < 0 || c >= cols || r >= rows ? -1 : r * cols + c;
  };
  const landAt = (p) => {
    const i = cell(p[0], p[1]);
    return i < 0 ? 0 : land[i];
  };
  const seaDist = (p) => {
    const i = cell(p[0], p[1]);
    return i < 0 ? 0 : dSea[i] * C;
  };
  const landDist = (p) => {
    const i = cell(p[0], p[1]);
    return i < 0 ? 1e6 : dLand[i] * C;
  };
  const centre = (i) => [gb[0] + ((i % cols) + 0.5) * C, gb[1] + (Math.floor(i / cols) + 0.5) * C];

  const samples = (r, step = C) => {
    const out = [];
    const nx = Math.max(1, Math.ceil((r[2] - r[0]) / step));
    const ny = Math.max(1, Math.ceil((r[3] - r[1]) / step));
    for (let a = 0; a <= nx; a++) for (let b = 0; b <= ny; b++) out.push([r[0] + ((r[2] - r[0]) * a) / nx, r[1] + ((r[3] - r[1]) * b) / ny]);
    return out;
  };
  const onLandOf = (r, id, margin = 4) => samples(r).every((p) => landAt(p) === id && seaDist(p) >= margin);
  const inSea = (r, margin = 6) => samples(r).every((p) => landAt(p) === 0 && landDist(p) >= margin);

  // Per island: its cells, how thick it is, where its heart is.
  for (const L of lands) {
    let best = -1;
    let bd = 0;
    let n = 0;
    let sx = 0;
    let sy = 0;
    for (let i = 0; i < land.length; i++) {
      if (land[i] !== L.i + 1) continue;
      n++;
      const [x, y] = centre(i);
      sx += x;
      sy += y;
      if (dSea[i] > bd) [bd, best] = [dSea[i], i];
    }
    L.cells = n;
    L.maxD = bd * C;
    L.heart = best >= 0 ? centre(best) : [(L.box[0] + L.box[2]) / 2, (L.box[1] + L.box[3]) / 2];
    L.mid = n ? [sx / n, sy / n] : L.heart;
    L.coastLen = perimeter(L.coast);
  }

  const side = (L, p) => dirIndex(p[0] - L.mid[0], p[1] - L.mid[1]);

  /* ----- capes and bays, from the shape of the drawing ----- */
  for (const L of lands) {
    const P = resample(chaikin(chaikin(L.sketch)), 6);
    const n = P.length;
    const span = clamp(n * 6 * 0.045, 30, 90);
    const k = Math.max(3, Math.round(span / 6));
    const depth = P.map((p, i) => {
      const a = P[(i - k + n) % n];
      const b = P[(i + k) % n];
      const m = lerp(a, b, 0.5);
      const L2 = dist(a, b) || 1;
      const d = Math.abs((b[0] - a[0]) * (a[1] - p[1]) - (a[0] - p[0]) * (b[1] - a[1])) / L2;
      return { i, p, m, d: inside(m, L.sketch) ? d : -d };
    });
    const extrema = (sign) => {
      const out = [];
      for (const e of depth) {
        const v = sign * e.d;
        if (v < span * 0.38) continue;
        let isMax = true;
        for (let j = -k; j <= k && isMax; j++) if (j && sign * depth[(e.i + j + n) % n].d > v) isMax = false;
        if (isMax) out.push({ ...e, depth: v, dir: unit([e.p[0] - e.m[0], e.p[1] - e.m[1]]) });
      }
      return out.sort((a, b) => b.depth - a.depth);
    };
    L.capes = extrema(1); // dir points out to sea
    L.bays = extrema(-1); // dir points from the mouth to the head (inland)
    L.span = span;
  }

  /* ----- bookkeeping for what's drawn and where ----- */
  const rects = []; // [x0, y0, x1, y1] that labels and glyphs must not overlap
  const places = [];
  const defs = [];
  const under = []; // lakes, roads, rivers: drawn on the land, under everything else
  const relief = []; // [y, svg], sorted so things further south overlap things behind
  const marks = [];
  const labels = [];
  const soft = []; // rivers: most labels keep off them, but an island's name may cross
  const free = (r, crossRivers = false) => !rects.some((q) => overlaps(r, q)) && (crossRivers || !soft.some((q) => overlaps(r, q)));
  const occupy = (r) => rects.push(r);

  const named = (id, kind, entry, L, at) => {
    const name = (names[id] || entry[0]).trim() || entry[0];
    const p = { id, kind, name, orig: entry[0], story: entry[1], at, island: L ? L.i : 0, side: L ? side(L, at) : 0 };
    places.push(p);
    return p;
  };

  const labelBox = (text, x, y, size, anchor, o = {}) => {
    const w = widthOf(text, size, o);
    const x0 = anchor === "start" ? x : anchor === "end" ? x - w : x - w / 2;
    return [x0 - 2, y - size * 0.74, x0 + w + 2, y + size * 0.26];
  };

  const letter = (p, text, x, y, size, cls, { anchor = "middle", rotate = 0, onLand = false, hit = null } = {}) => {
    const r = labelBox(text, x, y, size, anchor, { italic: /feature|sea/.test(cls), caps: /island/.test(cls), spacing: /island/.test(cls) ? 0.3 : /sea/.test(cls) ? 0.42 : 0 });
    const rot = rotate ? ` transform="rotate(${f(rotate)} ${f(x)} ${f(y)})"` : "";
    const hr = hit || r;
    labels.push(
      `<g class="place" data-place="${p.id}" data-x="${f(p.at[0])}" data-y="${f(p.at[1])}" tabindex="0" role="button" aria-label="${xml(p.name)}, ${xml(p.kind.toLowerCase())}"><rect class="hit" x="${f(hr[0])}" y="${f(hr[1])}" width="${f(hr[2] - hr[0])}" height="${f(hr[3] - hr[1])}"/><text class="lab ${cls}${onLand ? " lab-l" : ""}" x="${f(x)}" y="${f(y)}" font-size="${f(size)}" text-anchor="${anchor}"${rot}>${xml(text)}</text></g>`
    );
    p.label = r;
    return r;
  };

  // Try a list of [x, y, anchor] spots; keep the first that's free (and on
  // land or in the sea, if asked).
  const tryLabel = (p, text, size, cls, spots, { where = "any", L = null, margin = 3, rotate = 0 } = {}) => {
    const o = { italic: /feature|sea/.test(cls), caps: /island/.test(cls), spacing: /island/.test(cls) ? 0.3 : 0 };
    for (const [x, y, anchor] of spots) {
      const r = labelBox(text, x, y, size, anchor, o);
      if (!free(grow(r, margin))) continue;
      if (where === "sea" && !inSea(r, 5)) continue;
      if (where === "land" && !onLandOf(r, L.i + 1, 3)) continue;
      const onLand = landAt([(r[0] + r[2]) / 2, (r[1] + r[3]) / 2]) !== 0;
      letter(p, text, x, y, size, cls, { anchor, onLand, rotate });
      occupy(r);
      return r;
    }
    return null;
  };

  const around = (x, y, gap, size) => [
    [x + gap, y + size * 0.35, "start"],
    [x - gap, y + size * 0.35, "end"],
    [x, y + gap + size * 0.8, "middle"],
    [x, y - gap - size * 0.1, "middle"],
    [x + gap * 0.8, y + gap + size * 0.4, "start"],
    [x - gap * 0.8, y + gap + size * 0.4, "end"],
    [x + gap * 0.8, y - gap * 0.7, "start"],
    [x - gap * 0.8, y - gap * 0.7, "end"],
  ];

  // Out beyond a point of the coast, for capes and lighthouses.
  const seaward = (tip, dir, gap, size) => {
    const out = [];
    for (const g of [gap, gap * 1.4, gap * 1.9, gap * 2.5]) {
      const x = tip[0] + dir[0] * g;
      const y = tip[1] + dir[1] * g;
      const anchor = dir[0] > 0.35 ? "start" : dir[0] < -0.35 ? "end" : "middle";
      out.push([x, y + size * 0.35 + (anchor === "middle" ? dir[1] * size * 0.5 : 0), anchor]);
      out.push([x + (anchor === "middle" ? 0 : dir[0] * 8), y + size * 0.35 + 16, anchor]);
      out.push([x, y + size * 0.35 - 16, anchor]);
    }
    return out;
  };

  const settlements = [];

  /* ----- the peak and the island's name ----- */
  let peak = null;
  if (main.maxD >= 42) {
    const [hx, hy] = main.heart;
    const base = [hx, hy + 18];
    peak = { at: base };
    const cloudy = R() < 0.4;
    occupy([hx - 38, hy + 18 - 48 - (cloudy ? 16 : 0), hx + 56, hy + 20]);
    const entry = deal("peaks");
    const withCloud = cloudy || /Sulk|Heed/.test(entry[0]);
    relief.push([base[1], mountain(base[0], base[1], 34, "peak").replace('class="mtn-line"', 'class="mtn-line peak-line"') + (withCloud ? cloud(base[0] + 2, base[1] - 40, 13, seed) : "")]);
    peak.place = named("peak", "Mountain", entry, main, [hx, hy]);
    const [lx, ly] = base;
    const ps = 14 * LS;
    const spots = [[lx, ly + 6 + ps * 0.95, "middle"], [lx + 44, ly - 8, "start"], [lx - 40, ly - 8, "end"], [lx, ly - (withCloud ? 60 : 46) - ps * 0.3, "middle"], [lx + 30, ly + 4 + ps, "start"], [lx - 30, ly + 4 + ps, "end"]];
    if (!tryLabel(peak.place, peak.place.name, ps, "lab-feature", spots)) places.pop();
  }

  /* ----- a river, from the peak down to the nearest good bay ----- */
  let river = null;
  if (peak) {
    const bays = main.bays.slice().sort((a, b) => dist(a.p, peak.at) - dist(b.p, peak.at));
    for (const b of bays.slice(0, 4)) {
      const dir = unit([b.p[0] - peak.at[0], b.p[1] - peak.at[1]]);
      const src = [peak.at[0] + dir[0] * 30, peak.at[1] + dir[1] * 30 - 6];
      const len = dist(src, b.p);
      if (len < 70) continue;
      const n = Math.ceil(len / 40);
      const line = Array.from({ length: n + 1 }, (_, s) => lerp(src, b.p, s / n));
      const course = roughen(line, seed + 5, { closed: false, minLen: 4, rough: 0.22 });
      const body = course.slice(0, Math.floor(course.length * 0.9));
      if (!body.every((q) => landAt(q) === main.i + 1)) continue;
      river = { course, bay: b };
      under.push(`<path class="river" d="${poly(course, false)}"/>`);
      for (let s = 0; s < course.length; s += 3) soft.push([course[s][0] - 3, course[s][1] - 3, course[s][0] + 3, course[s][1] + 3]);
      break;
    }
  }

  /* ----- towns: the main one at the best harbour, hamlets spread round the coast ----- */
  const inland = (p, dir, want = 14) => {
    for (let g = 8; g <= 44; g += 4) {
      const q = [p[0] + dir[0] * g, p[1] + dir[1] * g];
      if (landAt(q) && seaDist(q) >= want - 2) return q;
    }
    return null;
  };
  const spreadPoint = (L, avoid, minGap) => {
    const P = resample(L.sketch, 12);
    let best = null;
    let bd = minGap;
    for (let i = 0; i < P.length; i++) {
      const d = Math.min(...avoid.map((a) => dist(a, P[i])), 1e9);
      if (d > bd) [bd, best] = [d, P[i]];
    }
    return best;
  };
  const placeTown = (L, spot, size, entry, id, kind) => {
    const r = size === "large" ? [spot[0] - 17, spot[1] - 25, spot[0] + 17, spot[1] + 15] : [spot[0] - 10, spot[1] - 11, spot[0] + 9, spot[1] + 5];
    if (!free(r)) return null;
    occupy(r);
    marks.push(town(spot[0], spot[1], size));
    const p = named(id, kind, entry, L, spot);
    const fs = (size === "large" ? 17 : 13) * LS;
    if (!tryLabel(p, p.name, fs, "lab-town", around(spot[0], spot[1] + (size === "large" ? -4 : -2), size === "large" ? 21 : 12, fs))) {
      places.pop();
      rects.pop();
      marks.pop();
      return null;
    }
    settlements.push(spot);
    return p;
  };

  const usedBays = new Set();
  {
    // The main town wants a harbour: beside the river mouth, else the best bay,
    // else anywhere on the coast well away from the mountain.
    const spots = [];
    if (river) {
      const b = river.bay;
      const tan = [b.dir[1], -b.dir[0]];
      for (const g of [28, 40, 54]) for (const sgn of [1, -1]) spots.push([[b.p[0] + tan[0] * g * sgn, b.p[1] + tan[1] * g * sgn], b.dir, b]);
    }
    for (const b of main.bays) spots.push([b.p, b.dir, b]);
    const P = resample(main.sketch, 24);
    const away = peak ? peak.at : main.heart;
    P.sort((a, b) => dist(b, away) - dist(a, away));
    for (const q of P.slice(0, 12)) spots.push([q, unit([main.heart[0] - q[0], main.heart[1] - q[1]]), null]);
    const entry = deal("towns");
    for (const [q, dir, bay] of spots) {
      const spot = inland(q, dir, 14);
      if (spot && placeTown(main, spot, "large", entry, "town", "Town")) {
        if (bay) usedBays.add(bay);
        break;
      }
    }
  }

  const hamletCount = (L) => (L === main ? 1 + (main.bays.length > 2 ? 1 : 0) + (R() < 0.55 ? 1 : 0) : L.cells * C * C > 26000 ? 1 : 0);
  let hamletN = 0;
  for (const L of [main, ...lands.filter((l) => l !== main)]) {
    const want = hamletCount(L);
    let made = 0;
    const bays = L.bays.filter((b) => !usedBays.has(b));
    for (let tries = 0; made < want && tries < 6; tries++) {
      let q = null;
      let dir = null;
      const bay = bays.find((b) => !usedBays.has(b) && settlements.every((s) => dist(s, b.p) > 150));
      if (bay) {
        usedBays.add(bay);
        q = bay.p;
        dir = bay.dir;
      } else {
        q = spreadPoint(L, settlements.length ? settlements : [L.heart], 140);
        if (!q) break;
        dir = unit([L.heart[0] - q[0], L.heart[1] - q[1]]);
      }
      const spot = inland(q, dir, 10);
      if (!spot) continue;
      hamletN++;
      if (placeTown(L, spot, "small", deal("hamlets"), "hamlet" + hamletN, L === main ? "Fishing village" : "Hamlet")) made++;
    }
  }

  /* ----- a lighthouse on the boldest cape ----- */
  const usedCapes = new Set();
  for (const L of [main, ...lands.filter((l) => l !== main && l.cells * C * C > 40000)]) {
    const cape = L.capes.find((c) => c.depth > L.span * 0.6 && settlements.every((s) => dist(s, c.p) > 60));
    if (!cape) continue;
    const spot = inland(cape.p, [-cape.dir[0], -cape.dir[1]], 6);
    if (!spot) continue;
    const r = [spot[0] - 12, spot[1] - 28, spot[0] + 12, spot[1] + 2];
    if (!free(r)) continue;
    occupy(r);
    usedCapes.add(cape);
    marks.push(lighthouse(spot[0], spot[1]));
    const rr = rng(seed + L.i * 31);
    for (let i = 0; i < 5; i++) {
      const a = (rr() - 0.5) * 1.6;
      const g = 16 + rr() * 22;
      const d = [cape.dir[0] * Math.cos(a) - cape.dir[1] * Math.sin(a), cape.dir[0] * Math.sin(a) + cape.dir[1] * Math.cos(a)];
      const q = [cape.p[0] + d[0] * g, cape.p[1] + d[1] * g];
      if (landAt(q) === 0 && free([q[0] - 4, q[1] - 4, q[0] + 4, q[1] + 4])) {
        marks.push(rock(q[0], q[1]));
        occupy([q[0] - 4, q[1] - 4, q[0] + 4, q[1] + 4]);
      }
    }
    const p = named(L === main ? "light" : "light" + L.i, "Cape and lighthouse", deal("lights"), L, spot);
    if (!tryLabel(p, p.name, 14 * LS, "lab-feature", seaward(cape.p, cape.dir, 30, 14 * LS), { where: "sea" })) places.pop();
  }

  /* ----- island names ----- */
  const titled = new Map();
  for (const L of [main, ...lands.filter((l) => l !== main)]) {
    const isMain = L === main;
    const entry = isMain ? deal("islands") : deal("isles");
    const kind = isMain ? "Island" : L.cells * C * C > 30000 ? "Island" : "Isle";
    const p = named(isMain ? "island" : "isle" + L.i, kind, entry, L, L.mid);
    titled.set(L, p);
    const text = p.name.toUpperCase();
    const rot = (R() - 0.5) * 6;
    let done = null;
    const sizes = (isMain ? [44, 38, 32, 27, 23] : [24, 20, 17, 14]).map((z) => Math.round(z * LS2));
    for (const size of sizes) {
      const w = widthOf(text, size, { caps: true, spacing: 0.3 });
      const spots = [];
      const [bx0, by0, bx1, by1] = L.box;
      const goal = [L.mid[0], L.mid[1] + (by1 - by0) * 0.12];
      for (let y = by0 + size; y < by1; y += 10) for (let x = bx0 + w / 2; x < bx1 - w / 2; x += 10) spots.push([x, y]);
      spots.sort((a, b) => dist(a, goal) - dist(b, goal));
      for (const [x, y] of spots) {
        if (landAt([x, y - size * 0.3]) !== L.i + 1 || seaDist([x, y - size * 0.3]) < size * 0.45) continue;
        const r = [x - w / 2 - 6, y - size * 0.72 - Math.abs(rot) * w * 0.009, x + w / 2 + 6, y + size * 0.1 + Math.abs(rot) * w * 0.009];
        if (!free(r, true) || !onLandOf(r, L.i + 1, 6)) continue;
        letter(p, text, x, y, size, "lab-island", { rotate: rot, onLand: true });
        occupy(r);
        done = r;
        break;
      }
      if (done) break;
    }
    if (!done) {
      const size = Math.round((isMain ? 30 : 17) * LS2);
      const [bx0, by0, bx1, by1] = L.box;
      const cx = (bx0 + bx1) / 2;
      const spots = [
        [cx, by1 + 58, "middle"], [cx, by0 - 44, "middle"],
        [bx1 + 40, (by0 + by1) / 2, "start"], [bx0 - 40, (by0 + by1) / 2, "end"],
        [cx, by1 + 96, "middle"], [cx, by0 - 84, "middle"],
      ];
      for (const [x, y, anchor] of spots) {
        const r = labelBox(text, x, y, size, anchor, { caps: true, spacing: 0.3 });
        if (!free(grow(r, 4)) || !inSea(r, 10)) continue;
        letter(p, text, x, y, size, "lab-island", { anchor });
        occupy(r);
        done = r;
        break;
      }
    }
    if (!done && !isMain) places.pop();
  }
  const islandName = titled.get(main).name;

  /* ----- a lake, sometimes ----- */
  let lake = null;
  if (main.maxD >= 70 && R() < 0.5) {
    const cands = [];
    for (let i = 0; i < land.length; i++) {
      if (land[i] !== main.i + 1) continue;
      const d = dSea[i] * C;
      if (d < main.maxD * 0.3 || d > main.maxD * 0.7) continue;
      const q = centre(i);
      if (peak && dist(q, peak.at) < 95) continue;
      if (settlements.some((s) => dist(s, q) < 70)) continue;
      if (river && river.course.some((c) => dist(c, q) < 34)) continue;
      cands.push(q);
    }
    for (let t = 0; t < 12 && cands.length; t++) {
      const q = cands[Math.floor(R() * cands.length)];
      const rad = 13 + R() * 9;
      const r = [q[0] - rad - 4, q[1] - rad - 4, q[0] + rad + 4, q[1] + rad + 4];
      if (!free(r)) continue;
      const ring = Array.from({ length: 11 }, (_, s) => {
        const a = (s / 11) * Math.PI * 2;
        const k = 1 + (R() - 0.5) * 0.35;
        return [Math.round(q[0] + Math.cos(a) * rad * k * 1.25), Math.round(q[1] + Math.sin(a) * rad * k * 0.85)];
      });
      const shore = roughen(ring, seed + 9, { minLen: 3, rough: 0.2 });
      const inner = shore.map((s) => lerp(q, s, 0.62));
      under.push(`<path class="lake" d="${poly(shore)}"/><path class="lake-ring" d="${poly(inner)}"/>`);
      occupy(r);
      lake = { at: q, r: rad };
      const p = named("lake", "Lake", deal("lakes"), main, q);
      if (!tryLabel(p, p.name, 13 * LS, "lab-feature", [...around(q[0], q[1], rad * 1.25 + 4, 13 * LS), ...around(q[0], q[1], rad * 1.25 + 16, 13 * LS)])) {
        // A lake nobody can name isn't worth the ink.
        places.pop();
        under.pop();
        rects.pop();
        lake = null;
        continue;
      }
      break;
    }
  }

  /* ----- the forest: somewhere quiet, away from everything else ----- */
  const forests = [];
  for (const L of [main, ...lands.filter((l) => l !== main)]) {
    if (L.maxD < 26) continue;
    const isMain = L === main;
    const busy = [...settlements, ...(peak && isMain ? [peak.at] : []), ...(lake && isMain ? [lake.at] : [])];
    const cands = [];
    for (let i = 0; i < land.length; i++) {
      if (land[i] !== L.i + 1) continue;
      const d = dSea[i] * C;
      if (d < Math.min(24, L.maxD * 0.5) || d > L.maxD * 0.85) continue;
      const q = centre(i);
      const far = Math.min(1e9, ...busy.map((b) => dist(b, q)), ...(river && isMain ? river.course.map((c) => dist(c, q) + 10) : []));
      cands.push([far + R() * 30, q]);
    }
    if (!cands.length) continue;
    cands.sort((a, b) => b[0] - a[0]);
    const q = cands[0][1];
    const rad = clamp(L.maxD * (isMain ? 1.05 : 0.9), 34, isMain ? 120 : 70);
    const wob = [R() * 6, R() * 6, 0.18 + R() * 0.14];
    const within = (p) => {
      const a = Math.atan2(p[1] - q[1], p[0] - q[0]);
      return dist(p, q) < rad * (1 + wob[2] * Math.sin(2 * a + wob[0]) + 0.12 * Math.sin(3 * a + wob[1]));
    };
    forests.push({ L, at: q, within, named: isMain || R() < 0.5 });
  }
  for (const F of forests) {
    if (!F.named) continue;
    const p = named(F.L === main ? "forest" : "forest" + F.L.i, "Forest", deal("forests"), F.L, F.at);
    const [x, y] = F.at;
    const spots = [[x, y + 5, "middle"], [x, y + 30, "middle"], [x, y - 22, "middle"], [x + 24, y + 5, "start"], [x - 24, y + 5, "end"]];
    if (!tryLabel(p, p.name, 14 * LS, "lab-feature", spots, { where: "land", L: F.L })) places.pop();
  }

  /* ----- the river's name, along its middle ----- */
  if (river) {
    const p = named("river", "River", deal("rivers"), main, river.course[Math.floor(river.course.length / 2)]);
    const c = river.course;
    let ok = false;
    for (const t of [0.5, 0.36, 0.64, 0.25, 0.75]) {
      const i = Math.floor(c.length * t);
      const a = c[Math.max(0, i - 6)];
      const b = c[Math.min(c.length - 1, i + 6)];
      let ang = (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;
      if (ang > 90) ang -= 180;
      if (ang < -90) ang += 180;
      for (const s of [1, -1]) {
        const nrm = [-Math.sin(ang * deg) * s, Math.cos(ang * deg) * s];
        const rs = 13 * LS;
        const x = c[i][0] + nrm[0] * (4 + rs * 0.4);
        const y = c[i][1] + nrm[1] * (4 + rs * 0.4) + rs * 0.3;
        const w = widthOf(p.name, rs, { italic: true });
        const ca = Math.cos(ang * deg);
        const sa = Math.sin(ang * deg);
        const corners = [[-w / 2, -rs * 0.75], [w / 2, -rs * 0.75], [-w / 2, rs * 0.25], [w / 2, rs * 0.25]].map(([u, v]) => [x + u * ca - v * sa, y + u * sa + v * ca]);
        const r = bbox(corners);
        if (!free(r, true) || !corners.every((q) => landAt(q) === main.i + 1)) continue;
        letter(p, p.name, x, y, rs, "lab-feature", { rotate: ang, onLand: true, hit: r });
        occupy(r);
        ok = true;
        break;
      }
      if (ok) break;
    }
    if (!ok) places.pop();
  }

  /* ----- bays and capes worth naming ----- */
  for (const L of [main, ...lands.filter((l) => l !== main)]) {
    const maxBays = L === main ? 3 : 1;
    let nb = 0;
    L.bays.forEach((b, j) => {
      if (nb >= maxBays || b.depth < L.span * 0.5) return;
      const p = named(`bay${L.i}-${j}`, "Bay", deal("bays"), L, b.m);
      const out = [-b.dir[0], -b.dir[1]];
      const spots = [];
      for (const t of [-0.45, -0.2, 0.2, 0.45, 0.7, 1, 1.3, 1.7]) {
        const x = b.m[0] + out[0] * b.depth * t;
        const y = b.m[1] + out[1] * b.depth * t + 5;
        spots.push([x, y, "middle"], [x, y + 18, "middle"], [x, y - 18, "middle"]);
      }
      if (tryLabel(p, p.name, 14 * LS, "lab-feature", spots, { where: "sea" })) nb++;
      else places.pop();
    });
    const maxCapes = L === main ? 2 : 1;
    let nc = 0;
    for (const c of L.capes) {
      if (nc >= maxCapes || usedCapes.has(c) || c.depth < L.span * 0.5) continue;
      if ([...usedCapes].some((u) => dist(u.p, c.p) < 80)) continue;
      const p = named(`cape${L.i}-${L.capes.indexOf(c)}`, "Cape", deal("capes"), L, c.p);
      if (tryLabel(p, p.name, 14 * LS, "lab-feature", seaward(c.p, c.dir, 22, 14 * LS), { where: "sea" })) {
        usedCapes.add(c);
        nc++;
      } else places.pop();
    }
  }

  /* ----- an islet off a cape ----- */
  if (R() < 0.6) {
    const capes = [...main.capes].sort((a, b) => b.depth - a.depth);
    for (const c of capes) {
      const g = 44 + R() * 16;
      const q = [c.p[0] + c.dir[0] * g, c.p[1] + c.dir[1] * g];
      const rad = 7 + R() * 5;
      if (landDist(q) < 34 || !free([q[0] - rad - 10, q[1] - rad - 10, q[0] + rad + 10, q[1] + rad + 10])) continue;
      const ring = Array.from({ length: 7 }, (_, s) => {
        const a = (s / 7) * Math.PI * 2;
        return [Math.round(q[0] + Math.cos(a) * rad * (0.8 + R() * 0.4)), Math.round(q[1] + Math.sin(a) * rad * (0.8 + R() * 0.4))];
      });
      const coast = roughen(ring, seed + 3, { minLen: 1.6, rough: 0.2 });
      const L = { i: lands.length, coast, box: bbox(coast), islet: true, sketch: ring };
      lands.push(L);
      fill(coast, L.i + 1);
      refresh();
      occupy([q[0] - rad - 2, q[1] - rad - 2, q[0] + rad + 2, q[1] + rad + 2]);
      const p = named("islet", "Islet", deal("islets"), main, q);
      if (!tryLabel(p, p.name, 13 * LS, "lab-feature", around(q[0], q[1], rad + 8, 13 * LS), { where: "sea" })) places.pop();
      break;
    }
  }

  /* ----- roads between settlements on the same island ----- */
  const roads = [];
  const town0 = places.find((p) => p.id === "town");
  if (town0) {
    for (const h of places.filter((p) => p.id.startsWith("hamlet") && p.island === main.i)) {
      const a = town0.at;
      const b = h.at;
      const n = Math.max(2, Math.ceil(dist(a, b) / 50));
      const line = Array.from({ length: n + 1 }, (_, s) => lerp(a, b, s / n));
      const course = roughen(line, seed + 60 + roads.length, { closed: false, minLen: 6, rough: 0.12 });
      const trimmed = course.filter((q) => dist(q, a) > 14 && dist(q, b) > 9);
      if (trimmed.length < 3 || !trimmed.every((q) => landAt(q) === main.i + 1 && seaDist(q) >= 5)) continue;
      if (lake && trimmed.some((q) => dist(q, lake.at) < lake.r * 1.4 + 4)) continue;
      roads.push(trimmed);
      under.push(`<path class="road" d="${poly(trimmed, false)}"/>`);
    }
  }

  /* ----- texture: hills along the spine, trees in the forest ----- */
  const busyNear = (q, r) => rects.some((b) => q[0] > b[0] - r && q[0] < b[2] + r && q[1] > b[1] - r && q[1] < b[3] + r);
  const lines = [...(river ? [river.course] : []), ...roads];
  const nearLine = (q, r) => lines.some((l) => l.some((c) => dist(c, q) < r));
  for (const L of lands) {
    if (L.islet || L.maxD < 22) continue;
    const want = L === main ? 14 : 6;
    const hills = [];
    const cands = [];
    for (let i = 0; i < land.length; i++) {
      if (land[i] !== L.i + 1) continue;
      const d = dSea[i] * C;
      if (d < Math.max(20, L.maxD * 0.45)) continue;
      const q = centre(i);
      cands.push([d + R() * 18 - (peak && L === main ? dist(q, peak.at) * 0.22 : 0), q, d]);
    }
    cands.sort((a, b) => b[0] - a[0]);
    for (const [, q, d] of cands) {
      if (hills.length >= want) break;
      const s = clamp(10 + (d / Math.max(L.maxD, 1)) * 9 + R() * 3, 10, 21);
      const r = [q[0] - s, q[1] - s * 1.3, q[0] + s * 1.5, q[1] + 2];
      if (hills.some((h) => dist(h, q) < s * 2.1) || !free(grow(r, 2)) || nearLine(q, s)) continue;
      if (forests.some((F) => F.L === L && F.within(q))) continue;
      hills.push(q);
      occupy(r);
      relief.push([q[1], mountain(q[0], q[1], s)]);
    }
  }
  const tr = rng(seed + 99);
  for (const F of forests) {
    const [x0, y0, x1, y1] = F.L.box;
    const trees = [];
    for (let t = 0; t < 9000 && trees.length < (F.L === main ? 140 : 50); t++) {
      const q = [x0 + tr() * (x1 - x0), y0 + tr() * (y1 - y0)];
      if (!F.within(q) || landAt(q) !== F.L.i + 1 || seaDist(q) < 10) continue;
      if (trees.some((o) => dist(o, q) < 11) || busyNear(q, 6) || nearLine(q, 7)) continue;
      trees.push(q);
    }
    for (const q of trees) relief.push([q[1], tree(q[0], q[1], 3.9 + tr() * 1.3)]);
  }

  /* ----- the frame, and the furniture that lives in the open sea ----- */
  const landBox = union(lands.map((l) => grow(l.box, 56)));
  const content = union([landBox, ...places.filter((p) => p.label).map((p) => grow(p.label, 10))]);

  // A sea name, curving over the top of everything (or under it).
  const sea = named("sea", "Sea", deal("seas"), null, [0, 0]);
  const seaSize = Math.round(22 * LS2);
  let seaPath = null;
  {
    const text = sea.name.toUpperCase();
    const w = widthOf(text, seaSize, { caps: true, spacing: 0.42 }) * 1.08;
    const cx = (landBox[0] + landBox[2]) / 2;
    for (const [y, bend] of [[landBox[1] - 20, -46], [landBox[3] + 40, 40], [landBox[1] - 70, -46], [landBox[3] + 90, 40]]) {
      const a = [cx - w * 0.62, y - bend * 0.25];
      const b = [cx + w * 0.62, y - bend * 0.25];
      const c = [cx, y + bend * 0.75];
      const curve = Array.from({ length: 13 }, (_, s) => {
        const t = s / 12;
        return [(1 - t) * (1 - t) * a[0] + 2 * t * (1 - t) * c[0] + t * t * b[0], (1 - t) * (1 - t) * a[1] + 2 * t * (1 - t) * c[1] + t * t * b[1]];
      });
      const box = grow(bbox(curve), 16);
      if (!free(box) || !curve.every((q) => landDist(q) > 40 && landDist([q[0], q[1] - 14]) > 40)) continue;
      seaPath = { d: `M${pt(a)}Q${pt(c)} ${pt(b)}`, box, mid: curve[6] };
      sea.at = curve[6];
      occupy(box);
      break;
    }
    if (!seaPath) places.pop();
  }

  const cartTitle = islandName.toUpperCase();
  let titleSize = 34;
  while (titleSize > 18 && widthOf(cartTitle, titleSize, { caps: true, spacing: 0.08 }) > 330) titleSize -= 2;
  const cw0 = Math.max(296, widthOf(cartTitle, titleSize, { caps: true, spacing: 0.08 }) + 70);
  const ch0 = 142;
  const cw = cw0 * LS2;
  const ch = ch0 * LS2;
  const creatureKind = pick(["octopuses", "whales", "serpents"]);
  const creatureBase = { octopuses: [230, 210], whales: [200, 104], serpents: [236, 96] }[creatureKind];
  const creatureSize = [creatureBase[0], creatureBase[1] + 16 * LS];

  const clearOf = (r, m) => samples(r, 12).every((q) => landDist(q) >= m);
  let frame;
  let layout;
  const base = seaPath ? union([content, seaPath.box]) : content.slice();
  const extend = (b, a) => {
    let [x0, y0, x1, y1] = b;
    const w = x1 - x0;
    const h = y1 - y0;
    if (w / h < a) {
      const d = (h * a - w) / 2;
      x0 -= d;
      x1 += d;
    } else {
      const d = (w / a - h) / 2;
      y0 -= d;
      y1 += d;
    }
    return [x0, y0, x1, y1];
  };
  for (let attempt = 0; attempt < 8; attempt++) {
    const g = 40 + attempt * 55;
    frame = extend(grow(base, g), aspect);
    const busy = rects.slice();
    const ok = (r, m) => r[0] >= frame[0] && r[1] >= frame[1] && r[2] <= frame[2] && r[3] <= frame[3] && !busy.some((q) => overlaps(r, q)) && clearOf(r, m);
    const inset = 20;
    const corners = [
      [frame[0] + inset, frame[1] + inset],
      [frame[2] - inset - cw, frame[1] + inset],
      [frame[0] + inset, frame[3] - inset - ch],
      [frame[2] - inset - cw, frame[3] - inset - ch],
    ];
    const cart = corners.map(([x, y]) => [x, y, x + cw, y + ch]).find((r) => ok(r, 34));
    if (!cart) continue;
    busy.push(grow(cart, 10));
    const R0 = 64;
    const roseBox = (x, y) => [x - R0 - 6, y - R0 - 28, x + R0 + 6, y + R0 + 56];
    const spots = [];
    for (let x = frame[0] + R0 + 26; x < frame[2] - R0 - 26; x += 18) for (let y = frame[1] + R0 + 48; y < frame[3] - R0 - 76; y += 18) spots.push([x, y]);
    const pref = [(cart[0] + cart[2]) / 2 < (frame[0] + frame[2]) / 2 ? frame[2] : frame[0], frame[3]];
    spots.sort((a, b) => dist(a, pref) - dist(b, pref));
    const rosePt = spots.find(([x, y]) => ok(roseBox(x, y), 24));
    if (!rosePt) continue;
    busy.push(roseBox(...rosePt));
    // The creature and the ship are welcome but not essential.
    const [cwid, chei] = creatureSize;
    const cspots = [];
    for (let x = frame[0] + cwid / 2 + 10; x < frame[2] - cwid / 2 - 10; x += 16) for (let y = frame[1] + chei / 2 + 10; y < frame[3] - chei / 2 - 10; y += 16) cspots.push([x, y]);
    const score = ([x, y]) => Math.abs(landDist([x, y]) - (cwid * 0.5 + 60)) + R() * 20;
    const scored = cspots.map((q) => [score(q), q]).sort((a, b) => a[0] - b[0]);
    const cBox = ([x, y]) => [x - cwid / 2, y - chei / 2, x + cwid / 2, y + chei / 2];
    const cr = scored.find(([, q]) => ok(cBox(q), 26));
    if (!cr && attempt < 4) continue;
    if (cr) busy.push(cBox(cr[1]));
    const sspots = cspots.filter(([x, y]) => landDist([x, y]) > 50 && landDist([x, y]) < 260);
    const shipBox = ([x, y]) => (x > main.mid[0] ? [x - 26, y - 40, x + 118, y + 18] : [x - 118, y - 40, x + 26, y + 18]);
    const sp = sspots.map((q) => [Math.abs(q[1] - (landBox[1] + landBox[3]) / 2) * 0.3 + (q[0] < main.mid[0] ? 0 : 60) + R() * 30, q]).sort((a, b) => a[0] - b[0]).find(([, q]) => ok(shipBox(q), 30));
    layout = { cart, rose: rosePt, creature: cr && cr[1], ship: sp && sp[1] };
    break;
  }
  if (!layout) {
    frame = extend(grow(base, 480), aspect);
    layout = { cart: [frame[0] + 20, frame[1] + 20, frame[0] + 20 + cw, frame[1] + 20 + ch], rose: [frame[2] - 110, frame[3] - 140], creature: null, ship: null };
  }

  /* ----- creature ----- */
  if (layout.creature) {
    const [x, y] = layout.creature;
    const flip = x > main.mid[0];
    const entry = deal(creatureKind);
    const kindName = { octopuses: "Octopus", whales: "Whale", serpents: "Sea serpent" }[creatureKind];
    if (creatureKind === "octopuses") marks.push(octopus(x, y - 20, seed % 97, { kettle: /Borrower/.test(entry[0]) }).replace(/mantle-clip/g, "lf-mantle"));
    else if (creatureKind === "whales") marks.push(whale(x, y, 1.15, flip));
    else marks.push(serpent(x + (flip ? 10 : -10), y + 20, 1.1, flip));
    const p = named("creature", kindName, entry, null, [x, y]);
    const ly = y + creatureBase[1] / 2 - (creatureKind === "octopuses" ? 4 : 2) + 12 * (LS - 1);
    letter(p, p.name, x, ly, 14 * LS, "lab-feature", { hit: [x - creatureSize[0] / 2, y - creatureSize[1] / 2, x + creatureSize[0] / 2, ly + 6] });
  }

  /* ----- ship ----- */
  if (layout.ship) {
    const [x, y] = layout.ship;
    const east = x > main.mid[0];
    marks.push(east ? `<g transform="translate(${f(2 * x)} 0) scale(-1 1)">${ship(x, y, 1.1)}</g>` : ship(x, y, 1.1));
  }

  /* ----- rose, scale, rhumb lines ----- */
  const [rx, ry] = layout.rose;
  const furniture = rose(rx, ry, 64).replace(/class="rose-ring thin"/g, 'class="rose-ring-thin"') + scaleBar(rx - 60, ry + 64 + 36).replace(/<text class="sb-(num|title)"/g, '<text text-anchor="middle" class="sb-$1"');
  const fw = frame[2] - frame[0];
  const fh = frame[3] - frame[1];
  const web = rhumbs(rx, ry, Math.max(fw, fh) * 0.62, Math.max(fw, fh) * 3.2);

  /* ----- cartouche ----- */
  const date = new Date(day * 86400000).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  const [cx0, cy0] = layout.cart;
  const [kx0, ky0, kx1, ky1] = [0, 0, cw0, ch0];
  const kx = cw0 / 2;
  const cartouche = `<g class="lf-cartouche" transform="translate(${f(cx0)} ${f(cy0)}) scale(${LS2.toFixed(3)})"><rect class="ct-bg" x="${f(kx0)}" y="${f(ky0)}" width="${f(kx1 - kx0)}" height="${f(ky1 - ky0)}"/><rect class="ct-rule" x="${f(kx0 + 5)}" y="${f(ky0 + 5)}" width="${f(kx1 - kx0 - 10)}" height="${f(ky1 - ky0 - 10)}"/><text class="ct-k" x="${f(kx)}" y="${f(ky0 + 34)}" font-size="16" text-anchor="middle">An island called</text><text class="ct-t" x="${f(kx)}" y="${f(ky0 + 70)}" font-size="${titleSize}" text-anchor="middle">${xml(cartTitle)}</text><text class="ct-k" x="${f(kx)}" y="${f(ky0 + 96)}" font-size="14" text-anchor="middle">drawn by hand, ${xml(date)}</text><path class="ct-rule" d="M${f(kx - 70)} ${f(ky0 + 110)}H${f(kx + 70)}"/><text class="ct-m" x="${f(kx)}" y="${f(ky0 + 127)}" font-size="10" text-anchor="middle">${SITE.toUpperCase()}</text></g>`;

  /* ----- assemble ----- */
  const all = lands;
  for (const L of all) defs.push(`<path id="lf-c${L.i}" d="${poly(L.coast)}"/>`, `<clipPath id="lf-k${L.i}"><use href="#lf-c${L.i}"/></clipPath>`);
  if (seaPath) defs.push(`<path id="lf-sea" d="${seaPath.d}"/>`);
  let rings = "";
  [52, 38, 27, 18, 10.5, 4.6].forEach((d, i) => {
    const op = [0.16, 0.22, 0.3, 0.38, 0.48, 0.62][i];
    rings += `<g style="opacity:${op}">${all.map((L) => `<use href="#lf-c${L.i}" class="ring-ink" stroke-width="${f(2 * d + 0.85)}"/>`).join("")}</g>`;
    rings += `<g>${all.map((L) => `<use href="#lf-c${L.i}" class="ring-sea" stroke-width="${f(2 * d - 0.85)}"/>`).join("")}</g>`;
  });
  const landSvg = all.map((L) => `<use href="#lf-c${L.i}" class="land"/><g clip-path="url(#lf-k${L.i})"><use href="#lf-c${L.i}" class="wash"/><use href="#lf-c${L.i}" class="hatch"/></g><use href="#lf-c${L.i}" class="coast"/>`).join("");
  relief.sort((a, b) => a[0] - b[0]);
  if (seaPath) {
    labels.push(
      `<g class="place" data-place="sea" data-x="${f(seaPath.mid[0])}" data-y="${f(seaPath.mid[1])}" tabindex="0" role="button" aria-label="${xml(sea.name)}, sea"><rect class="hit" x="${f(seaPath.box[0])}" y="${f(seaPath.box[1])}" width="${f(seaPath.box[2] - seaPath.box[0])}" height="${f(seaPath.box[3] - seaPath.box[1])}"/><text class="lab lab-sea" font-size="${seaSize}"><textPath href="#lf-sea" startOffset="50%" text-anchor="middle">${xml(sea.name.toUpperCase())}</textPath></text></g>`
    );
    sea.label = seaPath.box;
  }

  const [vx0, vy0, vx1, vy1] = frame;
  const sw = 6000;
  const size = opts.size ? ` width="${opts.size[0]}" height="${opts.size[1]}"` : "";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" class="lf"${size} viewBox="${f(vx0)} ${f(vy0)} ${f(vx1 - vx0)} ${f(vy1 - vy0)}" role="group" aria-label="A chart of an island called ${xml(islandName)}">
<style>${opts.fontCSS || ""}${sheet(T)}</style>
<defs><pattern id="lf-hatch" patternUnits="userSpaceOnUse" width="2.6" height="2.6" patternTransform="rotate(58)"><path class="hatch-line" d="M0 0V2.6"/></pattern>${defs.join("")}</defs>
<rect class="sea" x="${f(vx0 - sw)}" y="${f(vy0 - sw)}" width="${f(vx1 - vx0 + 2 * sw)}" height="${f(vy1 - vy0 + 2 * sw)}"/>
<g class="lf-web">${web}</g>
<g class="lf-rings">${rings}</g>
<g class="lf-lands">${landSvg}${under.join("")}</g>
<g class="lf-relief">${relief.map((r) => r[1]).join("")}</g>
<g class="lf-marks">${marks.join("")}${furniture}</g>
<g class="lf-labels">${labels.join("")}</g>
${cartouche}
${opts.paper ? paper(frame, opts.theme === "dark", opts.paper !== "plain") : ""}
</svg>`;

  // The gazetteer: stories with this island's names filled in.
  const fillText = (p) =>
    p.story
      .replace(/\{island\}/g, islandName)
      .replace(/\{dir\}/g, DIRS[p.side])
      .replace(/\{dirn\}/g, DIRN[p.side]);
  const order = ["island", "sea", "town", "hamlet", "peak", "river", "lake", "forest", "light", "cape", "bay", "islet", "isle", "creature"];
  const rank = (id) => {
    const i = order.findIndex((o) => id.startsWith(o));
    return i < 0 ? 99 : i;
  };
  const gazetteer = places
    .filter((p) => p.label || p.id === "creature" || p.id === "island")
    .sort((a, b) => rank(a.id) - rank(b.id))
    .map((p) => {
      const renamed = p.name !== p.orig;
      return { id: p.id, name: p.name, kind: p.kind, text: (renamed ? `Charted first as ${p.orig}. ` : "") + fillText(p), at: p.at, renamed };
    });

  const coastLeagues = Math.round(main.coastLen / LEAGUE / 10) * 10;
  const areaLeagues = Math.round((main.area / (LEAGUE * LEAGUE)) / 100) * 100;
  return { svg, frame, places: gazetteer, name: islandName, date, coastLeagues, areaLeagues, theme: opts.theme === "dark" ? "dark" : "light" };
}

// A random island for people who'd rather not draw: a wobbly blob with a
// peninsula or two, in raw screen-ish units (it gets normalised like a stroke).
export function randomShape(seed) {
  const R = rng(seed * 7 + 1);
  const n = 90;
  const lobes = Array.from({ length: 5 }, () => [R() * Math.PI * 2, 0.1 + R() * 0.28, 2 + Math.floor(R() * 4)]);
  const spurs = Array.from({ length: 1 + Math.floor(R() * 3) }, () => [R() * Math.PI * 2, 0.35 + R() * 0.6, 0.18 + R() * 0.2]);
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    let r = 1;
    for (const [ph, amp, k] of lobes) r += amp * Math.sin(k * a + ph) / k;
    for (const [c, amp, w] of spurs) {
      let d = Math.abs(a - c);
      d = Math.min(d, Math.PI * 2 - d);
      r += amp * Math.exp(-(d * d) / (2 * w * w * 0.25));
    }
    out.push([Math.cos(a) * r * 200 * 1.25, Math.sin(a) * r * 200 * 0.85]);
  }
  return out;
}
