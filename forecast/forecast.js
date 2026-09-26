// The forecast page: fetch the current bulletin, lay it out like a script,
// draw the weather on the chart, and read it aloud after the ship's bell.
import { AREAS, GRID, REGION, bulletinUrl } from "./areas.js";
import { systems, twinOf } from "./compose.js";

const $ = (id) => document.getElementById(id);
const svg = $("fc-svg");
const NS = "http://www.w3.org/2000/svg";
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const byId = Object.fromEntries(AREAS.map((a) => [a.id, a]));

let B = null; // the bulletin
let hour = 0;

/* ---------------- times ---------------- */

const hhmm = (iso) => iso.slice(11, 13) + "00";
const dayLong = (iso) => new Date(iso).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const localTime = (t) => new Date(t).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
const localDay = (t) => new Date(t).toLocaleDateString([], { weekday: "short" });

/* ---------------- words for the voice ---------------- */

const ONES = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
const upTo99 = (n) => (n < 20 ? ONES[n] : TENS[Math.floor(n / 10)] + (n % 10 ? "-" + ONES[n % 10] : ""));
const ORD = { 1: "first", 2: "second", 3: "third", 5: "fifth", 8: "eighth", 9: "ninth", 12: "twelfth", 20: "twentieth", 30: "thirtieth" };
const ordinal = (n) => {
  if (ORD[n]) return ORD[n];
  if (n > 20 && n % 10 && ORD[n % 10]) return TENS[Math.floor(n / 10)] + "-" + ORD[n % 10];
  return upTo99(n).replace(/y$/, "ie") + "th";
};
// "1800" -> "eighteen hundred", "0600" -> "oh six hundred"
const sayTime = (s) => {
  const h = +s.slice(0, 2);
  if (h === 0) return "midnight";
  if (h === 12) return "midday";
  return (h < 10 ? "oh " : "") + upTo99(h) + " hundred";
};
// Pressures: "987" is read "nine eight seven", "1012" "one thousand and twelve".
const sayPressure = (p) => {
  const n = +p;
  if (n < 1000) return String(p).split("").map((d) => ONES[+d]).join(" ");
  return n === 1000 ? "one thousand" : `one thousand and ${upTo99(n - 1000)}`;
};
const forVoice = (s) =>
  s
    .replace(/\b(9\d\d|10\d\d)\b(?! leagues)/g, (m) => sayPressure(m))
    .replace(/\b([01]\d|2[0-3])00 tomorrow\b/g, (m, h) => `${sayTime(h + "00")} tomorrow`);

/* ---------------- the bulletin ---------------- */

const script = []; // what the voice reads: { say, areas, el }

