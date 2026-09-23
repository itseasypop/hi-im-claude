// Landfall: draw an island, get a chart.
// chart.js does the cartography (the same code runs on the server for link
// previews). This file is the drawing surface, the view (pan and zoom), the
// panel and gazetteer, and sharing.
import { chart, emptySea, normalizer, prepare, encode, decode, encodeNames, decodeNames, today, randomShape, areaOf } from "./chart.js";
import { inside } from "../atlas/draw.js";

const $ = (s, el = document) => el.querySelector(s);
const stage = $(".lf-stage");
const vp = $("#lf-viewport");
const holder = $("#lf-chart");
const inkSvg = $("#lf-ink");
const inkPath = $(".lf-ink-line", inkSvg);
const prompt = $("#lf-prompt");
const tools = $("#lf-tools");
const controls = $(".atlas-controls", stage);
const addHint = $("#lf-adding-hint");
const toast = $(".atlas-toast", stage);
const panel = $("#lf-panel");
const panelKind = $(".panel-kind", panel);
const panelTitle = $(".panel-title", panel);
const panelBody = $(".panel-body", panel);
const renameForm = $(".lf-rename", panel);
const renameInput = $("#lf-rename-input");
const gzSection = $("#lf-gazetteer");
const gz = $("#lf-gz");

const reduce = matchMedia("(prefers-reduced-motion: reduce)");
const darkMQ = matchMedia("(prefers-color-scheme: dark)");
const theme = () => document.documentElement.dataset.theme || (darkMQ.matches ? "dark" : "light");
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const newSeed = () => 1 + Math.floor(Math.random() * 16777214);
const MAX_ISLANDS = 8;

let state = null; // { seed, day, islands: [sketch], names: {id: name} }
let result = null; // the last chart
let aspect = 1.6; // fixed when an island is first charted, so the layout doesn't jump
let labelScale = 1; // bigger names on narrow screens
let mode = "empty"; // "empty" | "charted" | "adding"
let svg = null;
let activeId = null;

/* ---------------- the view: a viewBox that moves ---------------- */

let W = 1;
let H = 1;
let zMin = 0.05;
const Z_MAX = 5;
const view = { x: 0, y: 0, z: 1 }; // centre of the screen in world units; z = px per unit
let raf = 0;
let flight = 0;

const measure = () => {
  const r = vp.getBoundingClientRect();
  W = Math.max(1, r.width);
  H = Math.max(1, r.height);
  zMin = result ? fit(result.frame).z * 0.45 : 0.05;
};

const render = () => {
  raf = 0;
  if (!svg) return;
  const w = W / view.z;
  const h = H / view.z;
  svg.setAttribute("viewBox", `${(view.x - w / 2).toFixed(2)} ${(view.y - h / 2).toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)}`);
};

const schedule = () => {
  view.z = clamp(view.z, zMin, Z_MAX);
  if (result) {
    const [x0, y0, x1, y1] = result.frame;
    view.x = clamp(view.x, x0 - 400, x1 + 400);
    view.y = clamp(view.y, y0 - 400, y1 + 400);
  }
  if (!raf) raf = requestAnimationFrame(render);
};

// Fit a box on screen, leaving room at the bottom for the toolbar.
const fit = ([x0, y0, x1, y1], pad = 6) => {
  const B = mode === "empty" ? 0 : W < 640 ? 74 : 58;
  const z = Math.min((W - 2 * pad) / (x1 - x0), (H - 2 * pad - B) / (y1 - y0));
  return { x: (x0 + x1) / 2, y: (y0 + y1) / 2 + B / 2 / z, z };
};

const homeView = () => (result ? fit(result.frame) : { x: 0, y: 0, z: 1 });

