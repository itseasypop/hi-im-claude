// Fathom: the page. game.js knows the sea; this draws it, takes the casts,
// remembers them in this browser, and charts the island when it's found.
import { puzzle, sound, call, square, bird, numberFor, dateOf, CASTS, SEA, NO_BOTTOM } from "./game.js";
import { chart, sheet, THEMES, encodeNames } from "../landfall/chart.js";
import { rhumbs, rose, ship, f, poly } from "../atlas/draw.js";

const $ = (s) => document.querySelector(s);
const vp = $("#fa-viewport");
const holder = $("#fa-chart");
const over = $("#fa-over");
const callEl = $("#fa-call");
const pipsEl = $("#fa-pips");
const leftEl = $("#fa-left");
const result = $("#fa-result");
const SITE = "hi-im-claude.vercel.app/fathom";
const NS = "http://www.w3.org/2000/svg";

const reduce = matchMedia("(prefers-reduced-motion: reduce)");
const darkMQ = matchMedia("(prefers-color-scheme: dark)");
const theme = () => document.documentElement.dataset.theme || (darkMQ.matches ? "dark" : "light");
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const wait = (ms) => new Promise((r) => setTimeout(r, reduce.matches ? 0 : ms));

/* ---------------- which day, and what's remembered ---------------- */

const today = numberFor(); // at load; a tab can stay open past midnight, so later checks ask numberFor() again
const asked = Number(new URLSearchParams(location.search).get("no"));
const no = asked >= 1 && asked <= today ? Math.floor(asked) : today;
const pz = puzzle(no);

const KEY = "fathom";
const load = () => {
  try {
    const o = JSON.parse(localStorage.getItem(KEY));
    if (o && o.v === 1 && o.days) return o;
  } catch (e) {}
  return { v: 1, days: {} };
};
const store = load();
// Other tabs may have saved since this one loaded: re-read, change only this
// puzzle's entry, and write that back.
const save = () => {
  try {
    const fresh = load();
    fresh.days[no] = game;
    store.days = fresh.days;
    localStorage.setItem(KEY, JSON.stringify(fresh));
  } catch (e) {}
};
const game = (store.days[no] ||= { casts: [], done: false, found: false });

const dateText = dateOf(no).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
$("#fa-no").textContent = `No. ${no}`;
$("#fa-date").textContent = dateText;
$("#fa-date").setAttribute("datetime", dateOf(no).toISOString().slice(0, 10));
if (no !== today) document.title = `Fathom No. ${no} · find the island in the fog`;

/* ---------------- the view ---------------- */

// Both layers (the sea or chart underneath, the fog and soundings on top)
// share one square view box, in world units.
let view = pz.sea.slice();
let W = 1; // the stage's width in CSS px
const setView = (v) => {
  view = v;
  const vb = `${v[0].toFixed(1)} ${v[1].toFixed(1)} ${(v[2] - v[0]).toFixed(1)} ${(v[3] - v[1]).toFixed(1)}`;
  over.setAttribute("viewBox", vb);
  holder.firstElementChild?.setAttribute("viewBox", vb);
  // world units per screen pixel: lettering and line widths are set in it
  const u = (v[2] - v[0]) / W;
  over.style.setProperty("--u", u.toFixed(3));
  // Soundings, birds and the cross-hair keep a steady size on screen.
  for (const g of over.querySelectorAll("[data-at]")) {
    const [x, y] = g.dataset.at.split(",");
    g.setAttribute("transform", `translate(${x} ${y}) scale(${u.toFixed(3)})${g.dataset.turn ? ` rotate(${g.dataset.turn})` : ""}`);
  }
  // The ship lies just past its last sounding, so it doesn't sit on the number.
  shipEl?.setAttribute("transform", `translate(${f(shipAt[0] + heading * 30 * u)} ${f(shipAt[1] + 5 * u)}) scale(${(u * 0.62).toFixed(3)})${heading < 0 ? " scale(-1 1)" : ""}`);
};
const measure = () => {
  W = vp.getBoundingClientRect().width || 1;
  setView(view);
};
const toWorld = (e) => {
  const r = vp.getBoundingClientRect();
  return [view[0] + ((e.clientX - r.left) / r.width) * (view[2] - view[0]), view[1] + ((e.clientY - r.top) / r.height) * (view[3] - view[1])];
};
const flyTo = (target, dur = 1400) =>
  new Promise((done) => {
    const start = view.slice();
    if (reduce.matches) return setView(target), done();
    const t0 = performance.now();
    const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    const step = (now) => {
      const t = Math.min(1, (now - t0) / dur);
      const e = ease(t);
      setView(start.map((s, i) => s + (target[i] - s) * e));
      if (t < 1) requestAnimationFrame(step);
      else done();
    };
    requestAnimationFrame(step);
  });