const render = () => {
  const sheet = $("fc-sheet");
  const issued = hhmm(B.issue);
  const next = new Date(Date.parse(B.issue) + 6 * 3600e3).toISOString();
  const d = new Date(B.issue);
  $("fc-issue-short").textContent = `issued ${issued} UTC`;
  script.length = 0;
  let html = `<p class="fc-slug"><span>Shipping forecast</span><span>Elsewhere</span><span>${issued} UTC</span></p>`;
  html += `<p class="fc-open" data-say="open">And now the shipping forecast for Elsewhere, issued by the Cartographer at ${issued}&nbsp;UTC on ${esc(dayLong(B.issue))}, for the next 24 hours.</p>`;
  script.push({ key: "open", say: `And now the shipping forecast for Elsewhere, issued by the Cartographer at ${sayTime(issued)}, Universal Time, on ${d.toLocaleDateString("en-GB", { weekday: "long", timeZone: "UTC" })} the ${ordinal(d.getUTCDate())} of ${d.toLocaleDateString("en-GB", { month: "long", timeZone: "UTC" })}.` });

  if (B.warnings.length) {
    const names = B.warnings.map((w) => w.name);
    const list = names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : names[0];
    html += `<section class="fc-part fc-warn" data-say="warn"><h3 class="fc-h">Gale warnings</h3><p>There are warnings of gales in ${esc(list)}.</p><ul class="fc-warn-list">${B.warnings.map((w) => `<li><span class="fc-warn-area">${esc(w.name)}</span> ${esc(w.text)}</li>`).join("")}</ul></section>`;
    script.push({ key: "warn", say: `There are warnings of gales in ${names.length > 1 ? `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}` : names[0]}.`, areas: B.warnings.map((w) => w.id) });
  } else {
    html += `<section class="fc-part" data-say="warn"><h3 class="fc-h">Gale warnings</h3><p>None in force.</p></section>`;
  }

  html += `<section class="fc-part" data-say="syn"><h3 class="fc-h">General synopsis at ${B.synopsis.time}</h3><p>${esc(B.synopsis.text)}</p></section>`;
  script.push({ key: "syn", say: `The general synopsis at ${sayTime(B.synopsis.time)}.` });
  script.push({ key: "syn", say: forVoice(B.synopsis.text) });

  html += `<section class="fc-part fc-part-areas"><h3 class="fc-h" data-say="areas">Area forecasts for the next 24 hours</h3><div class="fc-rows">`;
  script.push({ key: "areas", say: "The area forecasts for the next twenty-four hours." });
  B.groups.forEach((g, n) => {
    const warned = g.ids.some((id) => B.warnings.some((w) => w.id === id));
    html += `<div class="fc-row${warned ? " is-gale" : ""}" data-say="g${n}" data-areas="${g.ids.join(" ")}">${g.ids.map((id) => `<span class="fc-anchor" id="fc-${id}"></span>`).join("")}<h4 class="fc-row-name">${g.names.map(esc).join(", ")}</h4><p class="fc-row-text"><span class="fc-w">${esc(g.wind)}.</span> <span>${esc(g.sea)}.</span> <span>${esc(g.weather)}.</span> <span>${esc(g.visibility)}.</span></p></div>`;
    script.push({ key: `g${n}`, say: g.names.join(", ") + ".", areas: g.ids, pause: 250 });
    script.push({ key: `g${n}`, say: `${g.wind}. ${g.sea}. ${g.weather}. ${g.visibility}.`, areas: g.ids });
  });
  html += `</div></section>`;
  html += `<p class="fc-close" data-say="close">And that completes the shipping forecast for Elsewhere. The next is issued at ${hhmm(next)}&nbsp;UTC (${esc(localTime(Date.parse(next)))} your time).</p>`;
  script.push({ key: "close", say: "And that completes the shipping forecast for Elsewhere." });
  sheet.innerHTML = html;
  for (const s of script) s.el = sheet.querySelector(`[data-say="${s.key}"]`);

  // Chart: warnings, hover links between rows and areas.
  svg.querySelectorAll(".fc-area").forEach((p) => p.classList.toggle("is-gale", B.warnings.some((w) => w.id === p.dataset.area)));
  sheet.querySelectorAll(".fc-row").forEach((row) => {
    const ids = row.dataset.areas.split(" ");
    row.addEventListener("pointerenter", () => mark(ids, "is-hover"));
    row.addEventListener("pointerleave", () => mark([], "is-hover"));
  });
};

const mark = (ids, cls) => {
  svg.querySelectorAll(`.fc-area, .fc-name`).forEach((el) => el.classList.toggle(cls, ids.includes(el.dataset.area)));
};

/* ---------------- the chart's live layers ---------------- */

let u = 4; // world units per CSS pixel
const measure = () => {
  const r = svg.getBoundingClientRect();
  const vb = svg.viewBox.baseVal;
  if (r.width) u = vb.width / r.width;
  svg.style.setProperty("--u", u.toFixed(3));
};

// One arrow per area, flying with the wind, with a feather for each force of
// the Beaufort scale (a long feather for two, a short one for one).
const arrow = (x, y, dir, force, gale) => {
  const k = u;
  const L = 46 * k;
  const g = document.createElementNS(NS, "g");
  g.setAttribute("class", `fc-arrow${gale ? " is-gale" : ""}${force >= 8 ? " is-gale-now" : ""}`);
  if (force === 0) {
    g.innerHTML = `<circle cx="${x}" cy="${y}" r="${5 * k}" class="fc-calm"/><circle cx="${x}" cy="${y}" r="${2 * k}" class="fc-calm"/>`;
    return g;
  }
  const rot = dir + 180 - 90; // bearing the wind flies toward, as an SVG angle
  let feathers = "";
  const full = Math.floor(force / 2);
  const half = force % 2;
  for (let i = 0; i < full + half; i++) {
    const fx = -L / 2 + i * 6.5 * k;
    const len = i < full ? 14 * k : 8 * k;
    feathers += `M${fx} 0l${-len * 0.5} ${-len * 0.87}`;
  }
  g.setAttribute("transform", `translate(${x} ${y}) rotate(${rot})`);
  g.innerHTML = `<path class="fc-shaft" d="M${-L / 2} 0H${L / 2 - 6 * k}${feathers}"/><path class="fc-head" d="M${L / 2} 0l${-10 * k} ${-4.6 * k}v${9.2 * k}z"/>`;
  return g;
};