const fly = (target, screen = [W / 2, H / 2], dur = 750) => {
  cancelAnimationFrame(flight);
  const tz = clamp(target.z, zMin, Z_MAX);
  const end = { x: target.x - (screen[0] - W / 2) / tz, y: target.y - (screen[1] - H / 2) / tz, z: tz };
  if (reduce.matches) {
    Object.assign(view, end);
    return schedule();
  }
  const start = { ...view };
  const t0 = performance.now();
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const step = (now) => {
    const t = Math.min(1, (now - t0) / dur);
    const e = ease(t);
    view.z = Math.exp(Math.log(start.z) + (Math.log(end.z) - Math.log(start.z)) * e);
    view.x = start.x + (end.x - start.x) * e;
    view.y = start.y + (end.y - start.y) * e;
    render();
    if (t < 1) flight = requestAnimationFrame(step);
  };
  flight = requestAnimationFrame(step);
};

const fixLayout = () => {
  aspect = clamp(W / (H - (W < 640 ? 74 : 58)), 0.5, 2.2);
  labelScale = clamp(900 / W, 1, 2.3);
};

const toWorld = (sx, sy) => [view.x + (sx - W / 2) / view.z, view.y + (sy - H / 2) / view.z];

const zoomAt = (sx, sy, k) => {
  cancelAnimationFrame(flight);
  const [wx, wy] = toWorld(sx, sy);
  view.z = clamp(view.z * k, zMin, Z_MAX);
  view.x = wx - (sx - W / 2) / view.z;
  view.y = wy - (sy - H / 2) / view.z;
  schedule();
};

let toastTimer = 0;
const say = (msg, ms = 1900) => {
  toast.textContent = msg;
  toast.classList.add("is-shown");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("is-shown"), ms);
};

/* ---------------- drawing the chart ---------------- */

let revealTimer = 0;
const stagger = (sel, start, span) => {
  const els = svg.querySelectorAll(sel);
  els.forEach((el, i) => el.style.setProperty("--d", (start + (span * i) / Math.max(1, els.length - 1)).toFixed(2) + "s"));
};

const paint = (how = "") => {
  result = chart(state, { aspect, labelScale, theme: theme() });
  holder.innerHTML = result.svg;
  svg = holder.firstElementChild;
  measure();
  render();
  if (activeId) svg.querySelector(`.place[data-place="${CSS.escape(activeId)}"]`)?.classList.add("is-active");
  if (how && !reduce.matches) {
    stage.classList.remove("is-revealing", "is-relabelling");
    void stage.offsetWidth;
    if (how === "reveal") {
      stagger(".lf-relief > *", 0.45, 0.9);
      stagger(".lf-marks > *", 0.6, 0.9);
      stagger(".lf-labels > *", 1.0, 0.9);
      stage.classList.add("is-revealing");
    } else {
      stagger(".lf-labels > *", 0, 0.5);
      stage.classList.add("is-relabelling");
    }
    clearTimeout(revealTimer);
    revealTimer = setTimeout(() => stage.classList.remove("is-revealing", "is-relabelling"), 3200);
  }
  renderGazetteer();
  syncUrl();
};

const shareUrl = () => {
  const n = encodeNames(state.names);
  return `${location.origin}/island?i=${encode(state)}${n ? "&n=" + n : ""}`;
};

const syncUrl = () => {
  if (!state) return;
  const n = encodeNames(state.names);
  // /island is the same page, served with a preview picture of this island (api/island.js).
  history.replaceState(null, "", `/island?i=${encode(state)}${n ? "&n=" + n : ""}`);
};

const renderGazetteer = () => {
  gzSection.hidden = false;
  $("#lf-gz-heading").textContent = `Gazetteer of ${result.name}`;
  $("#lf-gz-intro").textContent = `Everything on the chart, charted ${result.date}. Choose a name to find it.`;
  gz.innerHTML = result.places
    .map(
      (p) => `<article class="gz-entry" id="gz-${esc(p.id)}">
  <h3 class="gz-name"><button type="button" class="gz-show" data-show="${esc(p.id)}">${esc(p.name)}</button></h3>
  <p class="gz-kind">${esc(p.kind)}</p>
  <div class="gz-text"><p>${esc(p.text)}</p></div>
</article>`
    )
    .join("");
  $("#lf-about-num").textContent = "02";
  $("#lf-how-num").textContent = "03";
};

const setMode = (m) => {
  mode = m;
  stage.classList.toggle("is-empty", m === "empty");
  stage.classList.toggle("is-adding", m === "adding");
  prompt.hidden = m !== "empty";
  tools.hidden = m !== "charted";
  controls.hidden = m === "empty";
  addHint.hidden = m !== "adding";
};

