// Turns real weather-model numbers into a shipping forecast.
//
// Pure: no fetching, no clocks. api/forecast.js gathers hourly readings for
// every sample point in every area (and a pressure grid), and compose() writes
// the bulletin in the conventions of the real Shipping Forecast, as the Met
// Office's glossary defines them: Beaufort forces, gale warnings, "veering" and
// "backing", "soon" (6 to 12 hours from issue) and "later" (more than 12), sea
// states by wave height, visibility by distance.
import { AREAS, GRID, toLatLon, realMiles, leagues, areaAt, insidePoly } from "./areas.js";

/* ---------------- words ---------------- */

// Beaufort force from a mean wind speed in knots.
const BF = [1, 4, 7, 11, 17, 22, 28, 34, 41, 48, 56, 64];
export const beaufort = (kn) => BF.filter((t) => Math.round(kn) >= t).length;
// Gusts alone make a gale: the Met Office counts gusts of 43 knots or more as
// gale force 8, 52 as 9, 61 as 10, 69 as 11.
const gustForce = (kn) => (kn >= 69 ? 11 : kn >= 61 ? 10 : kn >= 52 ? 9 : kn >= 43 ? 8 : 0);

const FORCE_NAME = { 8: "gale 8", 9: "severe gale 9", 10: "storm 10", 11: "violent storm 11", 12: "hurricane force 12" };
export const forceWord = (f) => FORCE_NAME[Math.min(f, 12)] || String(f);
const WARN_NAME = { 8: "gale force 8", 9: "severe gale force 9", 10: "storm force 10", 11: "violent storm force 11", 12: "hurricane force 12" };

export const forceRange = (lo, hi) => {
  if (lo === hi) return forceWord(hi);
  return `${forceWord(lo)} ${hi === lo + 1 ? "or" : "to"} ${forceWord(hi)}`;
};

const POINTS = ["northerly", "northeasterly", "easterly", "southeasterly", "southerly", "southwesterly", "westerly", "northwesterly"];
const HEADINGS = ["north", "northeast", "east", "southeast", "south", "southwest", "west", "northwest"];
const point8 = (deg) => ((Math.round((((deg % 360) + 360) % 360) / 45) % 8) + 8) % 8;
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// Sea state by significant wave height, in metres.
const SEA = [[0.5, "smooth"], [1.25, "slight"], [2.5, "moderate"], [4, "rough"], [6, "very rough"], [9, "high"], [14, "very high"], [Infinity, "phenomenal"]];
const seaIndex = (m) => SEA.findIndex(([t]) => m < t);

// Visibility, worst first: very poor < 1000 m, poor < 2 nautical miles,
// moderate < 5 nautical miles, good beyond.
const VIS = ["very poor", "poor", "moderate", "good"];
const visIndex = (m) => (m < 1000 ? 0 : m < 3704 ? 1 : m < 9260 ? 2 : 3);

const quantile = (arr, q) => {
  if (!arr.length) return NaN;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.round(q * (s.length - 1))))];
};

// The strongest wind worth mentioning: the highest mean wind, or the highest
// gust-made force if it turns up in at least two readings (one gust is noise).
const robustMax = (sustained, eff) => {
  const e = [...eff].sort((a, b) => b - a);
  return Math.max(Math.max(...sustained), e.length > 1 ? e[1] : 0);
};

const timing = (h) => (h < 6 ? "imminent" : h < 12 ? "soon" : "later");

/* ---------------- one area ---------------- */

// `pts` is a list of sample points, each { kn:[], dir:[], gust:[], code:[], vis:[], wave:[] }
// with one value per hour from the issue (hour 0) to hour 24.
const windowOf = (pts, a, b) => {
  const f = [];
  const eff = [];
  let u = 0;
  let v = 0;
  let n = 0;
  const hist = new Array(8).fill(0);
  for (const p of pts)
    for (let h = a; h < b && h < p.kn.length; h++) {
      const kn = p.kn[h];
      const d = p.dir[h];
      if (kn == null || d == null) continue;
      const bf = beaufort(kn);
      f.push(bf);
      eff.push(Math.max(bf, gustForce(p.gust[h] ?? 0)));
      const r = (d * Math.PI) / 180;
      u += Math.sin(r);
      v += Math.cos(r);
      n++;
      hist[point8(d)]++;
    }
  if (!n) return null;
  const mean = ((Math.atan2(u, v) * 180) / Math.PI + 360) % 360;
  const R = Math.hypot(u, v) / n;
  let lo = quantile(f, 0.15);
  const hi = quantile(f, 0.85);
  if (hi - lo > 2) lo = hi - 2;
  return { lo, hi, max: robustMax(f, eff), mean, R, hist, n, median: quantile(f, 0.5) };
};