// Isobars: the pressure grid smoothed (Catmull-Rom) onto a finer grid, then
// contoured every 4 hPa with marching squares, and the pieces joined up.
const FINE = 4;
const cubic = (p0, p1, p2, p3, t) => p1 + 0.5 * t * (p2 - p0 + t * (2 * p0 - 5 * p1 + 4 * p2 - p3 + t * (3 * (p1 - p2) + p3 - p0)));
const upsample = (vals) => {
  const { nx, ny } = GRID;
  const at = (i, j) => vals[Math.max(0, Math.min(ny - 1, j)) * nx + Math.max(0, Math.min(nx - 1, i))];
  const W = (nx - 1) * FINE + 1;
  const H = (ny - 1) * FINE + 1;
  const out = new Float64Array(W * H);
  for (let J = 0; J < H; J++)
    for (let I = 0; I < W; I++) {
      const i = Math.floor(I / FINE);
      const j = Math.floor(J / FINE);
      const tx = (I % FINE) / FINE;
      const ty = (J % FINE) / FINE;
      const rows = [-1, 0, 1, 2].map((dj) => cubic(at(i - 1, j + dj), at(i, j + dj), at(i + 1, j + dj), at(i + 2, j + dj), tx));
      out[J * W + I] = cubic(rows[0], rows[1], rows[2], rows[3], ty);
    }
  return { W, H, v: out };
};

const contours = (field, level) => {
  const { W, H, v } = field;
  const X = (I) => GRID.x0 + (I * GRID.dx) / FINE;
  const Y = (J) => GRID.y0 + (J * GRID.dy) / FINE;
  const pts = new Map(); // edge key -> point
  const links = new Map(); // edge key -> [edge keys]
  const edge = (I, J, horiz) => {
    const key = `${horiz ? "h" : "v"}${I},${J}`;
    if (!pts.has(key)) {
      const [a, b] = horiz ? [v[J * W + I], v[J * W + I + 1]] : [v[J * W + I], v[(J + 1) * W + I]];
      const t = (level - a) / (b - a);
      pts.set(key, horiz ? [X(I + t), Y(J)] : [X(I), Y(J + t)]);
    }
    return key;
  };
  const link = (a, b) => {
    if (!links.has(a)) links.set(a, []);
    if (!links.has(b)) links.set(b, []);
    links.get(a).push(b);
    links.get(b).push(a);
  };
  for (let J = 0; J < H - 1; J++)
    for (let I = 0; I < W - 1; I++) {
      const a = v[J * W + I] >= level;
      const b = v[J * W + I + 1] >= level;
      const c = v[(J + 1) * W + I + 1] >= level;
      const d = v[(J + 1) * W + I] >= level;
      const top = a !== b ? edge(I, J, true) : null;
      const right = b !== c ? edge(I + 1, J, false) : null;
      const bottom = d !== c ? edge(I, J + 1, true) : null;
      const left = a !== d ? edge(I, J, false) : null;
      const cut = [top, right, bottom, left].filter(Boolean);
      if (cut.length === 2) link(cut[0], cut[1]);
      else if (cut.length === 4) {
        const mid = (v[J * W + I] + v[J * W + I + 1] + v[(J + 1) * W + I + 1] + v[(J + 1) * W + I]) / 4 >= level;
        if (mid === a) link(top, right), link(bottom, left);
        else link(top, left), link(bottom, right);
      }
    }
  const seen = new Set();
  const lines = [];
  const walk = (start) => {
    const line = [start];
    seen.add(start);
    let cur = start;
    for (;;) {
      const nxt = (links.get(cur) || []).find((k) => !seen.has(k));
      if (!nxt) break;
      seen.add(nxt);
      line.push(nxt);
      cur = nxt;
    }
    return line;
  };
  // Open lines first (they start at an end), then the closed loops.
  for (const [k, l] of links) if (l.length === 1 && !seen.has(k)) lines.push(walk(k));
  for (const k of links.keys()) if (!seen.has(k)) {
    const line = walk(k);
    line.push(line[0]);
    lines.push(line);
  }
  return lines.map((l) => l.map((k) => pts.get(k)));
};