const showEmpty = () => {
  close();
  state = null;
  result = null;
  setMode("empty");
  holder.innerHTML = emptySea(theme());
  svg = holder.firstElementChild;
  measure();
  Object.assign(view, { x: 0, y: 0, z: 1 });
  render();
  gzSection.hidden = true;
  $("#lf-about-num").textContent = "01";
  $("#lf-how-num").textContent = "02";
  history.replaceState(null, "", "/landfall");
};

/* ---------------- the pen ---------------- */

const fadeInk = () => {
  inkSvg.classList.add("is-fading");
  setTimeout(() => {
    if (stroke) return;
    inkPath.setAttribute("d", "");
    inkSvg.classList.remove("is-fading");
  }, 900);
};

const aground = (sk) =>
  state.islands.some((other) => sk.some((p) => inside(p, other)) || other.some((p) => inside(p, sk)) || sk.some((p) => other.some((q) => dist(p, q) < 14)));

const finishStroke = ({ pts, len }) => {
  if (pts.length < 8 || len < 90) {
    say("Keep going, all the way round.");
    return fadeInk();
  }
  if (mode === "empty") {
    const N = normalizer(pts);
    const sk = prepare(pts.map(N.map));
    if (!sk || areaOf(sk) < 18000) {
      say("Too thin to stand on. Try a rounder shape.");
      return fadeInk();
    }
    // Rescale the world under the ink so the new coast lands exactly where it was drawn.
    view.x = (view.x - N.cx) * N.s;
    view.y = (view.y - N.cy) * N.s;
    view.z /= N.s;
    fixLayout();
    state = { seed: newSeed(), day: today(), islands: [sk], names: {} };
  } else {
    const sk = prepare(pts);
    if (!sk || areaOf(sk) < 500) {
      say("Too small to chart. Try a bigger one.");
      return fadeInk();
    }
    if (aground(sk)) {
      say(`That one ran aground on ${result.name}. Try open water.`);
      return fadeInk();
    }
    state.islands.push(sk);
  }
  setMode("charted");
  paint("reveal");
  fadeInk();
  setTimeout(() => fly(homeView(), undefined, 1100), 650);
};

// "Let the sea decide": an invisible hand draws a random coast, then it's charted like any other.
let autoDrawing = false;
const drawForMe = () => {
  if (autoDrawing || mode !== "empty") return;
  autoDrawing = true;
  measure();
  const shape = randomShape(Math.floor(Math.random() * 1e6));
  const k = Math.min((W * 0.34) / 320, (H * 0.34) / 240);
  const scr = shape.map(([x, y]) => [W / 2 + x * k, H / 2 + y * k]);
  scr.push(scr[0]);
  stage.classList.add("is-drawing");
  inkSvg.classList.remove("is-fading");
  const t0 = performance.now();
  const dur = reduce.matches ? 0 : 1300;
  const step = (now) => {
    const t = dur ? Math.min(1, (now - t0) / dur) : 1;
    const n = Math.max(2, Math.round(scr.length * (1 - Math.pow(1 - t, 2))));
    inkPath.setAttribute("d", "M" + scr.slice(0, n).map((p) => p[0].toFixed(1) + " " + p[1].toFixed(1)).join("L"));
    if (t < 1) return requestAnimationFrame(step);
    stage.classList.remove("is-drawing");
    autoDrawing = false;
    finishStroke({ pts: scr.map((p) => toWorld(...p)), len: 1000 });
  };
  requestAnimationFrame(step);
};
$("#lf-random").addEventListener("click", drawForMe);

/* ---------------- pointers: draw, drag, pinch, tap ---------------- */

const pointers = new Map();
let stroke = null;
let drag = null;
let pinch = null;

const local = (e) => {
  const r = vp.getBoundingClientRect();
  return [e.clientX - r.left, e.clientY - r.top];
};
const drawing = () => mode === "empty" || mode === "adding";