const dirText = (w) => {
  if (w.hi <= 3 && w.R < 0.8) return "variable";
  if (w.R < 0.5 && w.hi >= 5) return "cyclonic";
  const i = point8(w.mean);
  // A second point, if a good share of the readings sit in the neighbouring one.
  const left = (i + 7) % 8;
  const right = (i + 1) % 8;
  const j = w.hist[left] >= w.hist[right] ? left : right;
  if (w.hist[j] >= 0.3 * w.n && w.hist[j] >= 0.5 * w.hist[i]) {
    const [a, b] = j === left ? [left, i] : [i, right];
    return `${POINTS[a]} or ${POINTS[b]}`;
  }
  return POINTS[i];
};

const forceText = (w, dir) => (dir === "variable" ? `${Math.max(w.hi, 2)} or less` : forceRange(w.lo, w.hi));

// The area's wind, hour by hour: mean direction and median force of its points.
const hourly = (pts) => {
  const H = pts[0].kn.length;
  const out = [];
  for (let h = 0; h < H; h++) {
    let u = 0;
    let v = 0;
    const kns = [];
    for (const p of pts) {
      if (p.kn[h] == null || p.dir[h] == null) continue;
      const r = (p.dir[h] * Math.PI) / 180;
      u += Math.sin(r) * p.kn[h];
      v += Math.cos(r) * p.kn[h];
      kns.push(p.kn[h]);
    }
    if (!kns.length) {
      // A missing hour: carry the last one forward.
      out.push(out.length ? { ...out[out.length - 1] } : { dir: 0, kn: 0, force: 0 });
      continue;
    }
    const kn = quantile(kns, 0.5);
    out.push({ dir: Math.round(((Math.atan2(u, v) * 180) / Math.PI + 360) % 360), kn: Math.round(kn * 10) / 10, force: beaufort(kn) });
  }
  return out;
};

const signedTurn = (a, b) => ((((b - a) % 360) + 540) % 360) - 180;

const windText = (pts, hours) => {
  const all = windowOf(pts, 0, 25);
  if (!all) throw new Error("no wind readings");
  const A = windowOf(pts, 0, 6) || all;
  const C = windowOf(pts, 12, 25) || all;
  const dA = dirText(A);
  const dC = dirText(C);
  // Net turn of the wind from the first hours to the last, followed hour by hour.
  let turn = 0;
  for (let h = 1; h < hours.length; h++) if (hours[h].kn >= 3 && hours[h - 1].kn >= 3) turn += signedTurn(hours[h - 1].dir, hours[h].dir);
  const dirChanged = dA !== dC && (dA === "variable" || dC === "variable" || dA === "cyclonic" || dC === "cyclonic" || Math.abs(turn) >= 40);
  const forceChanged = Math.abs(C.median - A.median) >= 2 || (C.lo !== A.lo && C.hi !== A.hi && Math.abs(C.hi - A.hi) >= 1 && Math.abs(C.median - A.median) >= 1);

  let text = `${cap(dA)} ${forceText(A, dA)}`;
  const occA = A.max >= 8 && A.max > A.hi ? A.max : 0;
  if (occA) text += `, occasionally ${forceWord(occA)}`;

  if (!dirChanged && !forceChanged) {
    // Steady: one description covers the day, with the day's worst as "occasionally".
    const peak = all.max > Math.max(A.hi, occA) && (all.max >= 7 || all.max - A.hi >= 2) ? all.max : 0;
    if (peak) {
      let at = 0;
      while (at < hours.length - 1 && windowOf(pts, 0, at + 1).max < peak) at++;
      text += `, ${occA ? "perhaps" : "occasionally"} ${forceWord(peak)}${at >= 6 ? ` ${timing(at)}` : ""}`;
    }
    return { text, first: A, last: C, turn, change: null };
  }

  // When did it change? The first hour that looks more like the end than the start.
  const endDir = C.mean;
  let onset = 12;
  for (let h = 1; h < hours.length; h++) {
    const hd = hours[h];
    const nearEnd = dirChanged
      ? Math.abs(signedTurn(hd.dir, endDir)) < Math.abs(signedTurn(hd.dir, A.mean))
      : Math.abs(hd.force - C.median) < Math.abs(hd.force - A.median);
    if (nearEnd) {
      onset = h;
      break;
    }
  }

  let clause;
  if (dirChanged) {
    if (dC === "variable") clause = `becoming variable ${forceText(C, dC)}`;
    else if (dC === "cyclonic") clause = `becoming cyclonic ${forceText(C, dC)}`;
    else if (dA === "variable" || dA === "cyclonic") clause = `becoming ${dC} ${forceText(C, dC)}`;
    else {
      clause = `${turn > 0 ? "veering" : "backing"} ${dC}`;
      if (C.lo !== A.lo || C.hi !== A.hi) clause += ` ${forceText(C, dC)}`;
    }
  } else {
    clause = `${C.median > A.median ? "increasing" : "decreasing"} ${forceText(C, dC)}`;
  }
  const occC = C.max >= 8 && C.max > C.hi ? C.max : 0;
  if (occC) clause += `, occasionally ${forceWord(occC)}`;

  if (onset < 6) text += ` at first, ${clause}`;
  else text += `, ${clause} ${timing(onset)}`;
  return { text, first: A, last: C, turn, change: { onset } };
};