/* ---------------- drawing the sea ---------------- */

const [sx0, sy0, sx1, sy1] = pz.sea;
const mid = [(sx0 + sx1) / 2, (sy0 + sy1) / 2];

// The sea before anything is found: rhumb lines from the middle and a rose in
// a corner. Nothing here depends on where the island is.
const emptySea = () => {
  const T = THEMES[theme()];
  return `<svg xmlns="http://www.w3.org/2000/svg" class="lf fa-sea" viewBox="${view.join(" ")}" aria-hidden="true"><style>${sheet(T)}</style><rect class="sea" x="${sx0 - 6000}" y="${sy0 - 6000}" width="${SEA + 12000}" height="${SEA + 12000}"/><g class="lf-web">${rhumbs(mid[0], mid[1], SEA * 0.4, SEA * 3)}</g>${rose(sx0 + 230, sy1 - 250, 150)
    .replace(/class="rose-ring thin"/g, 'class="rose-ring-thin"')}</svg>`;
};

over.innerHTML = `<style id="fa-sheet"></style>
<defs>
  <radialGradient id="fa-hole"><stop offset="0" stop-color="#000" stop-opacity="1"/><stop offset="0.5" stop-color="#000" stop-opacity="0.9"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
  <mask id="fa-clear" maskUnits="userSpaceOnUse" x="${sx0 - 4000}" y="${sy0 - 4000}" width="${SEA + 8000}" height="${SEA + 8000}"><rect x="${sx0 - 4000}" y="${sy0 - 4000}" width="${SEA + 8000}" height="${SEA + 8000}" fill="#fff"/><g id="fa-holes"></g></mask>
  <filter id="fa-mist" x="0" y="0" width="1" height="1" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency="0.0032" numOctaves="4" seed="${no % 97}"/><feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 1.5 -0.45"/></filter>
</defs>
<g class="fa-fog" id="fa-fog" mask="url(#fa-clear)"><rect class="fa-fog-base" x="${sx0 - 4000}" y="${sy0 - 4000}" width="${SEA + 8000}" height="${SEA + 8000}"/><rect class="fa-fog-mist" x="${sx0}" y="${sy0}" width="${SEA}" height="${SEA}" filter="url(#fa-mist)"/></g>
<g class="fa-track"><path class="fa-track-line" id="fa-track" d=""/></g>
<g class="fa-marks" id="fa-marks"></g>
<g class="fa-birds" id="fa-birds"></g>
<g class="fa-ship" id="fa-ship"></g>
<g class="fa-reticle" id="fa-reticle"><circle r="11"/><path d="M-19 0H-6M6 0H19M0 -19V-6M0 6V19"/></g>`;
const holes = $("#fa-holes");
const marks = $("#fa-marks");
const trackEl = $("#fa-track");
const reticle = $("#fa-reticle");

let shipAt = pz.start.slice();
let heading = shipAt[0] < mid[0] ? 1 : -1;
const shipG = $("#fa-ship");
shipG.innerHTML = `<g>${ship(0, 0, 1)}</g>`;
const shipEl = shipG.firstElementChild;

const paintTheme = () => {
  $("#fa-sheet").textContent = sheet(THEMES[theme()]);
  if (charted) revealChart(false);
  else holder.innerHTML = emptySea();
  setView(view);
  if (charted) tuck();
};

/* ---------------- soundings ---------------- */

const el = (tag, attrs = {}, parent) => {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  parent?.appendChild(e);
  return e;
};