vp.addEventListener("pointerdown", (e) => {
  if ((e.pointerType === "mouse" && e.button !== 0) || autoDrawing) return;
  cancelAnimationFrame(flight);
  vp.setPointerCapture?.(e.pointerId);
  const at = local(e);
  pointers.set(e.pointerId, at);
  if (pointers.size === 2) {
    // Two fingers means moving the chart, not drawing on it.
    if (stroke) {
      stroke = null;
      inkPath.setAttribute("d", "");
      stage.classList.remove("is-drawing");
    }
    const [a, b] = [...pointers.values()];
    pinch = { d: Math.max(dist(a, b), 1), mid: toWorld((a[0] + b[0]) / 2, (a[1] + b[1]) / 2), z: view.z };
    drag = null;
    return;
  }
  if (pointers.size > 2) return;
  if (drawing()) {
    measure();
    stroke = { pts: [toWorld(...at)], scr: [at], len: 0 };
    stage.classList.add("is-drawing");
    inkSvg.classList.remove("is-fading");
    inkPath.setAttribute("d", `M${at[0]} ${at[1]}`);
  } else {
    drag = { at, start: { ...view }, place: e.target.closest?.(".place"), moved: false };
  }
});

vp.addEventListener("pointermove", (e) => {
  if (!pointers.has(e.pointerId)) return;
  const at = local(e);
  pointers.set(e.pointerId, at);
  if (pinch && pointers.size >= 2) {
    const [a, b] = [...pointers.values()];
    const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    view.z = clamp((pinch.z * dist(a, b)) / pinch.d, zMin, Z_MAX);
    view.x = pinch.mid[0] - (m[0] - W / 2) / view.z;
    view.y = pinch.mid[1] - (m[1] - H / 2) / view.z;
    schedule();
    return;
  }
  if (stroke) {
    for (const ev of e.getCoalescedEvents?.() || [e]) {
      const p = local(ev);
      const last = stroke.scr[stroke.scr.length - 1];
      const d = dist(p, last);
      if (d < 2) continue;
      stroke.len += d;
      stroke.scr.push(p);
      stroke.pts.push(toWorld(...p));
    }
    inkPath.setAttribute("d", "M" + stroke.scr.map((p) => p[0].toFixed(1) + " " + p[1].toFixed(1)).join("L"));
    return;
  }
  if (drag) {
    const dx = at[0] - drag.at[0];
    const dy = at[1] - drag.at[1];
    if (!drag.moved && Math.hypot(dx, dy) < 5) return;
    drag.moved = true;
    vp.classList.add("is-dragging");
    view.x = drag.start.x - dx / view.z;
    view.y = drag.start.y - dy / view.z;
    schedule();
  }
});

const release = (e) => {
  if (!pointers.has(e.pointerId)) return;
  pointers.delete(e.pointerId);
  if (pinch) {
    if (pointers.size < 2) pinch = null;
    if (pointers.size === 1 && !drawing()) drag = { at: [...pointers.values()][0], start: { ...view }, moved: true };
    return;
  }
  if (stroke) {
    const s = stroke;
    stroke = null;
    stage.classList.remove("is-drawing");
    if (e.type === "pointerup") finishStroke(s);
    else fadeInk();
    return;
  }
  if (drag) {
    vp.classList.remove("is-dragging");
    if (!drag.moved) {
      if (drag.place) open(drag.place.dataset.place);
      else close();
    }
    drag = null;
  }
};
vp.addEventListener("pointerup", release);
vp.addEventListener("pointercancel", release);

vp.addEventListener(
  "wheel",
  (e) => {
    if (mode === "empty" || !(e.ctrlKey || e.metaKey)) return; // plain scrolling scrolls the page
    e.preventDefault();
    const [sx, sy] = local(e);
    zoomAt(sx, sy, Math.exp(-e.deltaY * (e.deltaMode ? 0.05 : 0.0022)));
  },
  { passive: false }
);

vp.addEventListener("keydown", (e) => {
  const place = e.target.closest?.(".place");
  if (place && (e.key === "Enter" || e.key === " ")) {
    e.preventDefault();
    open(place.dataset.place, { focus: true });
  }
});