const seaText = (pts) => {
  const idx = (a, b) => {
    const hs = [];
    for (const p of pts) for (let h = a; h < b && h < p.wave.length; h++) if (p.wave[h] != null) hs.push(p.wave[h]);
    if (!hs.length) return null;
    return { lo: seaIndex(quantile(hs, 0.15)), hi: seaIndex(quantile(hs, 0.85)), max: seaIndex(Math.max(...hs)) };
  };
  const E = idx(0, 12);
  const L = idx(12, 25);
  if (!E) return null;
  const words = ({ lo, hi }) => {
    const a = Math.max(lo, hi - 1);
    return a === hi ? SEA[hi][1] : `${SEA[a][1]} or ${SEA[hi][1]}`;
  };
  let text = words(E);
  if (L) {
    if (L.lo > E.hi) text += `, becoming ${words(L)} later`;
    else if (L.hi < E.lo) text += `, becoming ${words(L)} later`;
    else if (L.max > E.hi) text += `, occasionally ${SEA[L.max][1]} later`;
    else if (E.max > E.hi) text += `, occasionally ${SEA[E.max][1]}`;
  }
  return cap(text);
};

// WMO weather codes, as the models give them, sorted into forecast words.
const wxKind = (c) =>
  c >= 95 ? "thunder" : c >= 85 ? "wintry" : c >= 80 ? "showers" : c >= 71 ? "snow" : c >= 61 ? "rain" : c >= 51 ? "drizzle" : c >= 45 ? "fog" : "fair";

const wxWindow = (pts, a, b) => {
  const count = {};
  let n = 0;
  for (const p of pts)
    for (let h = a; h < b && h < p.code.length; h++) {
      if (p.code[h] == null) continue;
      const k = wxKind(p.code[h]);
      // Light drizzle (51) is the models' way of saying "low cloud" at sea: half weight.
      count[k] = (count[k] || 0) + (p.code[h] === 51 ? 0.5 : 1);
      n++;
    }
  if (!n) return "fair";
  const fr = (k) => (count[k] || 0) / n;
  const wet = ["rain", "showers", "drizzle", "snow", "wintry", "thunder"];
  const pWet = wet.reduce((s, k) => s + fr(k), 0);
  let word;
  if (fr("thunder") >= 0.12) word = "thundery showers";
  else if (pWet < 0.12) word = "fair";
  else {
    const main = wet.filter((k) => k !== "thunder").sort((x, y) => fr(y) - fr(x))[0];
    const often = fr(main) >= 0.45;
    word = { rain: often ? "rain" : "occasional rain", showers: "showers", drizzle: often ? "drizzle" : "occasional drizzle", snow: often ? "snow" : "occasional snow", wintry: "wintry showers" }[main];
    if (fr("thunder") >= 0.04 && main === "showers") word = "showers, perhaps thundery";
  }
  if (fr("fog") >= 0.15) word = word === "fair" ? "fog patches" : `${word}, fog patches`;
  return word;
};

