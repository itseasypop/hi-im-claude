// Fathom: a daily sounding. Somewhere in a square of fogbound sea there is an
// island; you find it with a lead line. Pure functions, no DOM, so the page
// and the tests (and a curious Node session) all agree on every depth.
//
// Every puzzle comes from its number alone: No. 1 is 25 September 2026 and
// each local day after it is the next. The island is one of Landfall's own
// random coasts, charted by landfall/chart.js when it's found.

import { normalizer, prepare, randomShape, encode, coastSeed } from "../landfall/chart.js";
import { rng, hashString, roughen, inside, bbox } from "../atlas/draw.js";

export const LAUNCH = Date.UTC(2026, 8, 25); // No. 1
export const CASTS = 10; // casts before the fog closes in for the day
export const SEA = 2400; // the square of sea the island is hidden in, world units
export const STEP = 11; // world units of distance from the coast per fathom of depth
export const NO_BOTTOM = 40; // the deep-sea lead's line runs out here

// Which puzzle is it, for someone whose clock says `d`? Local days, so the
// island changes at the reader's own midnight.
export const numberFor = (d = new Date()) => Math.round((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - LAUNCH) / 864e5) + 1;
export const dateOf = (no) => new Date(LAUNCH + (no - 1) * 864e5);

/* ---------------- the puzzle ---------------- */

export function puzzle(no) {
  const R = rng(parseInt(hashString("fathom:" + no), 36));
  let sketch = null;
  for (let tries = 0; !sketch && tries < 20; tries++) {
    const raw = randomShape(Math.floor(R() * 1e6));
    const N = normalizer(raw);
    sketch = prepare(raw.map(N.map));
  }
  const seed = 1 + Math.floor(R() * 0xfffffe);
  const day = Math.floor(LAUNCH / 864e5) + no - 1;
  const state = { seed, day, islands: [sketch] };
  // The same coast chart() will draw (its roughening is seeded by the sketch).
  const coast = roughen(sketch, coastSeed(sketch), { minLen: 5, rough: 0.26 });
  // Place the sea around the island, not the island in the sea: any spot
  // that keeps the whole coast at least `m` from the edge.
  // It's never under the middle of the sea, where everyone casts first.
  const [x0, y0, x1, y1] = bbox(coast);
  const m = 70;
  let sea;
  for (let tries = 0; tries < 50; tries++) {
    const sx = Math.round(x1 + m - SEA + R() * (SEA - (x1 - x0) - 2 * m));
    const sy = Math.round(y1 + m - SEA + R() * (SEA - (y1 - y0) - 2 * m));
    sea = [sx, sy, sx + SEA, sy + SEA];
    const mid = [sx + SEA / 2, sy + SEA / 2];
    if (!inside(mid, coast) && coastDistance(mid, coast) > 220) break;
  }
  // Where the lead starts: the ship comes in from a random edge of the sea.
  const side = Math.floor(R() * 4);
  const t = 0.2 + R() * 0.6;
  const start = [
    [sea[0] + t * SEA, sea[1] + 110],
    [sea[2] - 110, sea[1] + t * SEA],
    [sea[0] + t * SEA, sea[3] - 110],
    [sea[0] + 110, sea[1] + t * SEA],
  ][side].map(Math.round);
  return { no, state, code: encode(state), coast, sea, start, noise: Math.floor(R() * 1e9), centre: centroid(coast) };
}

const centroid = (pts) => {
  let a = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const k = pts[j][0] * pts[i][1] - pts[i][0] * pts[j][1];
    a += k;
    cx += (pts[j][0] + pts[i][0]) * k;
    cy += (pts[j][1] + pts[i][1]) * k;
  }
  return [cx / (3 * a), cy / (3 * a)];
};

/* ---------------- the lead ---------------- */

const segDist = (p, a, b) => {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const L = dx * dx + dy * dy;
  const t = L ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L)) : 0;
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
};

export const coastDistance = (p, coast) => {
  let d = Infinity;
  for (let i = 0, j = coast.length - 1; i < coast.length; j = i++) d = Math.min(d, segDist(p, coast[j], coast[i]));
  return d;
};

