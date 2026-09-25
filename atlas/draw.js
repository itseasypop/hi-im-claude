// Drawing primitives for the charts on this site: seeded randomness, coastline
// roughening, geometry helpers, and the ink glyphs (mountains, trees, towns,
// lighthouse, compass rose, rhumb lines, the octopus...). Pure functions that
// return SVG strings, with no Node or DOM dependencies, so the atlas build
// (scripts/atlas/build.mjs) and Landfall (/landfall, in the browser) share them.
//
// Changing a glyph here changes how the atlas draws it. Coastlines are safe
// (they're frozen in coasts.json), but check the atlas after any edit:
// rebuild it and diff atlas.html.

/* ---------------- small utilities ---------------- */

export const rng = (seed) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

export const hashString = (s) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
};

export const f = (n) => String(Math.round(n * 10) / 10);
export const pt = (p) => `${f(p[0])} ${f(p[1])}`;
export const poly = (pts, close = true) => "M" + pts.map(pt).join(" ") + (close ? "Z" : "");
export const esc = (s) => s.replace(/&(?![a-z#0-9]+;)/gi, "&amp;").replace(/</g, "&lt;");
export const strip = (html) => html.replace(/<[^>]+>/g, "");
export const attr = (s) => strip(s).replace(/&rsquo;/g, "’").replace(/&ldquo;|&rdquo;/g, '"').replace(/"/g, "&quot;");
export const deg = Math.PI / 180;

export const chaikin = (pts, closed = true) => {
  const out = [];
  const n = pts.length;
  const last = closed ? n : n - 1;
  if (!closed) out.push(pts[0]);
  for (let i = 0; i < last; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % n];
    out.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25]);
    out.push([a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
  }
  if (!closed) out.push(pts[n - 1]);
  return out;
};

// Midpoint displacement: split each edge, nudge the midpoint sideways by a
// random amount proportional to the edge's length, recurse until edges are short.
export const roughen = (sketch, seed, { closed = true, minLen = 5, rough = 0.26 } = {}) => {
  const rnd = rng(seed);
  const sub = (a, b) => {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = Math.hypot(dx, dy);
    if (len < minLen) return [];
    const off = (rnd() + rnd() - 1) * rough * len;
    const m = [(a[0] + b[0]) / 2 - (dy / len) * off, (a[1] + b[1]) / 2 + (dx / len) * off];
    return [...sub(a, m), m, ...sub(m, b)];
  };
  const out = [];
  const n = sketch.length;
  const edges = closed ? n : n - 1;
  for (let i = 0; i < edges; i++) out.push(sketch[i], ...sub(sketch[i], sketch[(i + 1) % n]));
  if (!closed) out.push(sketch[n - 1]);
  return chaikin(out, closed).map((p) => [Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10]);
};

export const inside = (p, pts) => {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
};

export const bbox = (pts) => {
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
};

// Scatter points inside a polygon, keeping them apart (dart throwing).
export const scatter = (area, count, gap, seed, avoid = () => false) => {
  const rnd = rng(seed);
  const [x0, y0, x1, y1] = bbox(area);
  const out = [];
  for (let tries = 0; tries < count * 60 && out.length < count; tries++) {
    const p = [x0 + rnd() * (x1 - x0), y0 + rnd() * (y1 - y0)];
    if (!inside(p, area) || avoid(p)) continue;
    if (out.some((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) < gap)) continue;
    out.push(p);
  }
  return out;
};

/* ---------------- glyphs ---------------- */

export const mountain = (x, y, s, cls = "") => {
  const h = s * 1.25;
  const out = `M${f(x - s)} ${f(y)}C${f(x - s * 0.55)} ${f(y - h * 0.35)} ${f(x - s * 0.22)} ${f(y - h * 0.92)} ${f(x + s * 0.04)} ${f(y - h)}C${f(x + s * 0.3)} ${f(y - h * 0.86)} ${f(x + s * 0.62)} ${f(y - h * 0.38)} ${f(x + s)} ${f(y)}`;
  const shade = `M${f(x + s * 0.04)} ${f(y - h)}C${f(x + s * 0.3)} ${f(y - h * 0.86)} ${f(x + s * 0.62)} ${f(y - h * 0.38)} ${f(x + s)} ${f(y)}L${f(x + s * 0.18)} ${f(y)}C${f(x + s * 0.2)} ${f(y - h * 0.4)} ${f(x + s * 0.02)} ${f(y - h * 0.7)} ${f(x + s * 0.04)} ${f(y - h)}Z`;
  return `<g class="mtn ${cls}"><path class="mtn-body" d="${out}"/><path class="mtn-shade" d="${shade}"/><path class="mtn-line" d="${out}"/><path class="mtn-foot" d="M${f(x + s * 0.7)} ${f(y + 0.6)}H${f(x + s * 1.5)}"/></g>`;
};

export const cloud = (x, y, r, seed) => {
  const rnd = rng(seed);
  const puffs = [];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    puffs.push([x + Math.cos(a) * r * 1.35 + (rnd() - 0.5) * 3, y + Math.sin(a) * r * 0.42 + (rnd() - 0.5) * 2, r * (0.42 + rnd() * 0.2)]);
  }
  puffs.push([x, y, r * 0.7]);
  const circles = (cls) => puffs.map(([cx, cy, cr]) => `<circle class="${cls}" cx="${f(cx)}" cy="${f(cy)}" r="${f(cr)}"/>`).join("");
  return `<g class="cloud">${circles("cloud-edge")}${circles("cloud-fill")}</g>`;
};

export const tree = (x, y, r) =>
  `<g class="tree"><path class="tree-trunk" d="M${f(x)} ${f(y)}V${f(y - r * 0.9)}"/><circle class="tree-crown" cx="${f(x)}" cy="${f(y - r * 1.5)}" r="${f(r)}"/><path class="tree-shade" d="M${f(x + r * 0.15)} ${f(y - r * 0.55)}A${f(r)} ${f(r)} 0 0 0 ${f(x + r * 0.95)} ${f(y - r * 1.75)}"/><path class="tree-foot" d="M${f(x + 1)} ${f(y + 0.3)}H${f(x + r * 1.3)}"/></g>`;

export const house = (x, y, w = 6, h = 5) =>
  `<path class="bldg" d="M${f(x - w / 2)} ${f(y)}V${f(y - h)}H${f(x + w / 2)}V${f(y)}Z"/><path class="roof" d="M${f(x - w / 2 - 0.9)} ${f(y - h)}L${f(x)} ${f(y - h - w * 0.6)}L${f(x + w / 2 + 0.9)} ${f(y - h)}Z"/>`;

export const church = (x, y) =>
  `<path class="bldg" d="M${f(x - 2.2)} ${f(y)}V${f(y - 12)}H${f(x + 2.2)}V${f(y)}Z"/><path class="roof" d="M${f(x - 3)} ${f(y - 12)}L${f(x)} ${f(y - 19)}L${f(x + 3)} ${f(y - 12)}Z"/><path class="ink-thin" d="M${f(x)} ${f(y - 19)}V${f(y - 22.5)}M${f(x - 1.4)} ${f(y - 21.2)}H${f(x + 1.4)}"/>`;

export const town = (x, y, size) => {
  if (size === "large") {
    return `<g class="town">${house(x - 11, y + 2)}${house(x + 10, y + 3, 7, 5)}${church(x, y)}${house(x - 5, y + 9, 6, 4.5)}${house(x + 5, y + 10, 6, 4.5)}</g>`;
  }
  return `<g class="town">${house(x - 4, y)}${house(x + 4.5, y + 3, 5.5, 4.5)}</g>`;
};

export const lighthouse = (x, y) => {
  const ly = y - 15.5;
  let rays = "";
  for (const a of [-160, -125, -90, -55, -20]) {
    const c = Math.cos(a * deg);
    const s = Math.sin(a * deg);
    rays += `M${f(x + c * 4.5)} ${f(ly + s * 4.5)}L${f(x + c * 11)} ${f(ly + s * 11)}`;
  }
  return `<g class="lighthouse"><path class="rays" d="${rays}"/><path class="bldg" d="M${f(x - 3.2)} ${f(y)}L${f(x - 2)} ${f(y - 14)}H${f(x + 2)}L${f(x + 3.2)} ${f(y)}Z"/><path class="band" d="M${f(x - 2.7)} ${f(y - 5)}L${f(x - 2.4)} ${f(y - 9)}H${f(x + 2.4)}L${f(x + 2.7)} ${f(y - 5)}Z"/><path class="lamp" d="M${f(x - 2.3)} ${f(y - 14)}V${f(y - 17)}H${f(x + 2.3)}V${f(y - 14)}Z"/><path class="roof" d="M${f(x - 3)} ${f(y - 17)}L${f(x)} ${f(y - 20)}L${f(x + 3)} ${f(y - 17)}Z"/></g>`;
};

export const rock = (x, y) =>
  `<path class="rock" d="M${f(x - 3)} ${f(y)}H${f(x + 3)}M${f(x)} ${f(y - 3)}V${f(y + 3)}"/><circle class="dot" cx="${f(x - 1.6)}" cy="${f(y - 1.6)}" r=".5"/><circle class="dot" cx="${f(x + 1.6)}" cy="${f(y - 1.6)}" r=".5"/><circle class="dot" cx="${f(x - 1.6)}" cy="${f(y + 1.6)}" r=".5"/><circle class="dot" cx="${f(x + 1.6)}" cy="${f(y + 1.6)}" r=".5"/>`;

export const bench = (x, y) =>
  `<path class="ink-thin bench" d="M${f(x - 2.4)} ${f(y)}H${f(x + 2.4)}M${f(x - 1.9)} ${f(y)}V${f(y + 1.4)}M${f(x + 1.9)} ${f(y)}V${f(y + 1.4)}M${f(x - 2.4)} ${f(y - 1.3)}H${f(x + 2.4)}"/>`;

export const waves = (x, y, n = 2, w = 5) => {
  let d = `M${f(x)} ${f(y)}`;
  for (let i = 0; i < n; i++) d += `q${f(w / 2)} ${f(-w * 0.5)} ${f(w)} 0`;
  return `<path class="wave" d="${d}"/>`;
};

export const kettle = (x, y, a = 0) =>
  `<g class="kettle" transform="rotate(${a} ${f(x)} ${f(y)})"><path class="ink-thin" d="M${f(x - 2.8)} ${f(y - 3.4)}Q${f(x)} ${f(y - 8.6)} ${f(x + 2.8)} ${f(y - 3.4)}"/><path class="bldg" d="M${f(x - 3.6)} ${f(y)}Q${f(x - 4.1)} ${f(y - 4.6)} ${f(x)} ${f(y - 5)}Q${f(x + 4.1)} ${f(y - 4.6)} ${f(x + 3.6)} ${f(y)}Z"/><path class="ink-thin" d="M${f(x + 3.2)} ${f(y - 1.8)}L${f(x + 6.4)} ${f(y - 4.4)}"/><circle class="bldg" cx="${f(x)}" cy="${f(y - 5.6)}" r=".8"/></g>`;

// A great polyp whose arms keep their own counsel.
export const octopus = (cx, cy, seed, { kettle: withKettle = true } = {}) => {
  const rnd = rng(seed);
  const back = [];
  const front = [];
  let kettleAt = null;
  const N = 8;
  for (let i = 0; i < N; i++) {
    const phi = (-28 + i * (236 / (N - 1)) + (rnd() - 0.5) * 10) * deg;
    let x = cx + Math.cos(phi) * 9;
    let y = cy + Math.sin(phi) * 6;
    let th = phi;
    const thief = withKettle && i === 0;
    const L = thief ? 92 : 56 + rnd() * 34;
    const ds = 2.2;
    const steps = Math.round(L / ds);
    const sgn = (i % 2 ? 1 : -1) * (i === 3 || i === 4 ? -1 : 1);
    const wob = 0.018 + rnd() * 0.014;
    const ph = rnd() * 6;
    const curl = thief ? 0.05 : 0.3 + rnd() * 0.12;
    const left = [];
    const right = [];
    const suckers = [];
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const w = 6.2 * Math.pow(1 - t, 0.85) + 0.45;
      const nx = -Math.sin(th);
      const ny = Math.cos(th);
      left.push([x + (nx * w) / 2, y + (ny * w) / 2]);
      right.push([x - (nx * w) / 2, y - (ny * w) / 2]);
      if (s % 3 === 1 && t < 0.8 && i > 1 && i < 6) suckers.push([x - nx * w * 0.24 * sgn, y - ny * w * 0.24 * sgn, w * 0.16]);
      const k = wob * Math.sin(t * 7 + ph) + sgn * curl * Math.pow(t, 4);
      th += k * ds;
      x += Math.cos(th) * ds;
      y += Math.sin(th) * ds;
    }
    if (thief) kettleAt = [x, y, (th * 180) / Math.PI];
    const d = poly([...left, ...right.reverse()]);
    const g = `<g class="arm"><path class="arm-body" d="${d}"/>${suckers.map(([sx, sy, sr]) => `<circle class="sucker" cx="${f(sx)}" cy="${f(sy)}" r="${f(sr)}"/>`).join("")}</g>`;
    (Math.sin(phi) < 0.25 ? back : front).push(g);
  }
  const mx = cx + 3;
  const my = cy - 20;
  const mantle = `<ellipse class="mantle" cx="${f(mx)}" cy="${f(my)}" rx="16" ry="25" transform="rotate(-12 ${f(mx)} ${f(my)})"/>`;
  const shade = `<clipPath id="mantle-clip"><ellipse cx="${f(mx)}" cy="${f(my)}" rx="16" ry="25" transform="rotate(-12 ${f(mx)} ${f(my)})"/></clipPath><ellipse class="mantle-shade" clip-path="url(#mantle-clip)" cx="${f(mx + 9)}" cy="${f(my + 2)}" rx="15" ry="26" transform="rotate(-12 ${f(mx)} ${f(my)})"/>`;
  const eye = (ex, ey) => `<circle class="eye" cx="${f(ex)}" cy="${f(ey)}" r="3.4"/><path class="pupil" d="M${f(ex - 1.8)} ${f(ey + 0.3)}H${f(ex + 1.8)}"/>`;
  const k = kettleAt ? kettle(kettleAt[0] + Math.cos(kettleAt[2] * deg) * 4, kettleAt[1] + Math.sin(kettleAt[2] * deg) * 4 + 3, 8) : "";
  const w = [
    waves(cx - 70, cy + 30, 2, 6),
    waves(cx + 52, cy + 44, 2, 6),
    waves(cx - 40, cy + 70, 3, 5),
    waves(cx + 28, cy - 60, 2, 5),
    waves(cx + 62, cy - 12, 2, 5),
  ].join("");
  return `<g class="octopus" transform="translate(${f(cx)} ${f(cy)}) scale(1.25) translate(${f(-cx)} ${f(-cy)})">${w}${back.join("")}${mantle}${shade}${eye(cx - 6, cy - 2)}${eye(cx + 9, cy - 4)}${front.join("")}${k}</g>`;
};

export const fleur = (x, y, s) => {
  s *= 0.85;
  const sc = (d) => d.replace(/(-?\d+\.?\d*) (-?\d+\.?\d*)/g, (_, a, b) => `${f(x + a * s)} ${f(y + b * s)}`);
  return `<path class="fleur" d="${sc("M0 0 C-3.2 -6 -3.6 -13 0 -19 C3.6 -13 3.2 -6 0 0 Z M-1.2 -4 C-8 -4 -12 -10 -8.5 -15 C-8 -11 -5.5 -8.5 -1.5 -8 Z M1.2 -4 C8 -4 12 -10 8.5 -15 C8 -11 5.5 -8.5 1.5 -8 Z M-5 -3.2 L5 -3.2 L5 -1 L-5 -1 Z M-1.6 0 L-2.6 5 L2.6 5 L1.6 0 Z")}"/>`;
};

export const rose = (cx, cy, R) => {
  const dir = (a, r) => [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  let ticks = "";
  for (let i = 0; i < 128; i++) {
    const a = (i / 128) * Math.PI * 2;
    const r2 = i % 4 === 0 ? R * 0.86 : R * 0.9;
    ticks += `M${pt(dir(a, R * 0.94))}L${pt(dir(a, r2))}`;
  }
  const tiers = [[], [], [], []];
  for (let i = 0; i < 32; i++) {
    const a = (i / 32) * Math.PI * 2 - Math.PI / 2;
    const tier = i % 8 === 0 ? 0 : i % 4 === 0 ? 1 : i % 2 === 0 ? 2 : 3;
    const len = [0.98, 0.74, 0.56, 0.42][tier] * R;
    const spread = [45, 22.5, 11.25, 5.625][tier] * deg;
    const r0 = [0.19, 0.17, 0.16, 0.15][tier] * R;
    const tip = dir(a, len);
    const bl = dir(a - spread, r0);
    const br = dir(a + spread, r0);
    const c = [cx, cy];
    tiers[tier].push(`<path class="pt-dark t${tier}" d="${poly([c, bl, tip])}"/><path class="pt-light" d="${poly([c, tip, br])}"/>`);
  }
  return `<g class="rose"><circle class="rose-disc" cx="${f(cx)}" cy="${f(cy)}" r="${f(R * 0.96)}"/><path class="rose-ticks" d="${ticks}"/><circle class="rose-ring" cx="${f(cx)}" cy="${f(cy)}" r="${f(R * 0.94)}"/><circle class="rose-ring" cx="${f(cx)}" cy="${f(cy)}" r="${f(R * 0.86)}"/><circle class="rose-ring thin" cx="${f(cx)}" cy="${f(cy)}" r="${f(R * 0.5)}"/>${tiers[3].join("")}${tiers[2].join("")}${tiers[1].join("")}${tiers[0].join("")}<circle class="rose-hub" cx="${f(cx)}" cy="${f(cy)}" r="${f(R * 0.045)}"/>${fleur(cx, cy - R * 1.0, R / 30)}</g>`;
};

// Rhumb lines, after the medieval portolan charts: a web of compass bearings
// radiating from a central rose and sixteen satellites around it.
export const rhumbs = (cx, cy, radius, reach) => {
  const sets = ["", "", ""];
  const origins = [[cx, cy]];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    origins.push([cx + Math.cos(a) * radius, cy + Math.sin(a) * radius]);
  }
  for (const [ox, oy] of origins) {
    for (let i = 0; i < 16; i++) {
      const a = (i / 32) * Math.PI * 2;
      const set = i % 4 === 0 ? 0 : i % 2 === 0 ? 1 : 2;
      const dx = Math.cos(a) * reach;
      const dy = Math.sin(a) * reach;
      sets[set] += `M${f(ox - dx)} ${f(oy - dy)}L${f(ox + dx)} ${f(oy + dy)}`;
    }
  }
  return `<g class="rhumbs"><path class="rh rh-0" d="${sets[0]}"/><path class="rh rh-1" d="${sets[1]}"/><path class="rh rh-2" d="${sets[2]}"/></g>`;
};

export const scaleBar = (x, y) => {
  let s = "";
  for (let i = 0; i < 5; i++) s += `<rect class="${i % 2 ? "sb-light" : "sb-dark"}" x="${f(x + i * 24)}" y="${f(y)}" width="24" height="5"/>`;
  let nums = "";
  for (let i = 0; i <= 5; i += 1) nums += `<text class="sb-num" x="${f(x + i * 24)}" y="${f(y + 16)}">${i * 10}</text>`;
  return `<g class="scalebar">${s}${nums}<text class="sb-title" x="${f(x + 60)}" y="${f(y - 7)}">Leagues, give or take</text></g>`;
};

export const ship = (x, y, k = 1) =>
  `<g class="ship" transform="translate(${f(x)} ${f(y)}) scale(${k})"><path class="wake" d="M-26 3 Q-60 10 -104 4"/><path class="wake" d="M-24 6 Q-52 16 -86 14"/><path class="bldg" d="M-17 -3 L17 -3 L13 3 Q0 6 -13 3 Z"/><path class="ink-thin" d="M0 -3V-33M-9 -3V-24M9 -3V-26M9 -26L21 -5"/><path class="sail" d="M-8 -30 Q0 -27 8 -30 L8 -14 Q0 -11 -8 -14 Z"/><path class="sail" d="M-14 -22 Q-9 -20 -4 -22 L-4 -9 Q-9 -7 -14 -9 Z"/><path class="sail" d="M10 -24 L20 -6 L10 -7 Z"/><path class="flag" d="M0 -33 L8 -31 L0 -29 Z"/></g>`;

/* ---------------- added on Day 2, for Formerly ---------------- */

// A coconut palm: a leaning trunk and a crown of arching fronds.
export const palm = (x, y, r, lean = 0) => {
  const h = r * 2.5;
  const cx = x + lean * r;
  const cy = y - h;
  const trunk = `M${f(x)} ${f(y)}Q${f(x + lean * r * 0.15)} ${f(y - h * 0.6)} ${f(cx)} ${f(cy)}`;
  let fronds = "";
  for (const a of [-172, -132, -92, -50, -8]) {
    const t = a * deg;
    const L = r * (a === -92 ? 1.05 : 1.75);
    const tip = [cx + Math.cos(t) * L, cy + Math.sin(t) * L * 0.4 + r * (a === -92 ? 0.1 : 0.75)];
    const c = [cx + Math.cos(t) * L * 0.55, cy + Math.sin(t) * L * 0.55 - r * 0.7];
    const dx = tip[0] - cx;
    const dy = tip[1] - cy;
    const dl = Math.hypot(dx, dy) || 1;
    const [nx, ny] = [-dy / dl, dx / dl];
    const up = ny < 0 ? 1 : -1; // the side of the frond that faces the sky
    const w = r * 0.42;
    fronds += `M${f(cx)} ${f(cy)}Q${f(c[0] + nx * w * up)} ${f(c[1] + ny * w * up)} ${pt(tip)}Q${f(c[0] - nx * w * 0.2 * up)} ${f(c[1] - ny * w * 0.2 * up + r * 0.3)} ${f(cx)} ${f(cy)}Z`;
  }
  return `<g class="palm"><path class="palm-trunk" d="${trunk}"/><path class="palm-frond" d="${fronds}"/><circle class="dot" cx="${f(cx - r * 0.16)}" cy="${f(cy + r * 0.28)}" r="${f(r * 0.15)}"/><circle class="dot" cx="${f(cx + r * 0.18)}" cy="${f(cy + r * 0.3)}" r="${f(r * 0.15)}"/><path class="tree-foot" d="M${f(x + 1)} ${f(y + 0.3)}H${f(x + r * 1.1)}"/></g>`;
};

// Walk a polyline at a steady step, returning points and the direction there.
export const walk = (pts, step, closed = false) => {
  const out = [];
  const n = closed ? pts.length : pts.length - 1;
  let carry = 0;
  for (let i = 0; i < n; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (!len) continue;
    const ux = (b[0] - a[0]) / len;
    const uy = (b[1] - a[1]) / len;
    let s = carry;
    for (; s < len; s += step) out.push({ p: [a[0] + ux * s, a[1] + uy * s], n: [-uy, ux] });
    carry = s - len;
  }
  return out;
};

// A coral reef as old charts drew it: a band of stippled dots, with a few
// crosses for heads that break the surface, and surf on the outer edge.
export const reef = (pts, seed, { width = 18, surf = true } = {}) => {
  const rnd = rng(seed);
  let dots = "";
  let crosses = "";
  let breakers = "";
  const along = walk(pts, 2.1);
  along.forEach(({ p, n }, i) => {
    for (let k = 0; k < 2; k++) {
      const o = (rnd() + rnd() + rnd() - 1.5) * width * 0.62;
      if (rnd() < 0.72) dots += `M${f(p[0] + n[0] * o)} ${f(p[1] + n[1] * o)}h0`;
    }
    if (i % 23 === 11) {
      const o = (rnd() - 0.5) * width * 0.5;
      const [x, y] = [p[0] + n[0] * o, p[1] + n[1] * o];
      crosses += `M${f(x - 2.2)} ${f(y)}H${f(x + 2.2)}M${f(x)} ${f(y - 2.2)}V${f(y + 2.2)}`;
    }
    if (surf && i % 7 === 3) {
      const d = width * 0.55 + 4 + rnd() * 3;
      const [x, y] = [p[0] - n[0] * d, p[1] - n[1] * d];
      const t = [-n[1], n[0]];
      breakers += `M${f(x - t[0] * 3.2)} ${f(y - t[1] * 3.2)}Q${f(x - n[0] * 2)} ${f(y - n[1] * 2)} ${f(x + t[0] * 3.2)} ${f(y + t[1] * 3.2)}`;
    }
  });
  return `<g class="reef"><path class="reef-dots" d="${dots}"/><path class="reef-heads" d="${crosses}"/>${breakers ? `<path class="breakers" d="${breakers}"/>` : ""}</g>`;
};

// Soundings: depths written on the water, in fathoms, as small numerals.
export const sounding = (x, y, text) => `<text class="sounding" x="${f(x)}" y="${f(y)}">${text}</text>`;

// A mountain that is no longer there: drawn in dotted outline, with depth
// contours round where its summit went down.
export const drowned = (x, y, s, seed) => {
  const rnd = rng(seed);
  const ring = (r) => {
    const pts = [];
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const k = 1 + (rnd() - 0.5) * 0.18;
      pts.push([x + Math.cos(a) * r * 1.3 * k, y - s * 0.45 + Math.sin(a) * r * 0.8 * k]);
    }
    return `<path class="contour" d="${poly(chaikin(chaikin(pts)))}"/>`;
  };
  return `<g class="drowned">${ring(s * 1.55)}${ring(s * 2.35)}${mountain(x, y, s, "ghost")}</g>`;
};