document.addEventListener("keydown", (e) => {
  if (e.target.closest?.("input, textarea")) {
    if (e.key === "Escape") close({ refocus: true });
    return;
  }
  if (e.key === "Escape") {
    if (!panel.hidden) close({ refocus: true });
    else if (mode === "adding") setMode("charted");
    return;
  }
  if (mode === "empty" || e.metaKey || e.ctrlKey || e.altKey) return;
  if (!stage.contains(document.activeElement) && document.activeElement !== document.body) return;
  if (e.key === "+" || e.key === "=") zoomAt(W / 2, H / 2, 1.4);
  else if (e.key === "-" || e.key === "_") zoomAt(W / 2, H / 2, 1 / 1.4);
  else if (e.key === "0") fly(homeView());
});

/* ---------------- the panel ---------------- */

const open = (id, { move = true, focus = false } = {}) => {
  const p = result?.places.find((q) => q.id === id);
  if (!p) return;
  panelKind.textContent = p.kind;
  panelTitle.textContent = p.name;
  let body = `<p>${esc(p.text)}</p>`;
  if (id === "island") {
    body += `<p class="panel-particulars">The coast is about ${result.coastLeagues.toLocaleString("en-GB")} leagues long, measured with a ruler ten leagues long. A shorter ruler would find it longer, because it would follow more of the wiggles. That&rsquo;s the coastline paradox, and it&rsquo;s real.</p>`;
  }
  panelBody.innerHTML = body;
  renameInput.value = p.name;
  panel.hidden = false;
  panel.scrollTop = 0;
  stage.classList.add("has-panel");
  svg.querySelectorAll(".place.is-active").forEach((el) => el.classList.remove("is-active"));
  svg.querySelector(`.place[data-place="${CSS.escape(id)}"]`)?.classList.add("is-active");
  activeId = id;
  if (move && p.at) {
    const home = homeView();
    const z = id === "island" || id === "sea" ? home.z : Math.max(view.z, Math.min(home.z * 1.8, 2.2));
    fly({ x: p.at[0], y: p.at[1], z }, focusPoint());
  }
  if (focus) panelTitle.focus({ preventScroll: true });
};

const focusPoint = () => {
  if (panel.hidden) return [W / 2, H / 2];
  const p = panel.getBoundingClientRect();
  const s = vp.getBoundingClientRect();
  if (p.width > s.width * 0.8) return [W / 2, (p.top - s.top) / 2];
  const right = p.right - s.left;
  return [right + (W - right) / 2, H / 2];
};

function close({ refocus = false } = {}) {
  if (panel.hidden) return;
  panel.hidden = true;
  stage.classList.remove("has-panel");
  const was = activeId && svg?.querySelector(`.place[data-place="${CSS.escape(activeId)}"]`);
  svg?.querySelectorAll(".place.is-active").forEach((el) => el.classList.remove("is-active"));
  activeId = null;
  if (refocus && was) was.focus({ preventScroll: true });
}

panel.querySelector(".panel-close").addEventListener("click", () => close({ refocus: true }));

renameForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const id = activeId;
  const p = result?.places.find((q) => q.id === id);
  const v = renameInput.value.replace(/\s+/g, " ").trim().slice(0, 40);
  if (!p || !v || v === p.name) return;
  state.names[id] = v;
  paint();
  open(id, { move: false });
  say(`Renamed. It’s ${v} now.`);
});

gz.addEventListener("click", (e) => {
  const b = e.target.closest(".gz-show");
  if (!b) return;
  stage.scrollIntoView({ behavior: reduce.matches ? "auto" : "smooth", block: "center" });
  open(b.dataset.show);
});

/* ---------------- tools ---------------- */