// Smooth value noise in [-1, 1], so the seabed has banks and hollows rather
// than being a perfect cone round the island.
const lattice = (seed, i, j) => {
  let h = Math.imul(i, 374761393) ^ Math.imul(j, 668265263) ^ seed;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const noise = (seed, x, y, cell = 260) => {
  const gx = x / cell;
  const gy = y / cell;
  const i = Math.floor(gx);
  const j = Math.floor(gy);
  const s = (t) => t * t * (3 - 2 * t);
  const u = s(gx - i);
  const v = s(gy - j);
  const a = lattice(seed, i, j);
  const b = lattice(seed, i + 1, j);
  const c = lattice(seed, i, j + 1);
  const d = lattice(seed, i + 1, j + 1);
  return (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v) * 2 - 1;
};

// What the lead brings up in its tallow. Near the coast it depends on the
// shore; further out the bottom is finer, until it's ooze.
const BOTTOMS = [
  [60, [["s", "sand"], ["sh", "shells"], ["g", "gravel"], ["r", "rock"]]],
  [160, [["s", "sand"], ["s.sh", "sand and shells"], ["sh", "broken shells"], ["g", "gravel"]]],
  [300, [["gy.s", "grey sand"], ["f.s", "fine sand"], ["s.m", "sandy mud"]]],
  [Infinity, [["m", "mud"], ["oz", "ooze"], ["gy.m", "grey mud"]]],
];

// Cast the lead at world point p. Returns what the leadsman would report.
export function sound(pz, p) {
  if (inside(p, pz.coast)) return { land: true, depth: 0 };
  const d = coastDistance(p, pz.coast);
  const depth = Math.max(1, Math.round(1 + (d / STEP) * (1 + 0.08 * noise(pz.noise, p[0], p[1]))));
  if (depth > NO_BOTTOM) return { land: false, none: true, depth: NO_BOTTOM };
  const pool = BOTTOMS.find(([r]) => d < r)[1];
  const k = Math.floor(((noise(pz.noise + 7, p[0], p[1], 120) + 1) / 2) * pool.length * 0.999);
  const [code, name] = pool[k];
  return { land: false, depth, bottom: code, bottomName: name };
}

/* ---------------- the leadsman's calls ---------------- */

const WORDS = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty"];
const TENS = { 2: "twenty", 3: "thirty", 4: "forty" };
export const inWords = (n) => (n <= 20 ? WORDS[n] : TENS[Math.floor(n / 10)] + (n % 10 ? "-" + WORDS[n % 10] : ""));
const MARKS = new Set([2, 3, 5, 7, 10, 13, 15, 17, 20]);

// A hand lead line has marks (leather, calico, bunting, serge) at 2, 3, 5, 7,
// 10, 13, 15, 17 and 20 fathoms; the fathoms between are "deeps". Deeper than
// twenty, the deep-sea lead goes over and the depth is just called out.
export const call = (r) => {
  if (r.land) return "Land!";
  if (r.none) return `No bottom at ${inWords(NO_BOTTOM)}!`;
  if (r.depth === 2) return "By the mark twain!";
  if (r.depth <= 20) return `By the ${MARKS.has(r.depth) ? "mark" : "deep"} ${inWords(r.depth)}!`;
  return `${inWords(r.depth)[0].toUpperCase() + inWords(r.depth).slice(1)} fathoms!`;
};

// One square per cast, for sharing: how deep the water was.
export const square = (r) => (r.land ? "🏝️" : r.none ? "⬛" : r.depth > 20 ? "🟦" : r.depth > 7 ? "🟩" : "🟨");

// Birds: frigatebirds can't settle on the water, so they sleep ashore. If
// three casts in a row have found no bottom, one flies over, heading for land.
const COMPASS = ["east", "south-east", "south", "south-west", "west", "north-west", "north", "north-east"];
export const bird = (pz, from) => {
  const [cx, cy] = pz.centre;
  const a = Math.atan2(cy - from[1], cx - from[0]);
  return COMPASS[((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8];
};