// A robber crab, seen from above, carrying off a spoon.
export const crab = (x, y, s = 1) => {
  const P = (px, py) => `${f(x + px * s)} ${f(y + py * s)}`;
  let legs = "";
  for (const side of [-1, 1]) {
    [[-2, 14, -11, 22, -9], [2, 16, -2, 25, 1], [6, 16, 7, 24, 12], [9, 13, 15, 19, 22]].forEach(([ay, kx, ky, tx, ty]) => {
      legs += `M${P(side * 7, ay)}L${P(side * kx, ky)}L${P(side * tx, ty)}`;
    });
  }
  const claw = (side, big) => {
    const k = big ? 1.25 : 0.9;
    const bx = side * 6;
    const ex = side * 12 * k;
    const hx = side * 14 * k;
    const arm = `M${P(bx, -7)}L${P(ex, -14 * k)}L${P(hx, -21 * k)}`;
    return `<path class="crab-leg arm" d="${arm}"/><path class="crab-leg-fill arm" d="${arm}"/><path class="crab-shell" d="M${P(hx - side * 3.4 * k, -19 * k)}C${P(hx - side * 5 * k, -26 * k)} ${P(hx + side * 1 * k, -32 * k)} ${P(hx + side * 3.5 * k, -29 * k)}L${P(hx + side * 1.2 * k, -24 * k)}C${P(hx + side * 4 * k, -25 * k)} ${P(hx + side * 5 * k, -21 * k)} ${P(hx + side * 2.6 * k, -18 * k)}Z"/>`;
  };
  const spoon = `<g class="spoon"><path class="ink-thin" d="M${P(-16.5, -28.5)}L${P(-27, -44)}"/><ellipse class="bldg" cx="${f(x - 28.6 * s)}" cy="${f(y - 46.8 * s)}" rx="${f(2.2 * s)}" ry="${f(3.4 * s)}" transform="rotate(-34 ${f(x - 28.6 * s)} ${f(y - 46.8 * s)})"/></g>`;
  const eyes = `<path class="ink-thin" d="M${P(-2.5, -8)}L${P(-4, -13)}M${P(2.5, -8)}L${P(4, -13)}"/><circle class="dot" cx="${f(x - 4 * s)}" cy="${f(y - 13.6 * s)}" r="${f(1.1 * s)}"/><circle class="dot" cx="${f(x + 4 * s)}" cy="${f(y - 13.6 * s)}" r="${f(1.1 * s)}"/>`;
  const body = `<path class="crab-shell" d="M${P(-8, -3)}C${P(-9, -10)} ${P(9, -10)} ${P(8, -3)}C${P(9, 4)} ${P(6, 9)} ${P(0, 10)}C${P(-6, 9)} ${P(-9, 4)} ${P(-8, -3)}Z"/><path class="crab-tail" d="M${P(-5.5, 9)}C${P(-7, 18)} ${P(7, 18)} ${P(5.5, 9)}"/><path class="crab-mark" d="M${P(-4, -3)}Q${P(0, -6)} ${P(4, -3)}M${P(-3, 3)}Q${P(0, 5)} ${P(3, 3)}"/>`;
  return `<g class="crab"><path class="crab-leg" d="${legs}"/><path class="crab-leg-fill" d="${legs}"/>${claw(-1, true)}${claw(1, false)}${spoon}${body}${eyes}</g>`;
};