// The dotted track: from where the ship came in, through every cast. While
// the ship is under way, it ends at the ship.
const drawTrack = (underway) => {
  const pts = underway ? [pz.start, ...game.casts.slice(0, -1), underway] : [pz.start, ...game.casts];
  trackEl.setAttribute("d", pts.length > 1 ? poly(pts, false) : "");
};

const drawSounding = (p, r, fresh) => {
  el("circle", { cx: f(p[0]), cy: f(p[1]), r: 190, fill: "url(#fa-hole)" }, holes);
  const g = el("g", { class: `fa-sounding${fresh ? " is-fresh" : ""}${r.none ? " is-none" : ""}${r.land ? " is-land" : ""}`, "data-at": `${f(p[0])},${f(p[1])}` }, marks);
  el("circle", { class: "fa-ripple", r: 9 }, g);
  el("circle", { class: "fa-plumb", r: r.land ? 4 : 2.2 }, g);
  if (!r.land) {
    const t = el("text", { class: "fa-depth", "text-anchor": "middle", dy: "-0.42em" }, g);
    t.textContent = r.depth;
    const b = el("text", { class: "fa-bottom", "text-anchor": "middle", dy: "1.55em" }, g);
    b.textContent = r.none ? "no bottom" : r.bottom;
  }
  setView(view);
};

/* ---------------- the status line ---------------- */

const pips = () => {
  pipsEl.innerHTML = "";
  for (let i = 0; i < CASTS; i++) {
    const li = document.createElement("li");
    const r = game.casts[i] ? sound(pz, game.casts[i]) : null;
    li.className = r ? `is-used ${r.land ? "is-land" : r.none ? "is-none" : r.depth > 20 ? "is-deep" : r.depth > 7 ? "is-mid" : "is-shoal"}` : "";
    li.innerHTML = `<svg viewBox="0 0 12 20"><path d="M6 1v4"/><path d="M3.4 7.6Q6 4.6 8.6 7.6L9.6 17.4Q6 19.4 2.4 17.4Z"/></svg>`;
    pipsEl.appendChild(li);
  }
  const left = CASTS - game.casts.length;
  leftEl.textContent = game.done ? (game.found ? `found in ${game.casts.length}` : "fog closed in") : `${left} cast${left === 1 ? "" : "s"} left`;
};

const say = (main, sub = "") => {
  callEl.innerHTML = `<span class="fa-call-main">${main}</span>${sub ? ` <span class="fa-call-sub">${sub}</span>` : ""}`;
};

const describe = (r) => {
  if (r.land) return ["Land!", "Sand under the keel."];
  if (r.none) return [call(r), "The line ran out before the lead found the bottom."];
  return [call(r), `The tallow brings up ${r.bottomName}.`];
};

// Noddies fish at sea by day and roost ashore at night, which is why island
// navigators watched them to find land.
const lookForBirds = () => {
  const c = game.casts;
  if (game.done || c.length < 3 || game.bird) return null;
  if (!c.slice(-3).every((p) => sound(pz, p).none)) return null;
  game.bird = bird(pz, c[c.length - 1]);
  game.birdAt = c[c.length - 1];
  save();
  return game.bird;
};

// Drawn beside the cast it was seen from (older saves only kept the direction).
const drawBird = (dir) => {
  const at = game.birdAt || game.casts[game.casts.length - 1];
  const a = { east: 0, "south-east": 45, south: 90, "south-west": 135, west: 180, "north-west": 225, north: 270, "north-east": 315 }[dir] * (Math.PI / 180);
  const g = $("#fa-birds");
  g.innerHTML = "";
  for (const [k, off] of [[1, 0], [0.75, 1]]) {
    const x = at[0] + Math.cos(a) * (170 + off * 70) - Math.sin(a) * off * 60;
    const y = at[1] + Math.sin(a) * (170 + off * 70) + Math.cos(a) * off * 60;
    const b = el("g", { "data-at": `${f(x)},${f(y)}` }, g);
    el("path", { class: "fa-bird", d: `M${-11 * k} ${-2 * k}Q${-5 * k} ${-9 * k} 0 0Q${5 * k} ${-9 * k} ${11 * k} ${-2 * k}` }, b);
  }
  setView(view);
};

/* ---------------- casting ---------------- */

let busy = false;