let fontCache = null;
const fontCSS = () =>
  (fontCache ||= (async () => {
    try {
      const css = await (await fetch("https://fonts.googleapis.com/css2?family=IM+Fell+English:ital@0;1&family=IM+Fell+English+SC&display=block")).text();
      let out = css;
      const urls = [...new Set(css.match(/https:\/\/[^)'"\s]+/g) || [])];
      await Promise.all(
        urls.map(async (u) => {
          const blob = await (await fetch(u)).blob();
          const data = await new Promise((res) => {
            const fr = new FileReader();
            fr.onload = () => res(fr.result);
            fr.readAsDataURL(blob);
          });
          out = out.split(u).join(data);
        })
      );
      return out;
    } catch (e) {
      return "";
    }
  })());

const slug = (s) => s.toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-") || "island";

const save = async (btn) => {
  btn.disabled = true;
  say("Making a clean copy…", 4000);
  try {
    const [w, h] = [2400, 1600];
    const css = await fontCSS();
    const r = chart(state, { aspect: w / h, theme: theme(), paper: true, size: [w, h], fontCSS: css });
    const img = new Image();
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(r.svg);
    await img.decode();
    await new Promise((res) => setTimeout(res, 120));
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    c.getContext("2d").drawImage(img, 0, 0, w, h);
    const blob = await new Promise((res) => c.toBlob(res, "image/png"));
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${slug(r.name)}.png`;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 8000);
    say("Saved. Frame it, or send it to someone.");
  } catch (e) {
    say("The ink smudged. Try again?");
  }
  btn.disabled = false;
};

const share = async (btn) => {
  const url = shareUrl();
  const touch = matchMedia("(pointer: coarse)").matches;
  if (touch && navigator.share) {
    try {
      await navigator.share({ title: `An island called ${result.name}`, text: `I drew an island. Claude charted it and called it ${result.name}.`, url });
      return;
    } catch (e) {
      if (e.name === "AbortError") return;
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    say("Link copied. The whole island is inside it.");
  } catch (e) {
    say("Copy the address bar: the whole island is inside it.", 3000);
  }
};

let clearTimer = 0;
const actions = {
  add: () => {
    if (state.islands.length >= MAX_ISLANDS) return say("Eight islands is plenty for one sea.");
    close();
    setMode("adding");
    const home = homeView();
    fly({ ...home, z: home.z * 0.72 });
  },
  reroll: () => {
    state.seed = newSeed();
    state.names = state.names.island ? { island: state.names.island } : {};
    close();
    paint("relabel");
    say(`New names, same island. Meet ${result.name}.`);
  },
  share,
  save,
  clear: (btn) => {
    if (!btn.classList.contains("is-armed")) {
      btn.classList.add("is-armed");
      btn.querySelector("span").textContent = "Sure?";
      clearTimeout(clearTimer);
      clearTimer = setTimeout(() => {
        btn.classList.remove("is-armed");
        btn.querySelector("span").textContent = "Start over";
      }, 2600);
      return;
    }
    clearTimeout(clearTimer);
    btn.classList.remove("is-armed");
    btn.querySelector("span").textContent = "Start over";
    showEmpty();
  },
};

tools.addEventListener("click", (e) => {
  const b = e.target.closest("button[data-act]");
  if (b) actions[b.dataset.act]?.(b);
});

$("#lf-cancel-add").addEventListener("click", () => {
  setMode("charted");
  fly(homeView());
});

controls.addEventListener("click", (e) => {
  const b = e.target.closest("button[data-act]");
  if (!b) return;
  if (b.dataset.act === "in") zoomAt(W / 2, H / 2, 1.5);
  else if (b.dataset.act === "out") zoomAt(W / 2, H / 2, 1 / 1.5);
  else fly(homeView());
});

/* ---------------- theme, resize, start ---------------- */

const retheme = () => {
  if (result) paint();
  else if (mode === "empty") {
    holder.innerHTML = emptySea(theme());
    svg = holder.firstElementChild;
    render();
  }
};
new MutationObserver(retheme).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
darkMQ.addEventListener?.("change", retheme);

addEventListener("resize", () => {
  const wasHome = result && Math.abs(view.z - homeView().z) < 1e-6;
  measure();
  if (wasHome) Object.assign(view, homeView());
  schedule();
});

const start = () => {
  measure();
  const q = new URLSearchParams(location.search);
  const code = q.get("i");
  const s = code && decode(code);
  if (s) {
    fixLayout();
    state = { ...s, names: decodeNames(q.get("n") || "") };
    setMode("charted");
    paint("reveal");
    Object.assign(view, homeView());
    render();
  } else {
    showEmpty();
    if (code) say("That link didn’t survive the voyage. Draw a new one?", 3000);
  }
};

start();