// A ship's track: a dotted line through where it was, with the days marked.
export const track = (pts, stops) => {
  const marks = stops.map(({ at: [x, y] }) => `<circle class="track-stop" cx="${f(x)}" cy="${f(y)}" r="2.6"/>`).join("");
  return `<g class="track"><path class="track-line" d="${poly(chaikin(chaikin(pts, false), false), false)}"/>${marks}</g>`;
};

/* ---------------- added on Day 3, for Anon ---------------- */

// A band of even-ish width along a line, pointed at both ends: sandbanks,
// causeways, spits. `w` is the full width in the middle.
export const ribbon = (line, w, taper = 0.22) => {
  const c = chaikin(chaikin(line, false), false);
  const acc = [0];
  for (let i = 1; i < c.length; i++) acc.push(acc[i - 1] + Math.hypot(c[i][0] - c[i - 1][0], c[i][1] - c[i - 1][1]));
  const total = acc[acc.length - 1] || 1;
  const left = [];
  const right = [];
  c.forEach((p, i) => {
    const a = c[Math.max(0, i - 1)];
    const b = c[Math.min(c.length - 1, i + 1)];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const n = [-(b[1] - a[1]) / len, (b[0] - a[0]) / len];
    const e = Math.min(acc[i], total - acc[i]) / (total * taper);
    const half = (w / 2) * (e >= 1 ? 1 : Math.sqrt(Math.max(0, e * (2 - e))));
    left.push([p[0] + n[0] * half, p[1] + n[1] * half]);
    right.push([p[0] - n[0] * half, p[1] - n[1] * half]);
  });
  return [...left, ...right.reverse()];
};