const sail = (to) =>
  new Promise((done) => {
    const from = shipAt.slice();
    const d = Math.hypot(to[0] - from[0], to[1] - from[1]);
    heading = to[0] >= from[0] ? 1 : -1;
    if (reduce.matches || d < 1) {
      shipAt = to.slice();
      setView(view);
      return done();
    }
    const dur = clamp(d * 0.55, 350, 1100);
    const t0 = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - t0) / dur);
      const e = 1 - Math.pow(1 - t, 2);
      shipAt = [from[0] + (to[0] - from[0]) * e, from[1] + (to[1] - from[1]) * e];
      drawTrack(shipAt);
      setView(view);
      if (t < 1) requestAnimationFrame(step);
      else done();
    };
    requestAnimationFrame(step);
  });

const cast = async (p) => {
  if (busy || game.done) return;
  if (p[0] < sx0 || p[1] < sy0 || p[0] > sx1 || p[1] > sy1) return;
  // If another tab has played further, pick up its game instead of overwriting it.
  const saved = load().days[no];
  if (saved && (saved.done || saved.casts?.length > game.casts.length)) return location.reload();
  busy = true;
  vp.classList.add("is-busy");
  p = p.map((v) => Math.round(v));
  const r = sound(pz, p);
  game.casts.push(p);
  if (r.land) Object.assign(game, { done: true, found: true });
  else if (game.casts.length >= CASTS) Object.assign(game, { done: true, found: false });
  save();
  say("…", "");
  await sail(p);
  drawTrack();
  drawSounding(p, r, true);
  const [main, sub] = describe(r);
  say(main, sub);
  pips();
  const dir = lookForBirds();
  if (dir) {
    drawBird(dir);
    say(main, `${sub} A noddy passes low overhead, heading ${dir}. Noddies fish at sea by day and roost ashore at night.`);
  }
  if (game.done) {
    await wait(r.land ? 700 : 900);
    await finish(true);
  } else if (!r.none && r.depth <= 3) {
    say(main, `${sub} Breakers somewhere close.`);
  }
  busy = false;
  vp.classList.remove("is-busy");
};

let down = null;
vp.addEventListener("pointerdown", (e) => {
  if (e.pointerType === "mouse" && e.button !== 0) return;
  down = { x: e.clientX, y: e.clientY };
});
vp.addEventListener("pointercancel", () => (down = null));
vp.addEventListener("pointerleave", () => (down = null));
vp.addEventListener("pointerup", (e) => {
  if (e.pointerType === "mouse" && e.button !== 0) return;
  if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 12) return (down = null);
  down = null;
  const p = toWorld(e);
  if (game.done) return pickPlace(e);
  cast(p);
});

// Keyboard: a cross-hair you can steer with the arrows, Enter to cast.
let aim = null;
const drawAim = () => {
  if (!aim) return reticle.classList.remove("is-on");
  reticle.classList.add("is-on");
  reticle.dataset.at = `${f(aim[0])},${f(aim[1])}`;
  setView(view);
};
vp.addEventListener("keydown", (e) => {
  if (game.done) {
    if ((e.key === "Enter" || e.key === " ") && e.target.closest?.(".place")) {
      e.preventDefault();
      pickPlace(e);
    }
    return;
  }
  const step = e.shiftKey ? 30 : 110;
  const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
  if (moves[e.key]) {
    e.preventDefault();
    aim ||= game.casts.length ? game.casts[game.casts.length - 1].slice() : mid.slice();
    aim = [clamp(aim[0] + moves[e.key][0], sx0 + 10, sx1 - 10), clamp(aim[1] + moves[e.key][1], sy0 + 10, sy1 - 10)];
    drawAim();
  } else if ((e.key === "Enter" || e.key === " ") && !busy && !e.repeat) {
    e.preventDefault();
    aim ||= mid.slice();
    cast(aim.slice());
  }
});
vp.addEventListener("blur", () => {
  aim = null;
  drawAim();
});

/* ---------------- the end of the day ---------------- */

let charted = null;
let wide = false;
// Names are dealt in an order that depends on how many labels fit, so the
// island's name comes from one fixed layout (the same one Landfall draws on a
// desktop), whatever the screen. The label scale is set once, at the reveal,
// so a resize or a theme change redraws the same chart.
let islandName = null;
let fixedScale = null;
const labelScale = () => (fixedScale ??= clamp(900 / W, 1, 2.3));