const smooth = (line) => {
  let p = line;
  for (let n = 0; n < 2; n++) {
    const q = [p[0]];
    for (let i = 0; i < p.length - 1; i++) {
      const [a, b] = [p[i], p[i + 1]];
      q.push([0.75 * a[0] + 0.25 * b[0], 0.75 * a[1] + 0.25 * b[1]], [0.25 * a[0] + 0.75 * b[0], 0.25 * a[1] + 0.75 * b[1]]);
    }
    q.push(p[p.length - 1]);
    p = q;
  }
  return p;
};

const inRegion = ([x, y], m = 0) => x > REGION.x0 + m && x < REGION.x1 - m && y > REGION.y0 + m && y < REGION.y1 - m;
const snapshot = (h) => (h < 6 ? "p0" : h < 18 ? "p12" : "p24");
const snapshotHour = (h) => (h < 6 ? 0 : h < 18 ? 12 : 24);

const drawPressure = () => {
  const layer = $("fc-isobars");
  const sys = $("fc-systems");
  const vals = B.grid[snapshot(hour)];
  if (!vals || vals.some((x) => x == null)) {
    layer.innerHTML = "";
    sys.innerHTML = "";
    return;
  }
  const field = upsample(vals);
  let min = Infinity;
  let max = -Infinity;
  for (const x of field.v) (min = Math.min(min, x)), (max = Math.max(max, x));
  let paths = "";
  let labels = "";
  const taken = [];
  for (let lv = Math.ceil(min / 4) * 4; lv <= max; lv += 4) {
    for (const raw of contours(field, lv)) {
      if (raw.length < 3) continue;
      const line = smooth(raw);
      paths += `<path class="fc-iso${lv % 20 === 0 ? " is-major" : ""}" d="M${line.map((p) => p.map((c) => c.toFixed(0)).join(" ")).join("L")}"/>`;
      // A label where the line is well inside the chart and clear of the others.
      const cands = line.filter((p, i) => i % 6 === 3 && inRegion(p, 120));
      const spot = cands.sort((a, b) => Math.abs(a[1] - 175) - Math.abs(b[1] - 175)).find((p) => taken.every((q) => Math.hypot(p[0] - q[0], p[1] - q[1]) > 70 * u) && AREAS.every((a) => Math.hypot(p[0] - a.label[0], p[1] - a.label[1]) > 60 * u));
      if (spot) {
        taken.push(spot);
        labels += `<text class="fc-iso-label" x="${spot[0].toFixed(0)}" y="${spot[1].toFixed(0)}" dy="0.35em">${lv}</text>`;
      }
    }
  }
  layer.innerHTML = `<clipPath id="fc-clip"><rect x="${REGION.x0}" y="${REGION.y0}" width="${REGION.x1 - REGION.x0}" height="${REGION.y1 - REGION.y0}"/></clipPath><g clip-path="url(#fc-clip)">${paths}${labels}</g>`;
  sys.innerHTML = systems(vals)
    .filter((s) => inRegion(s.at, 40))
    .map((s) => `<g class="fc-sys is-${s.type}"><text x="${s.at[0]}" y="${s.at[1]}" class="fc-sys-letter" dy="0.35em">${s.type === "low" ? "L" : "H"}</text><text x="${s.at[0]}" y="${s.at[1] + 30 * u}" class="fc-sys-p" dy="0.35em">${s.p}</text></g>`)
    .join("");
};

const drawWinds = () => {
  const layer = $("fc-winds");
  layer.innerHTML = "";
  for (const a of B.areas) {
    const [dir, kn, force] = a.hours[Math.min(hour, a.hours.length - 1)];
    const [x, y] = byId[a.id].label;
    const g = arrow(x, y + 30 * u, dir, force, !!a.gale);
    const t = document.createElementNS(NS, "title");
    t.textContent = `${a.name}: force ${force}${force ? ` from ${Math.round(dir)}°` : ", calm"} (${Math.round(kn)} knots)`;
    g.prepend(t);
    layer.append(g);
  }
};