// Marker posts along a causeway: a short stake with a knob on top.
export const posts = (line, step = 15, side = 5) =>
  `<path class="post" d="${walk(chaikin(line, false), step)
    .slice(1)
    .map(({ p, n }) => `M${f(p[0] + n[0] * side)} ${f(p[1] + n[1] * side + 1)}V${f(p[1] + n[1] * side - 5)}`)
    .join("")}"/>`;

// A refuge on stilts, for people the tide catches halfway.
export const refuge = (x, y) =>
  `<g class="refuge"><path class="ink-thin" d="M${f(x - 3.4)} ${f(y + 2)}V${f(y - 7)}M${f(x + 3.4)} ${f(y + 2)}V${f(y - 7)}M${f(x - 3.4)} ${f(y - 2)}L${f(x + 3.4)} ${f(y - 6)}M${f(x + 5.4)} ${f(y + 2)}L${f(x + 3.4)} ${f(y - 7)}M${f(x + 4.9)} ${f(y - 0.5)}H${f(x + 3.9)}M${f(x + 4.4)} ${f(y - 3)}H${f(x + 3.6)}"/>${house(x, y - 7, 8, 5.5)}</g>`;

// A tide mill: a mill house with its wheel, beside a dam across a small bay.
export const tideMill = (x, y, dam) => {
  let spokes = "";
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI;
    spokes += `M${f(x + 8 + Math.cos(a) * 4.6)} ${f(y - 4 + Math.sin(a) * 4.6)}L${f(x + 8 - Math.cos(a) * 4.6)} ${f(y - 4 - Math.sin(a) * 4.6)}`;
  }
  const d = dam ? `<path class="dam" d="M${pt(dam[0])}L${pt(dam[1])}"/><path class="dam-gates" d="${[0.3, 0.5, 0.7].map((t) => { const p = [dam[0][0] + (dam[1][0] - dam[0][0]) * t, dam[0][1] + (dam[1][1] - dam[0][1]) * t]; return `M${f(p[0])} ${f(p[1] - 2.2)}V${f(p[1] + 2.2)}`; }).join("")}"/>` : "";
  return `<g class="mill">${d}${house(x, y, 10, 7)}<circle class="bldg" cx="${f(x + 8)}" cy="${f(y - 4)}" r="5.2"/><path class="ink-thin" d="${spokes}"/></g>`;
};