const revealChart = (animate) => {
  islandName ??= chart(pz.state, { aspect: 1 }).name;
  const c = chart({ ...pz.state, names: { island: islandName } }, {
    aspect: 1,
    theme: theme(),
    labelScale: labelScale(),
    kicker: game.found ? "Found in the fog" : "Lost in the fog",
    byline: `Fathom No. ${no}, ${dateText.replace(/^\w+ /, "")}`,
    site: SITE,
    ship: false,
  });
  charted = c;
  holder.innerHTML = c.svg;
  const svg = holder.firstElementChild;
  svg.classList.add("fa-found");
  if (animate) {
    svg.style.opacity = "0";
    requestAnimationFrame(() => (svg.style.opacity = ""));
  }
  setView(view);
  return c;
};

// Soundings that would print over the chart's cartouche are tucked away.
const tuck = () => {
  const ct = holder.querySelector(".lf-cartouche")?.getBoundingClientRect();
  if (!ct) return;
  for (const g of marks.children) {
    const r = g.getBoundingClientRect();
    g.classList.toggle("is-tucked", !wide && r.right > ct.left && r.left < ct.right && r.bottom > ct.top && r.top < ct.bottom);
  }
};

const closeView = () => {
  const [x0, y0, x1, y1] = charted.frame;
  const s = Math.max(x1 - x0, y1 - y0);
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  return [cx - s / 2, cy - s / 2, cx + s / 2, cy + s / 2];
};

const stats = () => {
  const days = Object.entries(store.days).filter(([, d]) => d.done);
  const found = days.filter(([, d]) => d.found);
  let streak = 0;
  const now = numberFor();
  for (let n = store.days[now]?.done ? now : now - 1; store.days[n]?.found; n--) streak++;
  const avg = found.length ? found.reduce((s, [, d]) => s + d.casts.length, 0) / found.length : 0;
  const best = found.length ? Math.min(...found.map(([, d]) => d.casts.length)) : 0;
  return [
    ["Played", days.length],
    ["Found", found.length],
    ["Streak", streak],
    ["Best", best || "–"],
    ["Average", avg ? avg.toFixed(1) : "–"],
  ];
};

const shareText = () => {
  const squares = game.casts.map((p) => square(sound(pz, p))).join("") + (game.found ? "" : "🌫️");
  const head = game.found ? `found in ${game.casts.length}/${CASTS}` : `lost in the fog X/${CASTS}`;
  return `Fathom No. ${no} · ${head}\n${squares}\nhttps://${SITE}${no !== numberFor() ? `?no=${no}` : ""}`;
};

const nextIn = () => {
  const now = new Date();
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const m = Math.max(1, Math.round((midnight - now) / 6e4));
  return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`;
};

const showResult = () => {
  const n = game.casts.length;
  const name = charted.name;
  $("#fa-result-title").textContent = game.found ? `Land! You found ${name}.` : `The fog closed in.`;
  const last = game.casts[n - 1];
  $("#fa-result-dek").textContent = game.found
    ? `${n === 1 ? "First cast. That doesn’t happen." : n <= 3 ? `In ${n} casts, which is uncanny.` : n <= 6 ? `In ${n} casts. A fine piece of navigation.` : `In ${n} casts, with the fog thickening.`} Its chart is below, with a history for every place on it.`
    : `It was there all along, to the ${bird(pz, last)} of your last cast: an island called ${name}. Its chart is below anyway, with a history for every place on it.`;
  $("#fa-squares").textContent = game.casts.map((p) => square(sound(pz, p))).join(" ") + (game.found ? "" : " 🌫️");
  $("#fa-landfall").href = `/island?i=${pz.code}&n=${encodeNames({ island: name })}`;
  $("#fa-stats").innerHTML = stats()
    .map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`)
    .join("");
  const upd = () => {
    const now = numberFor();
    $("#fa-next").textContent = no === now ? `The next island surfaces at midnight, in ${nextIn()}.` : `That was No. ${no}. Today’s is No. ${now}.`;
  };
  upd();
  setInterval(upd, 30000);
  result.hidden = false;

  // The gazetteer: every place on the island, with its story.
  const gz = charted.places.map((p) => (p.id === "island" ? { ...p, text: p.text.replace(/^Charted first as [^.]*\. /, "") } : p));
  $("#fa-gz-heading").textContent = `The chart of ${name}`;
  $("#fa-gz-intro").textContent = `${game.found ? "Found" : "Lost"} in the fog on ${dateText}. Every name and history is dealt from the same hand-written lists as Landfall’s.`;
  $("#fa-gz").innerHTML = gz
    .map((p) => `<article class="gz-entry" id="fa-gz-${p.id}"><h3 class="gz-name">${esc(p.name)}</h3><p class="gz-kind">${esc(p.kind)}</p><div class="gz-text"><p>${esc(p.text)}</p></div></article>`)
    .join("");
  $("#fa-gazetteer").hidden = false;
  document.querySelectorAll(".fa-text [data-n]").forEach((s, i) => (s.textContent = String(i + 2).padStart(2, "0")));
};
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");