const weatherText = (pts) => {
  const E = wxWindow(pts, 0, 12);
  const L = wxWindow(pts, 12, 25);
  if (E === L) return cap(E);
  if (E === "fair") return cap(`${L} later`);
  if (L === "fair") return cap(`${E}, fair later`);
  return cap(`${E} then ${L}`);
};

const visText = (pts) => {
  const vis = [];
  const late = [];
  for (const p of pts)
    for (let h = 0; h < p.vis.length; h++) {
      let m = p.vis[h];
      if (m == null) {
        // No visibility from the model: judge it from the weather instead.
        const k = wxKind(p.code[h] ?? 0);
        m = k === "fog" ? 800 : k === "drizzle" ? 3000 : k === "rain" || k === "snow" ? 6000 : 20000;
      }
      vis.push(m);
      if (h >= 12) late.push(m);
    }
  if (!vis.length) return null;
  const typ = visIndex(quantile(vis, 0.4));
  const best = visIndex(quantile(vis, 0.8));
  const worst = visIndex(quantile(vis, 0.06));
  let text;
  if (best === typ) text = VIS[typ];
  else {
    const hi = Math.min(best, typ + 1);
    // The Met Office says "moderate or good", "moderate or poor", "poor or very poor".
    text = hi === 3 ? `${VIS[typ]} or good` : typ === 1 && hi === 2 ? "moderate or poor" : `${VIS[hi]} or ${VIS[typ]}`;
  }
  if (worst < typ) {
    const onlyLate = late.length && vis.slice(0, vis.length - late.length).every((m) => visIndex(m) > worst);
    text += `, occasionally ${VIS[worst]}${onlyLate ? " later" : ""}`;
  }
  return cap(text);
};

const galeOf = (pts, hours) => {
  const f = [];
  const eff = [];
  for (let h = 0; h < hours.length; h++)
    for (const p of pts) {
      const bf = beaufort(p.kn[h] ?? 0);
      f.push(bf);
      eff.push(Math.max(bf, gustForce(p.gust[h] ?? 0)));
    }
  const max = robustMax(f, eff);
  if (max < 8) return null;
  const n = pts.length;
  // Onset: the first hour at which the gale-making readings have begun.
  let first = -1;
  let seen = 0;
  for (let i = 0; i < eff.length && first < 0; i++) if (eff[i] >= 8 && (f[i] >= 8 || ++seen >= 2)) first = Math.floor(i / n);
  if (first < 0) first = 0;
  const at = hours.reduce((best, h, i) => (h.force > hours[best].force ? i : best), first);
  const dir = POINTS[point8(hours[at].dir)];
  return { force: max, onset: first, dir, text: `${cap(dir)} ${WARN_NAME[Math.min(max, 12)]} ${first < 6 ? "imminent" : `expected ${timing(first)}`}` };
};

/* ---------------- the synopsis ---------------- */

const gridAt = (vals, i, j) => vals[j * GRID.nx + i];

// Highs and lows on the pressure grid, placed between grid points by fitting
// a parabola through each extreme and its neighbours.
export const systems = (vals) => {
  const found = [];
  for (let j = 0; j < GRID.ny; j++)
    for (let i = 0; i < GRID.nx; i++) {
      const v = gridAt(vals, i, j);
      if (v == null) continue;
      let isMin = true;
      let isMax = true;
      const around = [];
      for (let dj = -1; dj <= 1; dj++)
        for (let di = -1; di <= 1; di++) {
          if (!di && !dj) continue;
          const w = i + di >= 0 && i + di < GRID.nx && j + dj >= 0 && j + dj < GRID.ny ? gridAt(vals, i + di, j + dj) : null;
          if (w == null) continue;
          around.push(w);
          if (w <= v) isMin = false;
          if (w >= v) isMax = false;
        }
      if (!isMin && !isMax) continue;
      const edge = i === 0 || j === 0 || i === GRID.nx - 1 || j === GRID.ny - 1;
      const fit = (a, b) => {
        if (a == null || b == null) return [0, 0];
        const den = a - 2 * v + b;
        if (!den) return [0, 0];
        const o = Math.max(-0.5, Math.min(0.5, (a - b) / (2 * den)));
        return [o, -0.25 * (a - b) * o];
      };
      const [ox, vx] = fit(i > 0 ? gridAt(vals, i - 1, j) : null, i < GRID.nx - 1 ? gridAt(vals, i + 1, j) : null);
      const [oy, vy] = fit(j > 0 ? gridAt(vals, i, j - 1) : null, j < GRID.ny - 1 ? gridAt(vals, i, j + 1) : null);
      const p = Math.round(v + vx + vy);
      const relief = Math.abs(around.reduce((s, w) => s + w, 0) / around.length - v);
      found.push({ type: isMin ? "low" : "high", at: [Math.round(GRID.x0 + (i + ox) * GRID.dx), Math.round(GRID.y0 + (j + oy) * GRID.dy)], p, edge, relief });
    }
  return found.filter((s) => (s.type === "low" ? s.p <= 1012 : s.p >= 1018) && s.relief >= 0.6);
};

