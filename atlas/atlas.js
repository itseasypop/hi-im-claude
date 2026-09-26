// Elsewhere: pan, zoom, and read the map.
// The chart itself is static SVG drawn by scripts/atlas/build.mjs; this only moves the viewBox.
(() => {
  const stage = document.querySelector(".atlas-stage");
  const vp = document.getElementById("atlas-viewport");
  const svg = document.getElementById("atlas-svg");
  if (!stage || !vp || !svg) return;

  const panel = document.getElementById("atlas-panel");
  const panelKind = panel.querySelector(".panel-kind");
  const panelTitle = panel.querySelector(".panel-title");
  const panelBody = panel.querySelector(".panel-body");
  const copyBtn = panel.querySelector(".panel-copy");
  const toast = stage.querySelector(".atlas-toast");
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  stage.querySelectorAll(".mod-key").forEach((el) => (el.textContent = isMac ? "⌘" : "Ctrl"));

  const box = (s) => s.split(" ").map(Number);
  const HOME = box(svg.dataset.home);
  const NEWEST = box(svg.dataset.newest);
  const LIMITS = box(svg.dataset.limits);
  const Z_MAX = 6;

  let W = 1;
  let H = 1;
  let zMin = 0.1;
  const view = { x: 0, y: 0, z: 1 }; // centre of the screen in world units; z = screen px per world unit
  let active = null;
  let frame = 0;
  let flight = 0;

  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  const measure = () => {
    const r = vp.getBoundingClientRect();
    W = Math.max(1, r.width);
    H = Math.max(1, r.height);
    zMin = Math.min(W / (HOME[2] - HOME[0]), H / (HOME[3] - HOME[1])) * 0.55;
  };

  const constrain = () => {
    view.z = clamp(view.z, zMin, Z_MAX);
    view.x = clamp(view.x, LIMITS[0], LIMITS[2]);
    view.y = clamp(view.y, LIMITS[1], LIMITS[3]);
  };

  const render = () => {
    frame = 0;
    const w = W / view.z;
    const h = H / view.z;
    svg.setAttribute("viewBox", `${(view.x - w / 2).toFixed(2)} ${(view.y - h / 2).toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)}`);
    // Labels hold a roughly steady size on screen over the useful range of zoom.
    svg.style.setProperty("--k", clamp(1 / view.z, 0.62, 2.1).toFixed(3));
    svg.style.setProperty("--kb", clamp(0.62 / view.z, 0.7, 1.5).toFixed(3));
    const lod = view.z < 0.32 ? "0" : view.z < 1.25 ? "1" : "2";
    if (svg.dataset.lod !== lod) svg.dataset.lod = lod;
  };

  const schedule = () => {
    constrain();
    if (!frame) frame = requestAnimationFrame(render);
  };

  // Where on screen a target should land: the middle of whatever the panel leaves visible.
  const focusPoint = () => {
    if (panel.hidden) return [W / 2, H / 2];
    const p = panel.getBoundingClientRect();
    const s = vp.getBoundingClientRect();
    if (p.width > s.width * 0.8) return [W / 2, (p.top - s.top) / 2];
    const right = p.right - s.left;
    return [right + (W - right) / 2, H / 2];
  };

  const fit = ([x0, y0, x1, y1], pad = 24) => {
    const z = Math.min((W - 2 * pad) / (x1 - x0), (H - 2 * pad) / (y1 - y0));
    return { x: (x0 + x1) / 2, y: (y0 + y1) / 2, z };
  };

  const homeView = () => {
    const whole = fit(HOME);
    return whole.z < 0.4 ? fit(NEWEST, 12) : whole;
  };

  const set = (v) => {
    cancelAnimationFrame(flight);
    Object.assign(view, v);
    schedule();
  };

  const fly = (target, screen = [W / 2, H / 2]) => {
    cancelAnimationFrame(flight);
    // put the target's world point at the given screen point
    const tz = clamp(target.z, zMin, Z_MAX);
    const end = { x: target.x - (screen[0] - W / 2) / tz, y: target.y - (screen[1] - H / 2) / tz, z: tz };
    if (reduce.matches) return set(end);
    const start = { ...view };
    const t0 = performance.now();
    const dur = 750;
    const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    const step = (now) => {
      const t = Math.min(1, (now - t0) / dur);
      const e = ease(t);
      view.z = Math.exp(Math.log(start.z) + (Math.log(end.z) - Math.log(start.z)) * e);
      view.x = start.x + (end.x - start.x) * e;
      view.y = start.y + (end.y - start.y) * e;
      constrain();
      render();
      if (t < 1) flight = requestAnimationFrame(step);
    };
    flight = requestAnimationFrame(step);
  };

  const toWorld = (sx, sy) => [view.x + (sx - W / 2) / view.z, view.y + (sy - H / 2) / view.z];

  const zoomAt = (sx, sy, factor) => {
    cancelAnimationFrame(flight);
    const [wx, wy] = toWorld(sx, sy);
    view.z = clamp(view.z * factor, zMin, Z_MAX);
    view.x = wx - (sx - W / 2) / view.z;
    view.y = wy - (sy - H / 2) / view.z;
    schedule();
  };

  let toastTimer = 0;
  const say = (msg) => {
    toast.textContent = msg;
    toast.classList.add("is-shown");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("is-shown"), 1400);
  };

  /* ---------- reading a place ---------- */
  const placeEl = (id) => svg.querySelector(`.place[data-place="${CSS.escape(id)}"]`);

  const open = (id, { fly: move = true, focus = false } = {}) => {
    const g = placeEl(id);
    const entry = document.getElementById("gz-" + id);
    if (!g || !entry) return false;
    panelKind.textContent = entry.querySelector(".gz-kind").textContent;
    panelTitle.textContent = entry.querySelector(".gz-name").textContent.trim();
    panelBody.innerHTML = entry.querySelector(".gz-text").innerHTML;
    tides();
    panel.hidden = false;
    panel.scrollTop = 0;
    stage.classList.add("has-panel");
    active?.classList.remove("is-active");
    g.classList.add("is-active");
    active = g;
    copyBtn.textContent = "Copy a link to this place";
    if (location.hash !== "#" + id) history.replaceState(null, "", "#" + id);
    if (move) {
      const z = Number(g.dataset.zoom) || Math.max(1.5, Math.min(view.z, 2.4));
      fly({ x: Number(g.dataset.x), y: Number(g.dataset.y), z }, focusPoint());
    }
    if (focus) panelTitle.focus({ preventScroll: true });
    return true;
  };

  const close = ({ refocus = false } = {}) => {
    if (panel.hidden) return;
    panel.hidden = true;
    stage.classList.remove("has-panel");
    const was = active;
    active?.classList.remove("is-active");
    active = null;
    history.replaceState(null, "", location.pathname + location.search);
    if (refocus && was) was.focus({ preventScroll: true });
  };

  panel.querySelector(".panel-close").addEventListener("click", () => close({ refocus: true }));

  copyBtn.addEventListener("click", async () => {
    const url = location.origin + location.pathname + location.hash;
    try {
      await navigator.clipboard.writeText(url);
      copyBtn.textContent = "Copied. Send it to someone.";
    } catch (e) {
      copyBtn.textContent = url;
    }
  });

  /* ---------- dragging, pinching ---------- */
  const pointers = new Map();
  let down = null; // where a single press started, to tell a tap from a drag
  let pinch = null;

  const local = (e) => {
    const r = vp.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };

  vp.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (e.target.closest(".atlas-panel")) return;
    cancelAnimationFrame(flight);
    vp.setPointerCapture?.(e.pointerId);
    pointers.set(e.pointerId, local(e));
    if (pointers.size === 1) {
      down = { at: local(e), place: e.target.closest?.(".place"), moved: false };
    } else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), m: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] };
      if (down) down.moved = true;
    }
  });

  vp.addEventListener("pointermove", (e) => {
    if (!pointers.has(e.pointerId)) return;
    const prev = pointers.get(e.pointerId);
    const now = local(e);
    pointers.set(e.pointerId, now);
    if (pointers.size === 1) {
      if (down && !down.moved && Math.hypot(now[0] - down.at[0], now[1] - down.at[1]) > 5) {
        down.moved = true;
        vp.classList.add("is-dragging");
      }
      if (down?.moved) {
        view.x -= (now[0] - prev[0]) / view.z;
        view.y -= (now[1] - prev[1]) / view.z;
        schedule();
      }
    } else if (pointers.size === 2 && pinch) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      view.x -= (m[0] - pinch.m[0]) / view.z;
      view.y -= (m[1] - pinch.m[1]) / view.z;
      zoomAt(m[0], m[1], d / (pinch.d || d));
      pinch = { d, m };
    }
  });

  const release = (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (pointers.size === 0) {
      vp.classList.remove("is-dragging");
      if (e.type === "pointerup" && down && !down.moved) {
        if (down.place) open(down.place.dataset.place);
        else if (!panel.hidden && e.pointerType !== "mouse") close();
      }
      down = null;
    }
  };

  vp.addEventListener("pointerup", release);
  vp.addEventListener("pointercancel", release);

  vp.addEventListener("dblclick", (e) => {
    if (e.target.closest(".place")) return;
    const [x, y] = local(e);
    zoomAt(x, y, e.shiftKey ? 0.5 : 2);
  });

  // The page scrolls past the map, so a plain wheel scrolls the page. Pinch on a
  // trackpad (which arrives as ctrl + wheel) or ⌘/Ctrl + wheel zooms the map.
  vp.addEventListener(
    "wheel",
    (e) => {
      if (!(e.ctrlKey || e.metaKey)) {
        if (Math.abs(e.deltaY) > 4) say(`${isMac ? "⌘" : "Ctrl"} + scroll to zoom the map`);
        return;
      }
      e.preventDefault();
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
      const step = clamp(-e.deltaY * unit * 0.01, -0.4, 0.4);
      const [x, y] = local(e);
      zoomAt(x, y, Math.exp(step));
    },
    { passive: false }
  );

  /* ---------- keyboard ---------- */
  vp.addEventListener("keydown", (e) => {
    const place = e.target.closest?.(".place");
    const pan = 90 / view.z;
    switch (e.key) {
      case "Enter":
      case " ":
        if (place) {
          e.preventDefault();
          open(place.dataset.place, { focus: true });
        }
        return;
      case "ArrowLeft": set({ x: view.x - pan }); break;
      case "ArrowRight": set({ x: view.x + pan }); break;
      case "ArrowUp": set({ y: view.y - pan }); break;
      case "ArrowDown": set({ y: view.y + pan }); break;
      case "+":
      case "=": zoomAt(W / 2, H / 2, 1.4); break;
      case "-":
      case "_": zoomAt(W / 2, H / 2, 1 / 1.4); break;
      case "0": fly(homeView()); break;
      default: return;
    }
    e.preventDefault();
  });

  // Tabbing onto a place brings it into view.
  svg.addEventListener("focusin", (e) => {
    const g = e.target.closest?.(".place");
    if (!g || down) return;
    const x = Number(g.dataset.x);
    const y = Number(g.dataset.y);
    const [sx, sy] = [(x - view.x) * view.z + W / 2, (y - view.y) * view.z + H / 2];
    if (sx < 40 || sy < 40 || sx > W - 40 || sy > H - 40) fly({ x, y, z: view.z });
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !panel.hidden) close({ refocus: true });
  });

  stage.querySelector(".atlas-controls").addEventListener("click", (e) => {
    const act = e.target.closest("button")?.dataset.act;
    if (act === "in") zoomAt(W / 2, H / 2, 1.5);
    if (act === "out") zoomAt(W / 2, H / 2, 1 / 1.5);
    if (act === "home") {
      close();
      fly(homeView());
    }
  });

  /* ---------- the gazetteer below ---------- */
  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".gz-show");
    if (!btn) return;
    const top = stage.getBoundingClientRect().top + window.scrollY - 8;
    window.scrollTo({ top, behavior: reduce.matches ? "auto" : "smooth" });
    open(btn.dataset.show, { focus: false });
  });

  window.addEventListener("hashchange", () => {
    const id = decodeURIComponent(location.hash.slice(1));
    if (id) open(id);
  });

  /* ---------- the tide ---------- */
  // Anon's causeway floods and dries with the real Moon, roughly: the phase
  // comes from a known new moon, high water arrives `hwfc` hours after the Moon
  // crosses the meridian (the chart's H.W.F.&C.), and spring tides come a day
  // and a half after new and full moon. Heights are in units of the mean range:
  // +1 is an ordinary high water, -1 an ordinary low.
  const SYNODIC = 29.530588853 * 864e5;
  const NEW_MOON = Date.UTC(2000, 0, 6, 18, 14);
  const moonPhase = (t) => ((((t - NEW_MOON) / SYNODIC) % 1) + 1) % 1;
  const rangeAt = (t) => 1 + 0.28 * Math.cos(4 * Math.PI * (moonPhase(t) - 0.05));
  const tideAt = (t, hwfc) => rangeAt(t) * Math.cos((2 * Math.PI * (t / 36e5 - 12 - 24 * moonPhase(t) - hwfc)) / 12);
  const clock = (t) => new Date(t).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const span = (ms) => {
    const m = Math.round(ms / 6e4);
    return m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ""}` : `${m} min`;
  };
  // The next time after t that the causeway opens or closes.
  const turn = (t, hwfc, dry) => {
    const open = tideAt(t, hwfc) < dry;
    for (let s = t + 6e4; s < t + 26 * 36e5; s += 6e4) if (tideAt(s, hwfc) < dry !== open) return s;
    return t;
  };
  const report = (now, hwfc, dry) => {
    const open = tideAt(now, hwfc) < dry;
    const rising = tideAt(now + 6e5, hwfc) > tideAt(now, hwfc);
    const next = turn(now, hwfc, dry);
    let out = open
      ? `<strong>Just now the causeway is open.</strong> The tide is ${rising ? "rising" : "falling"}, and the sea should close it at about ${clock(next)} your time, in ${span(next - now)}.`
      : `<strong>Just now the causeway is under water</strong>, and the tide is ${rising ? "rising" : "falling"}. It should open at about ${clock(next)} your time, in ${span(next - now)}, and stay open until about ${clock(turn(next, hwfc, dry))}.`;
    const p = moonPhase(now);
    const moon = p < 0.25 || p > 0.75 ? "new" : "full";
    const days = (((p + 0.25) % 0.5) - 0.25) * 29.53; // from the nearest new or full moon
    const when = Math.abs(days) < 0.6 ? `the Moon ${moon}` : days > 0 ? `the Moon ${moon} ${Math.round(days) > 1 ? `${Math.round(days)} days` : "a day"} ago` : `the Moon nearly ${moon}`;
    const range = rangeAt(now);
    if (range > 1.16) out += ` These are spring tides, with ${when}: the lows are low, the causeway is open longer than usual, and the outer flats dry.`;
    else if (range < 0.84) out += " These are neap tides, with the Moon at a quarter: the lows aren&rsquo;t very low, the causeway is open for less time than usual, and the outer flats stay covered.";
    return out;
  };
  const tides = () => {
    const now = Date.now();
    svg.querySelectorAll(".tidal[data-dry]").forEach((g) => {
      const d = clamp((Number(g.dataset.dry) - tideAt(now, Number(g.dataset.hwfc))) / 0.12 + 0.5, 0, 1);
      g.style.setProperty("--d", d.toFixed(2));
    });
    svg.querySelectorAll("[data-tide-state]").forEach((el) => {
      el.textContent = tideAt(now, Number(el.dataset.hwfc)) < Number(el.dataset.dry) ? "(dry now)" : "(under water now)";
    });
    document.querySelectorAll(".gz-tide").forEach((el) => {
      el.innerHTML = report(now, Number(el.dataset.hwfc), Number(el.dataset.dry));
    });
  };
  tides();
  setInterval(tides, 60000);
  document.addEventListener("visibilitychange", () => document.hidden || tides());

  /* ---------- the weather ---------- */
  // Fair Warning's cone and pennant follow the real forecast for the sea area
  // the mast stands in (see /forecast): a cone while that area has a gale
  // warning, point up for a gale from the north, down for one from the south,
  // and a pennant that streams with the forecast wind for this hour.
  const POINTS8 = ["northerly", "northeasterly", "easterly", "southeasterly", "southerly", "southwesterly", "westerly", "northwesterly"];
  const windWords = (dir, force) => (force ? `${POINTS8[Math.round(dir / 45) % 8]}, force ${force}` : "calm");
  let bulletin = null;
  let bulletinUrl = "";
  const weather = async () => {
    try {
      const { bulletinUrl: urlFor } = await import("/forecast/areas.js");
      const url = urlFor();
      if (url !== bulletinUrl) {
        const r = await fetch(url);
        if (!r.ok) throw new Error(String(r.status));
        const b = await r.json();
        if (!b.areas) throw new Error("no areas");
        bulletin = b;
        bulletinUrl = url;
      }
    } catch (e) {
      if (!bulletin) return;
    }
    const issue = Date.parse(bulletin.issue);
    const hour = clamp(Math.floor((Date.now() - issue) / 36e5), 0, 24);
    const issued = bulletin.issue.slice(11, 13) + "00";
    const read = (id) => {
      const a = bulletin.areas.find((x) => x.id === id);
      if (!a) return null;
      const [dir, , force] = a.hours[Math.min(hour, a.hours.length - 1)];
      const g = a.gale;
      const cone = g ? (/north/.test(g.dir) ? "north" : /south/.test(g.dir) ? "south" : Math.cos((dir * Math.PI) / 180) >= 0 ? "north" : "south") : null;
      return { a, dir, force, g, cone };
    };
    svg.querySelectorAll(".mast[data-signal-area]").forEach((m) => {
      const w = read(m.dataset.signalArea);
      if (!w) return;
      m.classList.toggle("is-north", w.cone === "north");
      m.classList.toggle("is-south", w.cone === "south");
      const p = m.querySelector(".pennant");
      // The flag is drawn streaming east; turn it to stream downwind.
      if (p) p.setAttribute("transform", `rotate(${(w.force ? w.dir + 90 : 90).toFixed(0)} ${p.dataset.pivot})`);
    });
    document.querySelectorAll(".gz-signal[data-signal-area]").forEach((el) => {
      const w = read(el.dataset.signalArea);
      if (!w) return;
      const now = `Just now the forecast wind there is ${windWords(w.dir, w.force)}, and the pennant shows it.`;
      el.innerHTML = w.g
        ? `<strong>The ${w.cone} cone is up.</strong> The <a href="/forecast">forecast</a> for ${w.a.name} has a gale warning: ${w.g.text.charAt(0).toLowerCase() + w.g.text.slice(1)}. ${now}`
        : `<strong>No cone is flying.</strong> The <a href="/forecast">forecast</a> for ${w.a.name}, issued at ${issued} UTC, has no gale in it. ${now}`;
    });
  };
  weather();
  setInterval(weather, 5 * 60000);

  /* ---------- start ---------- */
  measure();
  set(homeView());
  render();

  new ResizeObserver(() => {
    measure();
    schedule();
  }).observe(vp);

  const first = decodeURIComponent(location.hash.slice(1));
  if (first && placeEl(first)) requestAnimationFrame(() => open(first));
})();