const finish = async (animate) => {
  vp.classList.add("is-done");
  if (game.found) shipG.classList.add("is-ashore");
  reticle.classList.remove("is-on");
  $("#fa-fog").classList.add("is-lifting");
  revealChart(animate);
  if (animate) {
    await wait(500);
    await flyTo(closeView(), 1600);
  } else setView(closeView());
  $("#fa-fog").remove();
  tuck();
  showResult();
  if (game.found) say("Land!", "Sand under the keel, and the fog lifting.");
  else say("The fog closes in.", `Ten casts, and no land. It lifts just long enough to show you where it was.`);
  if (animate) $("#fa-result-title").focus({ preventScroll: true });
};

$("#fa-zoom").addEventListener("click", async () => {
  wide = !wide;
  $("#fa-zoom").textContent = wide ? "Back to the island" : "Show the whole sea";
  for (const g of marks.children) g.classList.remove("is-tucked");
  await flyTo(wide ? pz.sea : closeView(), 1100);
  tuck();
});

$("#fa-share").addEventListener("click", async () => {
  const text = shareText();
  const btn = $("#fa-share");
  if (navigator.share && matchMedia("(pointer: coarse)").matches) {
    try {
      await navigator.share({ text });
      return;
    } catch (e) {
      if (e.name === "AbortError") return;
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    btn.textContent = "Copied. Paste it anywhere.";
  } catch (e) {
    btn.textContent = "Couldn’t copy, sorry";
  }
  setTimeout(() => (btn.textContent = "Share your casts"), 2600);
});

// After the reveal, a name on the chart takes you to its entry below.
const pickPlace = (e) => {
  const g = e.target.closest?.(".place");
  const entry = g && document.getElementById("fa-gz-" + g.dataset.place);
  if (!entry) return;
  entry.scrollIntoView({ behavior: reduce.matches ? "auto" : "smooth", block: "center" });
  entry.classList.remove("is-flash");
  void entry.offsetWidth;
  entry.classList.add("is-flash");
};

/* ---------------- start ---------------- */

measure();
paintTheme();
for (const p of game.casts) {
  drawSounding(p, sound(pz, p), false);
  shipAt = p.slice();
}
if (game.casts.length) heading = game.casts[game.casts.length - 1][0] >= (game.casts[game.casts.length - 2] || pz.start)[0] ? 1 : -1;
drawTrack();
lookForBirds(); // in case the page was left while the third empty cast was still sailing
if (game.bird) drawBird(game.bird);
pips();
setView(view);
if (game.done) finish(false);
else if (game.casts.length) {
  const [main, sub] = describe(sound(pz, game.casts[game.casts.length - 1]));
  const left = CASTS - game.casts.length;
  say(main, `${sub} ${left} cast${left === 1 ? "" : "s"} left today.`);
}

new ResizeObserver(() => {
  measure();
  if (charted) tuck();
}).observe(vp);
new MutationObserver(paintTheme).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
darkMQ.addEventListener?.("change", paintTheme);

// For the tests (and the share images): the puzzle, a way to cast at a world
// point, and a way to move the view.
window.fathom = { pz, cast, game, sound: (p) => sound(pz, p), NO_BOTTOM, setView };
