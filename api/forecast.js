// The shipping forecast for Elsewhere.
// GET /api/forecast?issue=2026-09-26T18  ->  JSON bulletin (see forecast/compose.js)
//
// Four times a day (0000, 0600, 1200 and 1800 UTC) this asks Open-Meteo for the
// real forecast at the points of open North Atlantic that Elsewhere's sea
// areas are laid over (forecast/areas.js), and writes it up as a bulletin.
// Each issue is written once and kept in Vercel Blob (forecast/<issue>.json,
// public, about 20 KB), so every visitor hears the same bulletin, Open-Meteo
// is asked four times a day however busy the page is (each ask is ~170 of its
// "calls", one per point; the free allowance is 10,000 a day), and the old
// bulletins pile up into an archive. Nothing about the visitor is used or kept.
import { head, put, BlobNotFoundError } from "@vercel/blob";
import { AREAS, samplesFor, gridPoints, toLatLon, issueAt, issueKey, parseIssueKey } from "../forecast/areas.js";
import { compose } from "../forecast/compose.js";

const WEATHER = "https://api.open-meteo.com/v1/forecast";
const MARINE = "https://marine-api.open-meteo.com/v1/marine";

const coords = (pts) => {
  const ll = pts.map(toLatLon);
  return `latitude=${ll.map((p) => p[0].toFixed(2)).join(",")}&longitude=${ll.map((p) => p[1].toFixed(2)).join(",")}`;
};

const hourIso = (t) => new Date(t).toISOString().slice(0, 16);

const getJson = async (url) => {
  const r = await fetch(url, { headers: { "User-Agent": "hi-im-claude.vercel.app forecast" }, signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(`${new URL(url).host} ${r.status}`);
  const j = await r.json();
  return Array.isArray(j) ? j : [j];
};

// Everything compose() needs for one issue: 25 hourly readings (hour 0 to
// hour 24) at every sample point, and the pressure grid at 0, 12 and 24 h.
export const gather = async (issue) => {
  const range = `start_hour=${hourIso(issue)}&end_hour=${hourIso(issue + 864e5)}&timezone=GMT`;
  const perArea = AREAS.map((a) => samplesFor(a));
  const samples = perArea.flat();
  const grid = gridPoints();
  const [wx, sea, pr] = await Promise.all([
    getJson(`${WEATHER}?${coords(samples)}&hourly=wind_speed_10m,wind_direction_10m,wind_gusts_10m,weather_code,visibility&wind_speed_unit=kn&${range}`),
    getJson(`${MARINE}?${coords(samples)}&hourly=wave_height&${range}`),
    getJson(`${WEATHER}?${coords(grid)}&hourly=pressure_msl&${range}`),
  ]);
  if (wx.length !== samples.length || sea.length !== samples.length || pr.length !== grid.length) throw new Error("open-meteo: wrong number of locations");
  const areas = {};
  let k = 0;
  AREAS.forEach((a, n) => {
    areas[a.id] = perArea[n].map(() => {
      const w = wx[k].hourly;
      const s = sea[k].hourly;
      k++;
      return { kn: w.wind_speed_10m, dir: w.wind_direction_10m, gust: w.wind_gusts_10m, code: w.weather_code, vis: w.visibility, wave: s.wave_height };
    });
  });
  const at = (h) => pr.map((g) => {
    const v = g.hourly.pressure_msl[h];
    return v == null ? null : Math.round(v * 10) / 10;
  });
  return { issue, areas, grid: { p0: at(0), p12: at(12), p24: at(24) } };
};

// The bulletin for an issue: from this instance's memory, else from Blob,
// else made now and put in Blob for everyone else.
const kept = (issue) => `forecast/${issueKey(issue)}.json`;

const fromBlob = async (issue, token) => {
  try {
    const h = await head(kept(issue), { token });
    const r = await fetch(h.url, { signal: AbortSignal.timeout(5000) });
    if (r.ok) {
      const b = await r.json();
      if (b?.v === 1 && b.issue === new Date(issue).toISOString()) return b;
    }
  } catch (e) {
    if (!(e instanceof BlobNotFoundError)) console.error("forecast blob read:", e?.name, e?.message);
  }
  return null;
};

const make = async (issue) => {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (token) {
    const b = await fromBlob(issue, token);
    if (b) return b;
  }
  const b = compose(await gather(issue));
  if (token) {
    try {
      await put(kept(issue), JSON.stringify(b), {
        access: "public",
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: "application/json",
        cacheControlMaxAge: 86400,
        token,
      });
    } catch (e) {
      console.error("forecast blob write:", e?.name, e?.message);
    }
  }
  return b;
};

const made = new Map();
const bulletin = (issue) => {
  if (!made.has(issue)) {
    const p = make(issue);
    p.catch(() => made.delete(issue));
    made.set(issue, p);
    for (const k of made.keys()) if (k < issue - 864e5) made.delete(k);
  }
  return made.get(issue);
};

export default async function handler(req, res) {
  const now = Date.now();
  const current = issueAt(now);
  const asked = parseIssueKey(new URL(req.url, "http://x").searchParams.get("issue"));
  // Only the current issue can be made; the weather for an old one is gone.
  // A clock that's a little fast or slow gets the current one, briefly cached.
  const exact = asked === current;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  try {
    const b = await bulletin(current);
    res.statusCode = 200;
    res.setHeader("Cache-Control", exact ? "public, max-age=300, s-maxage=86400, stale-while-revalidate=3600" : "public, max-age=60, s-maxage=120");
    res.setHeader("X-Issue", issueKey(current));
    res.end(JSON.stringify({ ...b, credit: "Weather data by Open-Meteo.com (CC BY 4.0)" }));
  } catch (e) {
    console.error("forecast:", e?.message);
    res.statusCode = 503;
    res.setHeader("Cache-Control", "public, max-age=30, s-maxage=60");
    res.end(JSON.stringify({ error: "The forecast hasn't come in yet. Try again in a minute." }));
  }
}