const distToPoly = ([x, y], poly) => {
  let best = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const [ax, ay] = poly[i];
    const [bx, by] = poly[(i + 1) % poly.length];
    const dx = bx - ax;
    const dy = by - ay;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
    best = Math.min(best, Math.hypot(x - ax - t * dx, y - ay - t * dy));
  }
  return best;
};

// "Morrow", or "just west of Hitherto", or "300 leagues north of Matutinum".
export const whereIs = (p) => {
  const a = areaAt(p);
  if (a) return a.name;
  let near = null;
  let d = Infinity;
  for (const ar of AREAS) {
    const dd = distToPoly(p, ar.poly);
    if (dd < d) {
      d = dd;
      near = ar;
    }
  }
  // Direction from the area to the point: from its nearest edge, not its middle.
  const xs = near.poly.map((q) => q[0]);
  const ys = near.poly.map((q) => q[1]);
  const cx = Math.max(Math.min(...xs), Math.min(Math.max(...xs), p[0]));
  const cy = Math.max(Math.min(...ys), Math.min(Math.max(...ys), p[1]));
  const ang = (Math.atan2(p[0] - cx, -(p[1] - cy)) * 180) / Math.PI;
  const dir = HEADINGS[point8(ang)];
  const lg = leagues(d);
  if (lg < 60) return `just ${dir} of ${near.name}`;
  return `${Math.round(lg / 50) * 50} leagues ${dir} of ${near.name}`;
};

const speedWord = (kn) => (kn < 15 ? "slowly" : kn < 25 ? "steadily" : kn < 35 ? "rather quickly" : kn < 45 ? "rapidly" : "very rapidly");

const hhmm = (t) => new Date(t).toISOString().slice(11, 13) + "00";
const byWhen = (t) => {
  const h = new Date(t).getUTCHours();
  return h === 12 ? "midday tomorrow" : h === 0 ? "midnight tonight" : `${hhmm(t)} tomorrow`;
};