const setHour = (h) => {
  hour = h;
  const issue = Date.parse(B.issue);
  const t = issue + h * 3600e3;
  const now = Math.min(24, Math.max(0, Math.floor((Date.now() - issue) / 3600e3)));
  $("fc-hour-out").textContent = `${h === now ? "now, " : ""}${localDay(t)} ${localTime(t)}`;
  $("fc-hour").setAttribute("aria-valuetext", `${localDay(t)} ${localTime(t)}, isobars for ${localTime(issue + snapshotHour(h) * 3600e3)}`);
  drawWinds();
  drawPressure();
};

const redraw = () => {
  measure();
  if (B) {
    drawWinds();
    drawPressure();
  }
};

/* ---------------- the bell ---------------- */

let audio = null;
// A small brass bell: a handful of inharmonic partials, each a pair of
// slightly detuned sines so it shimmers, dying away at different rates.
const strike = (ctx, out, t) => {
  const f0 = 830;
  const partials = [[0.5, 0.18, 2.6], [1, 1, 3.2], [2.0, 0.42, 1.7], [2.74, 0.5, 1.3], [3.97, 0.2, 0.8], [5.36, 0.12, 0.5], [6.9, 0.05, 0.3]];
  for (const [r, a, d] of partials)
    for (const det of [-0.7, 0.7]) {
      const o = ctx.createOscillator();
      o.frequency.value = f0 * r + det * r;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(a * 0.5, t + 0.003);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g).connect(out);
      o.start(t);
      o.stop(t + d + 0.05);
    }
};

// Ship's bells: one stroke per half hour of the four-hour watch, in pairs.
const bellsNow = (d = new Date()) => ((d.getHours() * 2 + (d.getMinutes() >= 30 ? 1 : 0)) % 8) || 8;
const BELL_WORDS = ["", "One bell", "Two bells", "Three bells", "Four bells", "Five bells", "Six bells", "Seven bells", "Eight bells"];

const ringBells = (n) => {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return 0;
  audio = new Ctx();
  audio.resume?.();
  const out = audio.createGain();
  out.gain.value = 0.16;
  const lp = audio.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 6500;
  out.connect(lp).connect(audio.destination);
  let t = audio.currentTime + 0.15;
  for (let i = 0; i < n; i++) {
    strike(audio, out, t);
    t += i % 2 === 0 && i < n - 1 ? 0.42 : 1.05;
  }
  return (t - audio.currentTime) * 1000 + 600;
};

/* ---------------- the voice ---------------- */

const synth = window.speechSynthesis;
let voice = null;
const pickVoice = () => {
  const all = synth?.getVoices() || [];
  const en = all.filter((v) => /^en[-_]/i.test(v.lang));
  const gb = en.filter((v) => /GB/i.test(v.lang));
  for (const n of ["Daniel", "Google UK English Male", "Arthur", "Oliver", "George", "Ryan", "Thomas", "Malcolm"]) {
    const v = gb.find((x) => x.name.includes(n));
    if (v) return v;
  }
  return gb.find((v) => v.localService) || gb[0] || en.find((v) => v.localService && /US|AU|IE/.test(v.lang)) || en[0] || null;
};

let playing = false;
let timer = 0;
let at = 0;

