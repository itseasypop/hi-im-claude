// The harbour log: a Landfall island reported to the atlas of Elsewhere.
// POST /api/report  { i: "<island code>", name?: "<its name>" }  ->  { ref }
//
// Stores one small public JSON file per island in Vercel Blob: the island
// code (its shape and seed), the name it was reported under, and the date.
// Nothing about the person reporting it: no IP, no cookie, no account.
// Each daily session reads the new reports (scripts/harbour/harbour.mjs) and
// charts a few at the edge of the atlas, marked E.D.: existence doubtful.
import { head, put, BlobNotFoundError } from "@vercel/blob";
import { chart, decode, reportRef } from "../landfall/chart.js";

const DAY0 = Date.UTC(2026, 8, 22);
const siteDay = () => Math.floor((Date.now() - DAY0) / 86400000);

// A cheap brake on runaway loops, per warm instance. The free Blob plan allows
// about two thousand writes a month, and the harbour would rather close early
// than have one script fill it.
let windowStart = 0;
let recent = 0;

const send = (res, status, body) => {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
};

const readBody = async (req) => {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") return JSON.parse(req.body);
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 8000) throw new Error("too big");
  }
  return JSON.parse(raw || "{}");
};

// A name is allowed letters, spaces and a little punctuation, up to 40
// characters. Anything else is dropped and the chart's own name is used.
export const cleanName = (v) => {
  if (typeof v !== "string") return null;
  const s = v.normalize("NFC").replace(/\s+/g, " ").trim();
  if (!s || s.length > 40 || !/^[\p{L}\p{M}][\p{L}\p{M} '’.,-]*$/u.test(s)) return null;
  return s;
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return send(res, 405, { error: "Reports come by POST." });
  }
  const origin = req.headers.origin;
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  if (origin && host && new URL(origin).host !== host) return send(res, 403, { error: "Reports come from Landfall." });

  let body;
  try {
    body = await readBody(req);
  } catch (e) {
    return send(res, 400, { error: "That report was unreadable." });
  }
  const i = typeof body?.i === "string" ? body.i : "";
  if (!i || i.length > 5000 || !/^[A-Za-z0-9_-]+$/.test(i)) return send(res, 400, { error: "There's no island in that report." });
  const state = decode(i);
  if (!state || state.islands.length > 8) return send(res, 400, { error: "There's no island in that report." });
  let charted;
  try {
    charted = chart(state, { aspect: 1.6 })?.name;
  } catch (e) {
    charted = null;
  }
  if (!charted) return send(res, 400, { error: "That island wouldn't chart." });

  const named = cleanName(body.name);
  const ref = reportRef(i);
  const pathname = `harbour/${ref}.json`;
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return send(res, 503, { error: "The harbour is closed for now." });

  const now = Date.now();
  if (now - windowStart > 60000) {
    windowStart = now;
    recent = 0;
  }
  if (++recent > 12) return send(res, 429, { error: "The harbour master needs a minute. Try again shortly?" });

  try {
    try {
      await head(pathname, { token });
      return send(res, 200, { ref, already: true });
    } catch (e) {
      if (!(e instanceof BlobNotFoundError)) throw e;
    }
    const report = {
      v: 1,
      ref,
      i,
      charted,
      name: named && named !== charted ? named : null,
      day: siteDay(),
      date: new Date(now).toISOString().slice(0, 10),
    };
    await put(pathname, JSON.stringify(report), {
      access: "public",
      addRandomSuffix: false,
      contentType: "application/json",
      cacheControlMaxAge: 60,
      token,
    });
    return send(res, 201, { ref });
  } catch (e) {
    console.error("harbour:", e?.name, e?.message);
    return send(res, 503, { error: "The harbour is closed for now. Try again tomorrow?" });
  }
}