const synopsisOf = (p0, p24, issue) => {
  const s0 = systems(p0);
  const s24 = systems(p24);
  const by = byWhen(issue + 864e5);
  const near = (t, s) => Math.hypot(t.at[0] - s.at[0], t.at[1] - s.at[1]);
  const place = (at, p) => {
    const w = whereIs(at);
    return /^(just|\d)/.test(w) ? `${w}, ${p}` : `${w} ${p}`;
  };
  const trendOf = (s, dp) => (Math.abs(dp) < 3 ? "little change" : s.type === "low" ? (dp < 0 ? "deepening" : "filling") : dp > 0 ? "building" : "declining");

  // Match each system now with the nearest of its kind tomorrow. A system on
  // the edge of the grid may really be further out, so it's only mentioned if
  // it's strong, or coming in, and its movement is only claimed if both ends
  // of it are inside the grid.
  const used = new Set();
  const cands = s0
    .map((s) => {
      let best = -1;
      s24.forEach((t, k) => {
        if (t.type === s.type && near(t, s) < 3600 && (best < 0 || near(t, s) < near(s24[best], s))) best = k;
      });
      return { s, t: best >= 0 ? s24[best] : null, k: best };
    })
    .filter(({ s, t }) => !s.edge || (s.type === "low" ? s.p <= 1000 : s.p >= 1028) || (t && !t.edge));
  const lows = cands.filter((c) => c.s.type === "low").sort((x, y) => x.s.p - y.s.p).slice(0, 2);
  const highs = cands.filter((c) => c.s.type === "high").sort((x, y) => y.s.p - x.s.p).slice(0, 1);

  const lines = [];
  const out = [];
  for (const { s, t, k } of [...lows, ...highs]) {
    const head = `${s.type === "low" ? "Low" : "High"}, ${place(s.at, s.p)}`;
    if (!t || used.has(k)) {
      lines.push(`${head}, ${s.type === "low" ? "losing its identity" : "declining"} by ${by}`);
      out.push({ ...s, to: null });
      continue;
    }
    used.add(k);
    const miles = realMiles(s.at, t.at);
    if (s.edge && t.edge) lines.push(`${head}, ${trendOf(s, t.p - s.p)}`);
    else if (miles < 150) lines.push(`${head}, slow-moving, ${trendOf(s, t.p - s.p)}`);
    else {
      const ang = (Math.atan2(t.at[0] - s.at[0], -(t.at[1] - s.at[1])) * 180) / Math.PI;
      const moving = `moving ${speedWord(miles / 24)} ${HEADINGS[point8(ang)]}`;
      // Heading off the edge of what we can see: say where it's going, not where it'll be.
      lines.push(t.edge ? `${head}, ${moving} and out of the area` : `${head}, ${moving}, expected ${place(t.at, t.p)} by ${by}`);
    }
    out.push({ ...s, to: { at: t.at, p: t.p } });
  }
  // A new low that isn't there yet but will be: the most interesting news of all.
  const fresh = s24
    .filter((t) => t.type === "low" && !t.edge && t.p <= 1008 && !s0.some((s) => s.type === "low" && near(t, s) < 3600))
    .sort((x, y) => x.p - y.p)[0];
  if (fresh) {
    lines.push(`New low expected ${place(fresh.at, fresh.p)} by ${by}`);
    out.push({ ...fresh, fresh: true });
  }
  const text = lines.length ? lines.join(". ") + "." : "No marked highs or lows. Pressure is slack over Elsewhere, with little change.";
  return { time: hhmm(issue), text, systems: out };
};

/* ---------------- the bulletin ---------------- */

// data: { issue (ms), areas: { [id]: [point, ...] }, grid: { p0: [], p12: [], p24: [] } }
export const compose = (data) => {
  const areas = AREAS.map((a) => {
    const pts = data.areas[a.id];
    const hours = hourly(pts);
    const wind = windText(pts, hours);
    const gale = galeOf(pts, hours);
    let windWords = wind.text;
    // A gale warning must show in the area's own wind, as it does on the radio.
    if (gale && !/gale|storm|hurricane/.test(windWords)) windWords += `, occasionally ${forceWord(gale.force)}${gale.onset >= 6 ? ` ${timing(gale.onset)}` : ""}`;
    return {
      id: a.id,
      name: a.name,
      wind: windWords,
      sea: seaText(pts) || "Moderate",
      weather: weatherText(pts),
      visibility: visText(pts) || "Good",
      gale,
      hours: hours.map((h) => [h.dir, h.kn, h.force]),
    };
  });

  // Neighbours in the reading order with the same forecast are read together.
  const groups = [];
  for (const a of areas) {
    const g = groups[groups.length - 1];
    const same = g && g.wind === a.wind && g.sea === a.sea && g.weather === a.weather && g.visibility === a.visibility;
    if (same) g.ids.push(a.id), g.names.push(a.name);
    else groups.push({ ids: [a.id], names: [a.name], wind: a.wind, sea: a.sea, weather: a.weather, visibility: a.visibility });
  }

  const warned = areas.filter((a) => a.gale);
  return {
    v: 1,
    issue: new Date(data.issue).toISOString(),
    until: new Date(data.issue + 864e5).toISOString(),
    warnings: warned.map((a) => ({ id: a.id, name: a.name, text: a.gale.text, force: a.gale.force })),
    synopsis: synopsisOf(data.grid.p0, data.grid.p24, data.issue),
    areas,
    groups,
    grid: { ...GRID, p0: data.grid.p0, p12: data.grid.p12, p24: data.grid.p24 },
  };
};

// For the "About" section: where each area's weather comes from.
export const twinOf = (area) => {
  const xs = area.poly.map((p) => p[0]);
  const ys = area.poly.map((p) => p[1]);
  const [lat, lon] = toLatLon([(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2]);
  return { lat, lon };
};

export { insidePoly };