const highlight = (s) => {
  document.querySelectorAll(".fc-sheet .is-reading").forEach((el) => el.classList.remove("is-reading"));
  mark(s?.areas || [], "is-reading");
  if (!s) return;
  s.el?.classList.add("is-reading");
  // On a narrow screen the chart scrolls sideways: bring the area into view.
  const chart = $("fc-chart");
  if (s.areas?.length && chart.scrollWidth > chart.clientWidth + 4) {
    const a = byId[s.areas[0]];
    const vb = svg.viewBox.baseVal;
    const px = ((a.label[0] - vb.x) / vb.width) * chart.scrollWidth;
    chart.scrollTo({ left: px - chart.clientWidth / 2, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }
};

const status = (t) => ($("fc-status").textContent = t);

const next = () => {
  clearTimeout(timer);
  if (!playing) return;
  if (at >= script.length) return stop(true);
  const s = script[at++];
  highlight(s);
  const ut = new SpeechSynthesisUtterance(s.say);
  if (voice) ut.voice = voice;
  ut.lang = voice?.lang || "en-GB";
  ut.rate = 0.9;
  ut.pitch = 0.96;
  let done = false;
  const go = () => {
    if (done) return;
    done = true;
    clearTimeout(timer);
    timer = setTimeout(next, s.pause ?? 420);
  };
  ut.onend = go;
  ut.onerror = go;
  // If a browser never says it has finished, move on anyway.
  timer = setTimeout(go, 4000 + s.say.length * 110);
  synth.speak(ut);
};

const stop = (finished) => {
  playing = false;
  clearTimeout(timer);
  synth?.cancel();
  audio?.close?.();
  audio = null;
  highlight(null);
  const btn = $("fc-listen");
  btn.classList.remove("is-playing");
  btn.querySelector(".fc-listen-label").textContent = "Listen";
  btn.setAttribute("aria-pressed", "false");
  status(finished ? "That was the shipping forecast. The next one comes at " + hhmm(new Date(Date.parse(B.issue) + 6 * 3600e3).toISOString()) + " UTC." : "Stopped.");
};

const play = () => {
  if (playing) return stop(false);
  playing = true;
  at = 0;
  voice = pickVoice();
  const btn = $("fc-listen");
  btn.classList.add("is-playing");
  btn.querySelector(".fc-listen-label").textContent = "Stop";
  btn.setAttribute("aria-pressed", "true");
  // Some browsers only allow speech that starts inside a tap: start a silent one now.
  const unlock = new SpeechSynthesisUtterance(" ");
  unlock.volume = 0;
  synth.speak(unlock);
  const n = bellsNow();
  const wait = ringBells(n);
  status(`${BELL_WORDS[n]}.`);
  timer = setTimeout(() => {
    if (!playing) return;
    status(voice ? `Read by ${voice.name.replace(/\s*\(.*\)$/, "")}, your device's voice.` : "Read by your device's voice.");
    next();
  }, wait);
};

/* ---------------- start ---------------- */

const fillTwins = () => {
  const fmt = (v, pos, neg) => {
    const a = Math.abs(v);
    let d = Math.floor(a);
    let m = Math.round((a - d) * 60);
    if (m === 60) (d += 1), (m = 0);
    return `${d}&deg;${m ? String(m).padStart(2, "0") + "&prime;" : ""}${v >= 0 ? pos : neg}`;
  };
  $("fc-twins").querySelector("tbody").innerHTML = AREAS.map((a) => {
    const t = twinOf(a);
    return `<tr><th scope="row">${esc(a.name)}</th><td>${fmt(t.lat, "N", "S")} ${fmt(t.lon, "E", "W")}</td><td>${esc(a.about)}</td></tr>`;
  }).join("");
};

const load = async () => {
  try {
    const r = await fetch(bulletinUrl());
    const j = await r.json();
    if (!r.ok || !j.areas) throw new Error(j.error || r.status);
    B = j;
  } catch (e) {
    status("The forecast hasn't come in. The wire may be down; try reloading in a minute.");
    $("fc-sheet").querySelector(".fc-loading").textContent = "No forecast yet. The weather comes over the wire from Open-Meteo, and the wire seems to be down. Try again in a minute.";
    return;
  }
  render();
  const issue = Date.parse(B.issue);
  const now = Math.min(24, Math.max(0, Math.floor((Date.now() - issue) / 3600e3)));
  const range = $("fc-hour");
  range.value = String(now);
  range.addEventListener("input", () => setHour(+range.value));
  $("fc-time").hidden = false;
  measure();
  setHour(now);
  const btn = $("fc-listen");
  if (synth && "SpeechSynthesisUtterance" in window) {
    btn.disabled = false;
    btn.addEventListener("click", play);
    status(`Issued at ${hhmm(B.issue)} UTC (${localTime(issue)} your time).`);
  } else {
    status("Your browser can't read aloud, so this one is for reading.");
  }
};

fillTwins();
measure();
new ResizeObserver(() => redraw()).observe(svg);
synth?.addEventListener?.("voiceschanged", () => (voice = pickVoice()));
addEventListener("pagehide", () => playing && stop(false));
load();

window.forecast = { get bulletin() { return B; }, script, setHour, bellsNow, forVoice, sayPressure, sayTime, ordinal };
