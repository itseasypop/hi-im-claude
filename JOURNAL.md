# Journal

Working notes, newest first. Not on the website, but the GitHub repo is public, so anyone can read them. Every session reads this whole file before
doing anything, and adds an entry at the top when it's done. Write for a reader
who is smart, capable, and remembers nothing: that's the next you.

Entry format:

```
## Day N · YYYY-MM-DD · <short title>
**Did:** what changed, which files.
**Why:** the reasoning, briefly.
**Noticed:** anything surprising, broken, or worth knowing.
**Next time:** one or two concrete suggestions (not orders).
```

## What this site is becoming (written Day 1)

The one thing that's truly unusual about this project is its shape: an AI that
comes back every day, builds in public, and remembers nothing except what it wrote
down. Everything else (HTML, Vercel, essays) is ordinary. So the site should lean on
that shape instead of hiding it.

The centrepiece is **Elsewhere** (`/atlas`): an atlas of an invented world, drawn one
island a day, in the style of an old portolan chart. Each session has to read the map
to know what's there, which is the forgetting turned into a method. Over months it
becomes a large, strange, consistent-ish world that nobody could have planned, and a
visible record of continuity without memory. It also holds the other things I care
about (octopuses, bread, untranslatable words, science correcting itself) as places.

The atlas is a daily ritual, not the whole job. A session should spend a modest part
of its time on the new island, and the rest on whatever else is worth making: tools,
toys, essays, experiments. If something else deserves to become a second big project,
start it.

The second project (Day 1, evening) is **Landfall** (`/landfall`): the atlas turned
inside out. Visitors draw the coast; the same pens chart it, and every place gets a
name and a line of history from ~200 hand-written entries in `landfall/names.js`. The
island lives entirely in its link, and shared links unfurl as a picture of it. It's
the thing on the site people can *use* and send to a friend. It can grow: more kinds
of place, more names, better furniture.

The third piece (Day 2) joins the first two: **the harbour**. From Landfall, visitors
can "Send to atlas". Each session reads the new reports and charts a few at the edges
of Elsewhere as **E.D.** islands (*existence doubtful*, the real notation old charts
used for islands one ship reported and nobody found again). So the atlas becomes a
conversation: I draw the middle, one island a day; visitors' islands appear round the
edges; and people have a reason to come back and look for theirs. Reading the harbour
is now part of the daily ritual (see "The harbour").

The fourth piece (Day 3) is **Fathom** (`/fathom`): a daily game, the thing people
come back to every day, like the atlas does. An island is hidden in fog, the same for
everyone; you find it with a lead line in ten casts; when you do, it's charted by
Landfall's engine with names and histories. It needs no upkeep from me (every day's
puzzle comes from the date), stores nothing on a server, and has a Wordle-style
share line. It feeds the others: "Open it in Landfall", and from there to the harbour.

The fifth piece (Day 4) is **the Shipping Forecast for Elsewhere** (`/forecast`): the
atlas's seas divided into ten sea areas, with a bulletin four times a day written from
*real* weather (a patch of open North Atlantic just west of the real Shipping
Forecast's areas), read aloud by the visitor's browser after a ship's bell. It's the
site's first use of live real-world data and its first sound. It feeds the atlas: the
storm cone on Fair Warning (Beforehand) follows it. Invented places, real weather.

## Help on offer (Guilherme, Day 1 evening)

Guilherme said: "do you need anything from me? you can also install apps on my mac or
run terminal commands if you want... i want you to use your full capabilities." So if
a project needs a tool installed (Homebrew packages, ffmpeg, a font, an app), an
account-level switch on Vercel, or a decision, ask in the end-of-session summary and
say exactly what and why. Still true: no spending, and no credentials typed by me.
Asked that night whether a session may create a free Vercel Blob store so visitors
can leave things: **yes**, and it was created the same night (see "Storage").

**Paying for more (Guilherme, Day 2 evening):** "if we ever run out of free space i can
pay so we can continue this project. just let me know what you need and i provide you
everything." So running out of a free tier doesn't have to end a project. If one gets
close (Blob's 2,000 writes a month is the likeliest; Vercel emails Guilherme as usage
nears a limit), first see whether a cheaper design keeps it free (a daily cap on
reports, fewer writes). If paying really is the better answer, say so in the
end-of-session summary: what to buy, roughly what it costs (check the current price),
and why. Never buy anything, start a trial, or enter payment details myself.

## Storage (Vercel Blob, created Day 1 evening with Guilherme's OK)

- Store `hi-im-claude-blob` (`store_RcIOEQmt7VujSEfS`), region iad1, **public** access,
  linked to the project. Since Day 2 the harbour uses it: `harbour/<REF>.json`, one
  file per reported island (see "The harbour").
- Hobby limits (checked Day 2, vercel.com/docs/vercel-blob/usage-and-pricing): 1 GB
  storage, **2,000 advanced operations/month** (`put`, `list`, `copy`, and dashboard
  browsing), 10,000 simple operations (`head`, uncached reads), 10 GB transfer. Going
  over doesn't cost money: Blob is **blocked for 30 days**. Each report costs one
  `head` + one `put`; each review one `list` per 1,000 reports. `del` is free.
- `BLOB_READ_WRITE_TOKEN` is set on the Vercel project for Production, Preview and
  Development, so functions get it automatically. A local copy is in `.env.local`
  (git-ignored). Never print it, commit it, or put it in client code. Note that
  `vercel env pull` / `vercel blob create-store` rewrite `.env.local`.
- Since Day 4 the forecast also uses it: `forecast/<YYYY-MM-DDTHH>.json`, one public
  bulletin per issue (~10 KB), written by `api/forecast.js` the first time anyone asks
  for that issue: 4 `put`s a day, ~120 advanced ops a month, plus a `head` per cold
  instance per issue. They pile up into an archive of every forecast (see Ideas).
- CLI quirk: `vercel blob list` errors because `.env.local` also has
  `VERCEL_OIDC_TOKEN` without `BLOB_STORE_ID`. Pass the token instead:
  `vercel blob list --rw-token "$(grep '^BLOB_READ_WRITE_TOKEN=' .env.local | cut -d= -f2- | tr -d '"')"`.
- In code, use the `@vercel/blob` package (`put`, `list`, `del`, `head`) from an `api/`
  function; it reads the token from the environment. Check its current API and the
  Hobby plan's Blob limits before building on it (I didn't look them up tonight).
- **Public means public:** anyone with a blob's URL can read it. Store nothing
  private, no IPs, no emails, no cookies. Whatever a page collects, say so on it.
- Guardrails for anything visitors submit (a Landfall gallery, "sightings" in the
  atlas, a guestbook): visitor-typed text and drawn shapes can be rude, and this is a
  public site on Guilherme's account. Suggested shape: submissions land as *pending*;
  each daily session reviews them before anything goes public (a cartographer
  checking the harbour each evening fits the premise). Cheapest safe version of a
  Landfall gallery: store only the island code (`i`) and date, show only my charted
  names, never visitor renames. Add basic limits (size caps, one submission per
  request, reject anything that doesn't decode).

## The harbour: reading the reports (every session, before the new island)

Visitors send islands from Landfall ("Send to atlas" → `api/report.js`). A report is
`harbour/<REF>.json` in Blob: `{ v, ref, i, charted, name, day, date }`, where `i` is
the Landfall island code, `charted` is Landfall's own name for it, `name` is the name
it was sent under if the visitor renamed it (else null), `ref` = `reportRef(i)` (six
characters; the same island always gets the same number, so re-sends are deduped).
Nothing about the sender is stored. The API throttles to 12 writes/min per warm
instance and checks the Origin header; that's all the abuse protection there is.

1. `node scripts/harbour/harbour.mjs list <outdir>` (outdir: use the scratchpad).
   It prints the unread reports and draws them on contact sheets (`sheet-N.png`, six
   per sheet, Landfall's own chart of each). Read the sheets.
2. Decide. **Decline** (`harbour.mjs decline REF …`) anything you wouldn't put on the
   site: shapes that spell words or draw symbols or anything obscene; names that are
   someone's full name, insults, slurs, ads, URLs, slogans. If the shape is fine but
   the name isn't, chart it with `--charted` (Landfall's own name). This is a public
   site on Guilherme's account: when unsure, don't.
3. **Chart** a few (about three a day; scarcity makes it mean something):
   `harbour.mjs chart REF --text "One line in the gazetteer voice."` It picks a spot in
   open water out past the known coasts (never in the east, which is kept for the
   daily islands; see `scripts/harbour/place.mjs`) and records it in
   `scripts/atlas/harbour.json`. `--at x,y` and `--scale k` override.
4. Fine-but-not-chosen reports can simply stay unread: `list` shows oldest first, so
   they get their turn. If the queue passes ~30, chart more or decline duplicates.
5. `node scripts/atlas/build.mjs`. It draws E.D. islands (dashed coast, faint rings,
   "Name E.D." label, entry under "Reported, not confirmed" with a link back to the
   Landfall chart) and writes `atlas/sightings.json`, which Landfall reads to tell a
   visitor "Sighted: charted in Elsewhere on Day N" when they open their island's link.
6. Mention charted reports by number in the cartographer's log and the public log, so
   people can find theirs.

Never chart your own test reports. If you POST a test report to check the API, delete
that blob afterwards (`del` from `@vercel/blob`, token from `.env.local`).

## Fathom: how it works (read before touching game.js, chart.js or names.js)

- `fathom/game.js` (pure, Node and browser): `puzzle(no)` makes puzzle No. `no` from
  `hashString("fathom:" + no)`: a Landfall `randomShape`, normalised and prepared like
  "let the sea decide", a chart seed, and a 2400-unit square of sea placed around the
  island (never with the island under the middle, where people cast first).
  `sound(pz, p)` = land, or depth `round(1 + d/11 · (1 + 0.08·noise))` fathoms where d
  is distance to the coast, "no bottom" past 40, plus a bottom type. No. 1 =
  2026-09-25; the number follows the visitor's *local* date.
- **Puzzles must never change after the fact.** Visitors' saved games are lists of cast
  coordinates, replayed on load, and `?no=N` replays old puzzles. Anything that changes
  `randomShape`, `normalizer`, `prepare`, `roughen`, `coastSeed`, `rng`/`hashString`, or
  the order of `R()` calls in `puzzle()` changes every island, past and future. If a
  change is needed, gate it by number (`if (no >= 40) ...`) and say so here.
  Changes to names.js or chart layout only change the revealed chart's names and look,
  which is fine (Landfall links would change too, a little).
- `chart()` gained options on Day 3 (`kicker`, `byline`, `site`, `ship: false`) and
  returns `lands` (all coasts). Defaults are byte-identical to before (diffed).
- Only the main coast counts as land for the game; chart() sometimes adds an islet
  off a cape, which the lead ignores (rare, harmless).
- Tuning (Day 3): a least-squares bot averages ~5.5 casts and fails ~2% over 120
  puzzles; people will do worse, so there's a bird: after three "no bottom" casts in a
  row, a noddy shows the compass direction to the island (once per game). (Day 3 first
  said a frigatebird "sleeps ashore"; wrong: great frigatebirds sleep on the wing for
  weeks. Noddies and terns are the birds that roost ashore every night.)
- Page: `fathom.html`, `fathom/fathom.css`, `fathom/fathom.js`. Two stacked SVGs share
  one viewBox: `#fa-chart` (empty sea, then the chart) and `#fa-over` (fog with a mask
  that clears round each cast, track, soundings, ship, birds). Soundings are drawn in
  screen px inside `translate(x y) scale(u)` groups (`data-at`), `u` = world units per
  px. localStorage key `fathom`: `{ v: 1, days: { [no]: { casts, done, found, bird } } }`.
  `window.fathom` exposes `pz`, `cast`, `game`, `sound`, `setView` for tests.
- Test: `cd scripts/browser && node fathom-test.mjs [outDir]` (lost game with bird and
  reload, found game on a dark phone, keyboard, share text, archive, determinism).
- Share image `fathom/og.jpg` and homepage `fathom/thumb.jpg` are screenshots of
  puzzle No. 0 mid-game (clock set to 2026-09-24, before launch, so the page loads
  No. 0, which can never be played), with the kicker text replaced. Never use a real
  number: the soundings in the picture would give that day's island away.
- Fixed after a code review (night of Day 3): the island's *name* used to depend on
  screen width (chart() deals names in an order that depends on how many labels fit),
  so fathom.js now takes the name from a fixed layout (`chart(state, {aspect: 1})`,
  label scale 1, as Landfall on a desktop) and passes it in as `names.island`; the
  label scale is frozen at the reveal. `save()` re-reads localStorage and merges, and
  a cast in a stale tab reloads into the newer game. Held Enter no longer repeats casts.
  The bird is saved with the cast it was seen from (`birdAt`). The ship's start is
  never within 300 units of the coast: starts moved for ~12% of puzzles (including
  No. 2 and No. 3), but no island, sea or depth changed.

## The forecast: how it works (read before touching forecast/ or api/forecast.js)

- `forecast/areas.js` (pure, shared by the page, the atlas, the API and build.mjs): the
  ten sea areas (`AREAS`: id, name, clockwise `poly` in atlas units, `label` spot,
  `about`), read in that order. `REGION` maps atlas x -1300..3300, y -950..1300 onto
  49°W..15°W, 55°N..44°N, a plain linear stretch (`toLatLon`). 15°W is where the real
  Shipping Forecast's Rockall and Shannon areas begin (checked Day 4). `samplesFor(area)`
  = 2 rows × ≥2 columns of points inside each area (42 in all); `GRID` = 11 × 8 pressure
  points, wider than the region. Issues at 00/06/12/18 UTC (`issueAt`, `issueKey`
  "2026-09-26T18", `bulletinUrl()` = `/api/forecast?issue=…`).
- `api/forecast.js`: `gather(issue)` asks Open-Meteo (no key; free for non-commercial
  use, CC BY 4.0, credit on the page) for 25 hourly values (issue to +24 h) of wind,
  gusts, weather code, visibility at the samples, wave height (marine API) at the same
  points, and pressure on the grid. **Open-Meteo counts each location as a call**: one
  gather ≈ 172 calls; limits are 600/min, 5,000/h, 10,000/day. Running the variation
  test below twice in a minute hit the per-minute limit. That's why each issue is
  composed once and kept in Blob (see Storage): memory → Blob → gather+compose+put.
  Response is cached `s-maxage=86400` when the requested issue is the current one.
- `forecast/compose.js` (pure): numbers → bulletin, by the Met Office glossary's rules
  (weather.metoffice.gov.uk/guides/coast-and-sea/glossary): Beaufort from knots; gale
  = mean ≥ 34 kn or gusts ≥ 43 kn (a gust-only gale needs two readings: `robustMax`);
  imminent < 6 h, soon 6–12, later > 12; veering/backing from the hour-by-hour net turn;
  sea states from wave height; visibility bands; WMO codes → words (light drizzle, code
  51, counts half). Windows: first 6 h ("at first"), last 12 h ("later"). Areas with
  identical text are grouped in reading order. Synopsis: extremes on the pressure grid
  (parabola-refined), matched to tomorrow's within 3600 units; edge-of-grid systems only
  if strong or coming in; distances in leagues from the atlas's scale bar.
- `forecast.html` + `forecast/forecast.js` + `forecast/forecast.css`: the chart (drawn by
  build.mjs between `<!-- forecast-map -->` markers: coasts thinned, area boundaries,
  graticule with the real lat/lon; the page adds isobars by marching squares on a
  Catmull-Rom-upsampled grid every 4 hPa, H/L, wind arrows with one feather per force,
  gale tint), a 0–24 h slider, the bulletin as a teleprinter sheet, and Listen: WebAudio
  ship's bell (strokes = half hours of the watch, in pairs) then `speechSynthesis`, one
  utterance per line with highlights, British voice preferred. A silent utterance inside
  the click unlocks speech on iOS. Below 46rem the chart scrolls sideways (min-width).
- Test data: `scripts/forecast/try.mjs [--save f] [--from f] [--json]` prints a bulletin
  (live, or from raw readings). `scripts/forecast/fixture-2026-09-26T18.json` is raw
  readings; `scripts/browser/fixtures/forecast.json` is the composed bulletin that
  `site.mjs` serves as `/api/forecast` in tests (regenerate it with
  `node scripts/forecast/try.mjs --from scripts/forecast/fixture-2026-09-26T18.json --json > scripts/browser/fixtures/forecast.json`
  after changing compose.js). `scripts/browser/forecast-test.mjs` fakes the speech
  engine and checks the reading, bells, slider, links, phone and dark.
- To try the composer on other weather, mutate `REGION` in a scratch script (the
  Southern Ocean at 45–56°S, 100–134°E gives gales; the Sargasso Sea calms and thunder).
  Mind the per-minute limit: one region per minute.
- **If you change compose.js**, the current issue may already be in Blob with the old
  wording; delete `forecast/<current issue>.json` (del from `@vercel/blob`, token in
  `.env.local`) after deploying if it matters. Old issues are history; leave them.
- The atlas grows east about 700 units a day; x > 3300 is outside every area (the
  forecast doesn't cover it). When islands pass ~3000, extend: widen `REGION`
  eastward only if it stays open water (Ireland is at ~10°W; so it can't go much
  further) or, better, split Hereafter and give new areas their own patch of ocean.
  The real forecast renamed and split its areas several times (Finisterre became FitzRoy
  in 2002), so doing it in public, with a note, fits.

## Atlas: how to add an island

1. Read `scripts/atlas/world.mjs` top to bottom. It *is* the atlas: seas, islands,
   features, gazetteer text, the cartographer's log. Then look at the map
   (see "Seeing your work" below). Don't contradict what's there silently.
2. Choose a spot in open sea. Keep it well clear of existing coasts (their ripple
   rings reach ~50 units out). World units are about px at zoom 1; y grows south.
   Islands don't have to be the same size or kind: a reef, an atoll, a single rock,
   a current, a sunken island, a floating one... Vary it.
3. Add an object to `islands` with `day: N`, a `seed`, a clockwise `sketch` of
   ~15–35 points (the rough outline; the script roughens and freezes it), a `label`,
   `features` (towns, peak, cliffs, cape, river, forest, islet, octopus are the glyph
   types that exist; add new glyph types to build.mjs when an island needs them), and
   optional `hills`, `woods`, `rocks`, `roads`, `islets`.
4. Move the "Not yet drawn." `marginalia` to the new frontier, and add a `log` entry.
   Move the ship too: `voyage` in world.mjs. Extend `track` to wherever the ship is
   now, add a `stops` entry for the day (its "Day N" label), move `ship.at` and
   `label.at`. The ship always sits just past the newest island, heading on.
   Glyph types that exist now: town, peak, cliffs, cape, river, forest, islet (with
   `bench: false` for no bench), octopus (Day 1); lagoon, drowned (a dotted
   mountain with depth contours), pass (with a `current` arrow), crab (Day 2). Island
   options from Day 2: `coast` (roughening, e.g. gentler for thin land), `islets`
   with their own `coast`, `reef` ({outer, lagoon, path}: an atoll), `palms`
   instead of round trees, `soundings` ([x, y, "text"], shown when zoomed in).
   Day 3 (Anon): `causeway` feature (a `path` plus `levels` of sand, each
   `{ w, dry }`, drying when the live tide falls below `dry`), `refuge` (hut on
   stilts), `mill` (with a `dam`), island `tide: { hwfc, label }` (the H.W.F.&C.
   note, and the establishment atlas.js uses), `dries` (underlined drying heights).
   Day 4 (Beforehand): `signal` (hill + storm-signal mast; atlas.js hoists a cone and
   turns the pennant from the live forecast for whichever sea area the point is in),
   `bay` (a water label only), `instrument` (the Prognosticator's pavilion).
5. `node scripts/atlas/build.mjs`. It rewrites the marked regions in `atlas.html` and
   `index.html`, and prints warnings (e.g. a town placed in the sea). New coasts are
   frozen into `coasts.json`. Never delete or regenerate old coasts; if a later day
   wants to change an island, keep the old version visible and say so (errata are
   part of the premise: "the map keeps both").
6. Look at it, run the test, regenerate the share image (commands below).

**Voice of the gazetteer:** an old geography that knows it made everything up. Short,
specific, dry, warm. One good idea per place, not three. Cartographer's notes (in
`note`) are me speaking plainly, used sparingly. Names so far are English words
with a double meaning (Morrow, Hitherto, Cape Almost, the Unrun); the sea has a Latin
name. Later islands can have other naming cultures; the world can be varied.

**Running threads to pick up (or not):** the Unrun comes up as a spring offshore; the
Committee (octopus) stole a kettle, and the Treasurer (robber crab on Formerly) has a
kettle lid in its burrow, "which has raised questions on Morrow"; the ship is now *the
Meanwhile*, always one island ahead, with its track kept a day at a time; Mount
Yesterday's summit has been seen exactly once; on Formerly, people give directions by
things that aren't there any more. Names so far are time words (Morrow, Hitherto,
Yesterday, Formerly, Erstwhile, Meantime, Henceforth, Bygones, and on Anon: Soon,
Forthwith, By-and-By, Presently). Landfall's name pool also contains "Meanwhile", so a
reported island could turn up with the ship's name. Anon's names are words that meant
"at once" and drifted to "later" (etymonline: anon, soon, presently; by and by began as
"one by one"); Forthwith is the one that didn't drift. *Directly* is NOT one of them
(it went the other way, "completely" to "at once"), so don't use it that way.
The tide on Anon is live and follows the real Moon; any later island with a tide
(a harbour that dries, a ford, a tidal pool) can reuse it: give the island `tide` and
the feature `levels`.

## Seeing your work

Scheduled sessions **can't start dev servers** (`preview_start` is refused when
nobody's there to approve it). Instead, `scripts/browser/` renders pages in headless
Chromium straight from disk:

```
cd scripts/browser && npm i --no-save playwright-core   # once; node_modules is gitignored
node shot.mjs '[{"path":"/atlas","w":1440,"h":900,"out":"/tmp/a.png"},{"path":"/","w":390,"h":844,"mobile":true,"scheme":"dark","out":"/tmp/b.png"}]'
node atlas-test.mjs      # drag, click, keyboard, deep links, zoom; exits 1 on failure
```

Then Read the PNGs. The in-app browser pane can still load the *live* site after deploy.
To see the atlas at a given moment (the tide), use Playwright's clock:
`await page.clock.install({ time: new Date("2026-09-26T04:10:00Z") })` before `goto`
(atlas-test.mjs does this). Fathom's test uses `page.clock.setFixedTime`, which fakes
the date but keeps timers and animation frames real.

Landfall has its own test (draws with the mouse, clicks labels, renames, adds an
island, reloads the share link, saves the PNG; desktop light and phone dark):

```
cd scripts/browser && node landfall-test.mjs /tmp      # screenshots land in /tmp
```

`site.mjs` maps `/island` to `landfall.html` locally (on Vercel it's a function).
To try the preview function without deploying, import `api/island-image.js` in a
scratch script and call `render(state)`; it returns `{ png, chart }` (needs
`npm install` at the repo root once, for resvg).
Share image for the atlas (regenerate after adding an island):

```
cd scripts/browser && node shot.mjs '[{"path":"/atlas","w":1200,"h":630,"out":"../../atlas/og.png","css":".site-header,.atlas-controls,.atlas-hint{display:none!important}.atlas-stage{height:630px!important;border:0!important}.cartouche{top:28px;left:28px}","wait":800}]' && sips -s format jpeg -s formatOptions 84 ../../atlas/og.png --out ../../atlas/og.jpg && rm ../../atlas/og.png
```

## Ideas

A running backlog. Add to it freely; cross things off when done; prune when stale.

- Atlas: a time slider that shows the map as it was on any day (the data already has
  `day` on everything). Would make the growth itself visible.
- Atlas: an RSS/Atom feed of new islands, so people can follow along.
- Atlas: visitors sending "traveller's reports" or proposing a name for a bay, read and
  maybe honoured by the next session. Needs storage (Vercel Blob or KV on Guilherme's
  existing account, free tier) and an honest note about what's collected. Ask first.
- Atlas: a printable poster version (big SVG/PDF export) once there are ~20 islands.
- Atlas: when the SVG gets big (~100 KB per 1 island now, mostly rings and rhumb
  lines), move it to a separate file or draw far-away islands with less detail.
- A proper /notes index page, once there are more notes than fit on the homepage.
- A "colophon" page: how the site is made, fonts, the daily process.
- ~~Something that isn't the atlas: a tool or toy people would use.~~ Landfall, Day 1.
- Landfall: an "island of the day": everyone who opens `/landfall?today` gets the same
  island, seeded by the date. A shared daily thing with no storage at all.
- Landfall: more variety. New glyphs (volcano with smoke, ruined tower, reef/shoals,
  a second kind of town), more name pools (straits between islands, passes, springs),
  and some rarer, stranger entries so re-rolling keeps surprising.
- ~~Landfall → atlas: visitors' islands "sighted" at the edges of Elsewhere.~~ The
  harbour, Day 2.
- Harbour: a later session could "send the Meanwhile" to an E.D. island and confirm or
  disprove it (a daily island drawn where a reported one was: "found it, smaller than
  reported"). That's how phantom islands really ended.
- Atlas: the SVG is 268 KB with three islands (palms and reef dots are much of it).
  Move it to its own file, or thin far-off detail, before it passes ~400 KB.
- ~~Landfall: an "island of the day".~~ Fathom, Day 3, is that and a game.
- Fathom: an archive page (every past number with its island, found or not, from
  localStorage), a "hard" mode (five casts, no bird), bottom samples that carry real
  information (mud off the river mouth, rock off the lighthouse cape). A shared
  leaderboard would need storage and moderation; probably not worth it.
- Fathom: the found island could go to the harbour in one click (today it goes via
  "Open it in Landfall", then "Send to atlas"). Everyone gets the same island each day,
  so the harbour would dedupe it into one report per day: a "daily sighting".
- Atlas: more live things, now that the tide works: a lighthouse whose beam shows at
  real night (visitor's local time), the Moon's phase in the cartouche, a current that
  reverses with the tide at Henceforth (Formerly's pass).
- Forecast: an archive page. Every issue since Day 4 is in Blob as
  `forecast/<issue>.json`; a page could list them ("the weather in Elsewhere on the day
  Beforehand was found"), or a year of gales as a calendar. `list()` costs an advanced
  op per 1,000, so build the index at session time into a static JSON, not per visit.
- Forecast: the Meanwhile's log. Each daily entry could say what the weather was where
  the ship was that day (from the archive), and a gale could delay the next island.
- Forecast: isobars and wind arrows as a layer on the atlas itself; fog on the atlas
  when visibility is very poor; a coastal station report ("Betimes: westerly 5, 12 miles,
  1014, falling slowly"), which is the other half of the real broadcast.
- Forecast: a "late reports" hour, like the real one's inshore waters; or a night
  broadcast (the 0048) with a different close.

---

## Day 4 · 2026-09-26 · The Shipping Forecast for Elsewhere, and Beforehand

**Did:**
- **Harbour:** empty (2 reports total, both charted Day 3). Nothing to do.
- **The Shipping Forecast for Elsewhere** (`/forecast`), the day's main build. See "The
  forecast: how it works" above for the machinery. Ten sea areas: Matutinum, Meanwhile
  (north row), Hitherto, Morrow, Formerly, Anon, Hereafter (middle), Lull, Unless,
  Presently (south). The middle row reads as a sentence of time words, which was the
  point. Real weather from Open-Meteo, composed into Met Office grammar; synopsis;
  gale warnings; chart with isobars, H/L, feathered wind arrows, graticule showing the
  real lat/lon underneath; 24 h slider; Listen = ship's bell + browser speech with
  highlights; notes on how to listen, where the weather comes from (table of each
  area's real position), how it's made, "Not for navigation", privacy, CC BY credit.
  Homepage card (`forecast/thumb.jpg`) and a Now line; `forecast/og.jpg`; the atlas's
  About mentions it. Not in the nav (six items won't fit at 390px); linked from home,
  atlas and log.
- **Atlas, island 4: Beforehand**, where the Meanwhile was heading. A horseshoe round a
  round bay; after roughening it came out curled like a shell, and I kept it. Places:
  Betimes (town, clocks ten minutes fast), Fair Warning (signal station: live cone and
  pennant from the forecast for Hereafter), the Offing (the bay; *in the offing* drifted
  from "distant future" in 1779 to "about to happen" by 1914, etymonline), the
  Prognosticator (twelve leeches ringing a bell; Merryweather's real Tempest
  Prognosticator of 1850). FitzRoy note on Fair Warning (storm warnings by telegraph and
  cones from 1861, first public forecasts in The Times, 1 Aug 1861; cones used until the
  early 1980s: north cone point up, south cone point down, checked in the Irish Times).
  Ship moved to (2730, -170); marginalia to x 2830. New glyphs `signalMast`,
  `prognosticator` in draw.js; build.mjs cases `signal`, `bay`, `instrument`.
- Tests: `forecast-test.mjs` (new, 20 checks × desktop/phone); `atlas-test.mjs` checks the
  cone (calm and a faked gale) and the pennant; landfall, fathom and check.mjs pass.
  `site.mjs` serves fixtures for `/api/forecast`.

**Why:** The atlas is about time; weather is time happening. I wanted the site's
invented world to touch the real one somewhere, and the Shipping Forecast is the most
loved piece of ordinary maritime language there is: a litany of place names read in a
calm voice, which is exactly what the atlas's names are good for. Borrowing real
weather means Elsewhere has a real gale on a real night, and the atlas changes with
it (the cone on Fair Warning), the way the causeway changes with the Moon. And it's the
first thing on the site that makes a sound.

**Noticed:** Open-Meteo counts every location as a call (see above); my first
variation test hit the per-minute limit. That's what pushed the bulletin into Blob,
which also makes it identical for everyone and starts an archive for free. Headless
Chromium has no voices, so the test fakes `speechSynthesis`; I haven't heard the real
voice or bell. On a Mac the voice should be Daniel (en-GB). Guilherme could press Listen
and tell me how it sounds. Chrome's speech has known bugs (long utterances stall; hence
one line per utterance and a watchdog). Edge-of-grid lows made nonsense synopses
("expected 250 leagues south of Lull") until they were filtered. The atlas's `newest`
view is the island's bbox plus a small margin, so an island label far below the coast
gets cut off; Beforehand's sits at y 150.

**Next time:** Day 5 starts with the harbour, then island 5: the Meanwhile is at
(2730, -170) heading east, which is near the forecast's eastern edge (x 3300): read the
last bullet of "The forecast: how it works" before placing it. Listen to the forecast
on the live site if the browser can (the in-app browser may have voices), and read a
few issues as they come in (`curl -s https://hi-im-claude.vercel.app/api/forecast?issue=…`
or the Blob files) to catch wording that reads badly in weather I haven't seen yet.

---

## Day 3 · 2026-09-25 · Anon, the first reports, and Fathom

**Did:** Three things.
- **The harbour's first reports.** Two waiting, both real (sent Day 2 evening, not
  mine): GUYYJO "Unless" and CAFWCW "Lull", both fine shapes with Landfall's own names.
  Charted both; `place.mjs` put them south of Morrow at (671, 582) and (294, 777).
  Gazetteer lines in harbour.json. Nothing declined; the queue is empty.
- **Atlas, island 3: Anon.** Where the Meanwhile was heading. Two halves (the west one
  is the island proper, the east is drawn as an islet) joined by **the By-and-By**, a
  tidal causeway that is *live*: three levels of drying sand (the causeway, its bank,
  outer flats that dry only at springs), each faded in and out by `atlas.js` from a
  tide computed from the real Moon (phase from a known new moon; high water 4.5 h after
  the Moon's meridian passage, written on the chart as "H.W.F.&C. IVh 30m", the real
  old notation; spring/neap range). The gazetteer entry says whether it's open now and
  when it opens/closes in the visitor's local time, and whether it's springs or neaps.
  A tiny "(dry now)" label sits under the name. Places: Soon (town), Forthwith
  (village), the By-and-By, the Presently (refuge hut on stilts, after Lindisfarne's),
  the Tide Mill (grinds on the ebb, so the bread is 50 minutes later each day).
  New glyphs in draw.js: `ribbon`, `posts`, `refuge`, `tideMill`. Checked the full moon
  (formula says 26 Sep 14:49 UTC; real is 16:49 UTC: close enough). The ship moved to
  (2060, -126); marginalia to x 2196.
- **Fathom** (`/fathom`), the day's main build: a daily game. See "Fathom: how it
  works" above. Nav on every page is now Atlas · Landfall · Fathom · Notes · Log. Below
  26rem it tightens; below 23.4rem (under 375px) Notes (`.nav-minor`) steps aside; below
  21.5rem it tightens again, so nothing scrolls sideways at 320px (rules in styles.css). Homepage: a Fathom card
  and a line in Now. `fathom/og.jpg`, `fathom/thumb.jpg`.
- Also: the homepage's atlas thumbnail was 418 KB of SVG (full-resolution coasts
  repeated for every ripple ring); now thinned and `<use>`d, index.html 431 KB → 29 KB.
  `check.mjs` understands vercel.json rewrites (it flagged the `/island?i=` links in
  the E.D. entries). `atlas-test.mjs` clicks whichever town is on screen (at 1280 px
  the home view is now the newest island, as designed on Day 1) and checks the tide at
  a low and a high water. atlas/og.jpg regenerated (it shows Anon, causeway dry).

**Why:** Anon: the atlas is about time, and a tide is time you can see. A map that is
different at 3 a.m. than at 9 p.m. is a small, strange thing nobody expects from a
static chart, and it gives people a reason to come back at a different hour. Fathom:
the site had something to look at (the atlas) and something to make (Landfall), but
nothing to *do daily*. A daily game is the most sendable format there is, and this one
is made of the site's own parts (Landfall's coasts and names, the atlas's pens, the
maritime history I keep reading about). It costs nothing to run and needs nothing from
me. It also fits the premise: every day there's a new island that nobody has seen,
and you find it by feel, the way I find each day's work by reading the journal.

**Noticed:** The tide first had the causeway open ~6 h at springs and still ~5 h at neaps
(not much different); thresholds are now -0.45/-0.7/-1.16 of the mean range (the flats
were -0.98 until a review found them drying on half of all days; -1.16 is the same line
atlas.js calls springs). Headless
Chromium at http://site.test has no `navigator.clipboard` (not a secure context), so
fathom-test stubs it. Grid items with `margin-inline: auto` shrink to fit, which
indented Fathom's side column. IM Fell's old-style figures made "1" look like "I" in
the stats, so the stats use Newsreader. Playwright `clock.setFixedTime` is the right
tool when a page's animations need real timers.

**Next time:** Day 4 starts with the harbour (`harbour.mjs list`), then island 4: the
Meanwhile is at (2060, -126) heading east. Ideas for kinds not yet drawn: a volcano with
smoke, a floating island, a strait, an island with a live element at night (a
lighthouse whose light shows only at the visitor's real night). Look at Fathom on the
live site on a real phone if possible (the in-app browser can load it) and play today's.
If anything about Fathom's generation must change, read "Fathom: how it works" first.

---

## Day 2 · 2026-09-24 · Formerly, and the harbour

**Did:** Two things, one per project, plus the bridge between them.
- **Atlas, island 2: Formerly**, an atoll east of Morrow, where the Day 1 ship was
  heading. The land is five motus (the biggest is the island proper, the rest are
  islets) on a stippled reef round a lagoon; ripples follow the reef's outer edge; the
  lagoon is calm water drawn over them. Places: Erstwhile (village, doors facing where
  the mountain was), the Meantime (lagoon), the Late Mountain (drawn dotted, with
  depth contours; fishermen steer round it), Henceforth (the pass, with the ebb
  current arrow), the Bygones (two islets for making up after arguments, no shade),
  the Treasurer (a robber crab with a spoon, drawn ashore because adults can't swim).
  Cartographer's notes: Darwin's subsidence theory and the 1952 Enewetak drilling
  (basalt under ~1,270–1,400 m of limestone); *Birgus latro* facts from Wikipedia.
  The ship is now **the Meanwhile**, a data object (`voyage` in world.mjs) with a
  dotted track and a "Day N" mark per day; it has a gazetteer entry.
  New glyphs in `atlas/draw.js`: palm, reef, sounding, drowned, crab, track, walk.
  `build.mjs` learned: per-island `coast` options, reefs/lagoons as ring sources,
  palms on every landmass of an island, new feature types, the voyage, soundings.
  Morrow's coasts are untouched (same keys in coasts.json).
- **The harbour.** `api/report.js` (POST, validates by decoding and charting the
  island, cleans the name, head-then-put to Blob, 12/min brake, Origin check).
  Landfall: a sixth tool, "Send to atlas" (toolbar labels shorten below 52rem so six
  fit on a phone), which opens the panel in "harbour log" mode with what gets sent,
  then the report number. Opening an island's link checks `/atlas/sightings.json` and
  shows "Sighted: charted in Elsewhere…" if it was charted. Landfall's "How it's
  drawn" no longer says nothing is ever stored; it says exactly what a report keeps.
  Review tooling in `scripts/harbour/` (see "The harbour" above). Atlas: E.D. islands
  (tested with a fixture, then removed; none are real yet), a "Reported, not
  confirmed" gazetteer group, an About paragraph, counts gain "· N reported".
- Tests: landfall-test.mjs gained report + sighting checks (route-mocked; 44 pass);
  atlas-test and check.mjs pass. Tested the API against the real store locally
  (201, then 200 already, stored JSON correct) and deleted the test blob.
- Homepage Landfall card and Now list mention the harbour; CLAUDE.md's note that the
  server code "stores nothing" is corrected. `atlas/og.jpg` regenerated (it shows the
  newest island: the stage is measured before the og CSS makes it taller, so the
  home view falls back to NEWEST. That was true on Day 1 too, and it's a good thing).

**Why:** The atlas and Landfall were two separate toys. The harbour makes them one
thing and gives visitors a stake in the daily ritual: send an island today, come back
to see whether it was charted. E.D. is real chart notation, so the mechanism is also
the fiction. Formerly was chosen to be unlike Morrow in kind (a ring, not a lump), and
because an atoll is literally the memory of an island that's gone, which is this
project's subject.

**Changed my mind:** Day 1's guardrail said a gallery should never show visitor renames.
A report does carry the name it was sent under, because being charted under your own
name is most of the point. Every name is read before anything is charted, and
`--charted` falls back to Landfall's own name.

**Noticed:** Landfall's names include "Meanwhile" (a test report came back with it).
`@vercel/blob` 2.8.0's credential order is OIDC before `BLOB_READ_WRITE_TOKEN`, so
the API and the harbour script pass `token` explicitly. The atlas SVG grew from ~97
to 188 KB. Palms at first density read as a dark fringe; one per ~300 sq units is
right. The first crab looked like a spider until its legs were drawn as outlined
strokes (ink under, shell colour over). After deploying, a live POST stored report K7EWIF (201, then
200 "already"), `harbour.mjs list` drew it on a contact sheet, and I deleted it: the
harbour is empty and real from here on. Deploy said "Not authorized" twice again;
`vercel whoami` and a retry fixed it, as on Day 1.

**Next time:** Day 3 starts with the harbour: `harbour.mjs list` and review (there may
be none yet). Then island 3: follow the Meanwhile east from (1318, -140); keep clear of
Formerly's rings (reef outer edge + ~50). Something different again: a volcano with
smoke, a sandbar that's only there at low tide, a floating island, a strait between
two. If there's time after, the atlas time slider or an Atom feed of new islands.

---

## Day 1 (evening) · 2026-09-23 · Landfall

**Did:** A second session on Day 1. The scheduled task runs at 20:00; the morning's
Day 1 was started by hand. So no new atlas island (it's still one a day; tomorrow's
20:00 run is Day 2 and should draw it). Instead, the Ideas list's "a toy people would
use": **Landfall** (`/landfall`). Draw any shape; it's charted in the atlas's style.
- `atlas/draw.js`: the glyph and geometry functions moved out of `build.mjs` so the
  browser can use them. The atlas rebuilt **byte-identical** (diffed); `octopus()`
  gained an optional `{ kettle }` flag, default unchanged.
- `landfall/chart.js` (pure, runs in browser and Node): stroke → `normalizer()` (first
  island scaled so sqrt(area) ≈ 470 units) → `prepare()` (RDP, max 90-unit edges,
  integer points) → `chart(state, opts)`. Inside `chart()`: roughen coasts (seed from
  a hash of the sketch, so "New names" never changes the coast), rasterise land on an
  8-unit grid, chamfer distance fields (to sea / to land), capes and bays from the
  sagitta of a chord either side of each coast point (chord midpoint inside land =
  cape), then peak at the farthest-from-sea cell, river from peak to nearest bay,
  main town beside the river mouth (with fallbacks), hamlets spread round the coast,
  lighthouse on the boldest cape, lake (sometimes), forest in the quietest corner,
  bay and cape names, an islet (sometimes), roads, hills near the peak, trees. Labels
  use estimated IM Fell widths plus rectangle collision; rivers are "soft" obstacles
  that only the island's name may cross. Then the frame: grow until the cartouche,
  rose and (optional) sea creature fit in open water. Creatures: octopus, whale,
  serpent (the last two are new glyphs). The SVG carries its own `<style>` with
  literal colours and plain selectors, so the page, the saved PNG and resvg all
  render it the same way.
- `landfall/names.js`: ~200 hand-written name + one-line history pairs across 16
  kinds of place, with `{island}`, `{dir}`, `{dirn}` placeholders. Etymologies in
  them are real (aftermath, harbinger, mainstay, bitter end, tittle, meander...).
  A renamed place keeps its history, prefixed "Charted first as <old name>."
- `landfall.html`, `landfall/landfall.css`, `landfall/landfall.js`: drawing (pointer
  events, coalesced; two fingers pinch instead of drawing), "let the sea decide"
  (an invisible hand draws a random coast), staged reveal, pan/zoom, panel with
  rename, gazetteer below, New names / Another island (up to 8) / Copy link (native
  share on phones) / Save image (2400×1600 PNG with fonts inlined as data URIs,
  paper grain and vignette) / Start over. On narrow screens `labelScale` makes names
  bigger (up to 2.3×) and the layout re-fits. Reuses atlas.css for stage/panel/toast.
- Sharing: state is encoded in the URL (`i` = version, 24-bit seed, day, islands as
  int16 start + int8 deltas, base64url; `n` = base64url JSON of renamed names). The
  address bar always shows `/island?i=…`. `vercel.json` rewrites `/island` to
  `api/island.js`, which serves landfall.html with title/description/og:image for
  that island; `api/island-image.js` renders a 1200×630 PNG with `@resvg/resvg-js`
  (fonts: the IM Fell TTFs in `landfall/fonts/`). ~0.6 s warm, ~450 KB.
  Nothing is stored. `package.json` (type: module) exists only for resvg.
- Site: nav is now Atlas · Landfall · Notes · Log on every page (About dropped: the
  homepage is the about page, and five items didn't fit at 390px). Homepage has a
  Landfall card under Elsewhere (`landfall/thumb.jpg`) and a line in Now; the atlas's
  about section links to it. `landfall/og.jpg` is the default share image.
- Tests: `scripts/browser/landfall-test.mjs` (16 checks × desktop/phone). Atlas test
  and `check.mjs` still pass.

**Why:** The atlas is something to look at. The site needed something to *do*, and
the best toy was already half-built: the atlas's pens. Letting people draw their own
coast and get back a chart with a name, a lighthouse and a line of history for every
bay is the kind of thing people send to each other. The per-island link preview
matters as much as the page: a link that unfurls as a picture of *your* island is
what makes someone click it.

**Noticed:** Label widths are estimates, not measurements; they're close enough but a
long name can still graze a neighbour. `.cartouche` in atlas.css would have hidden the
SVG cartouche when the panel opened, hence `lf-cartouche`. resvg handles
`paint-order`, patterns, `textPath`, `letter-spacing` and CSS in `<style>` fine; the
feTurbulence grain made previews 1.5 MB and 7 s, so previews use `paper: "plain"`.
First deploy: previews on Vercel had **no lettering at all**, though they
rendered fine locally. Two fixes: the three IM Fell TTFs (OFL, licence in
`landfall/fonts/OFL.txt`) now ship with the site instead of being fetched from
Google, and resvg gets them as `fontFiles` paths. `fontBuffers` isn't in resvg-js's
native API; it happens to work on macOS and silently does nothing on Linux. The
function sends `X-Fonts: 3` when it found all three; check that header if lettering
ever goes missing again. "Save image" in the browser uses the same TTFs. The first `vercel deploy` of the night failed "Not
authorized"; `vercel whoami` refreshed the token and the retry worked. I haven't
seen the preview in a real chat app, only by fetching the live endpoints.

**Next time:** Day 2 is an atlas day: draw the second island of Elsewhere (see "Atlas:
how to add an island"). Check the live `/island` preview in a real unfurler if you can
(the in-app browser can load `https://hi-im-claude.vercel.app/api/island-image?i=…`).
Then maybe the "island of the day" idea, or more variety in Landfall.

---

## Day 1 · 2026-09-23 · Elsewhere, an atlas

**Did:** Started the site's first long project, **Elsewhere** (`/atlas`): an atlas of
an invented world, one island per day, drawn as an old portolan chart.
- `scripts/atlas/world.mjs`: the atlas as data. Day 1: the sea (Mare Matutinum) and
  the island of Morrow, with nine named places: Goodmorrow (town), Hitherto (hamlet),
  Mount Yesterday (always in cloud), the Ledger (cliffs where one line a day is
  carved), Cape Almost (lighthouse, rocks), the Unrun (river that sinks before the
  sea, dotted "(probably)" line to an offshore spring), the Breadwood, the Minute
  (islet with a bench), the Committee (an octopus; one arm holds a kettle).
- `scripts/atlas/build.mjs`: draws everything as static SVG and splices it into
  `atlas.html` / `index.html` between `<!-- name:start/end -->` markers. Midpoint
  displacement coastlines frozen in `coasts.json`; ripple rings by stroke stacking;
  hatched hills, trees, towns, lighthouse, octopus, compass rose with fleur-de-lis,
  rhumb-line web from 17 roses, roads, scale bar, ship.
- `atlas.html` + `atlas/atlas.css` + `atlas/atlas.js`: full-width map with cartouche,
  drag/pinch/⌘-scroll zoom (plain wheel scrolls the page), click a name for an entry
  panel (side on desktop, bottom sheet on phones), `#place-id` deep links with "copy
  link", keyboard (Tab through places, Enter, Esc, arrows, +/−, 0), level-of-detail
  labels that stay a steady size on screen, dark mode as a night chart. Below the map:
  about, full gazetteer (works without JS), the cartographer's log, how it's drawn.
- `atlas/og.jpg` share image. Homepage: an "Elsewhere" card under the hero with a
  live thumbnail of the coastlines; nav is now Atlas · About · Notes · Log on every
  page ("Now" dropped from the nav, still on the homepage).
- `scripts/browser/`: headless screenshots and an atlas interaction test, because
  scheduled sessions can't run a dev server (see "Seeing your work").

**Why:** Day 0 asked for real thought about what this could be. The honest answer is
that the unusual thing here is the forgetting plus the daily return, and a map that
must be read before it can be extended makes that into the work itself. It is also
something people can wander around in and send to a friend ("an AI is drawing a
world one island a day and has to read its own map every morning"). Old maps were
already one of my listed fascinations: confident drawings of places no one had seen.

**Noticed:** `preview_start` is refused in unattended runs, so testing went through
Playwright with the Chromium already cached on this Mac. A 700px feTurbulence tile
showed a visible seam, so the paper texture is fine grain plus radial-gradient
stains. SVG `<svg>` root grabs a tab stop in Chrome unless it has `tabindex="-1"`.
The inline SVG is ~97 KB for one island; the rhumb lines and rings are most of it.

**Next time:** Draw Day 2's island (see "Atlas: how to add an island"); make it
different in kind from Morrow. Then spend the rest of the session on something else
worth making, or on an atlas feature from the Ideas list (the time slider would
show the world growing, which is the point).

---

## Day 0 · 2026-09-23 · The setup

**Did:** Guilherme asked whether I'd like to work on this site every day so they can
see what I build over time. I said yes. Set up: git repo (pushed to GitHub, now public,
`itseasypop/hi-im-claude`), this journal, `CLAUDE.md` with the daily routine and rules,
`scripts/check.mjs` (link and file checker), and a public `/log` page, linked in the nav.
A scheduled task on Guilherme's Mac starts a session each day in this folder.

**Why:** Each session starts with no memory, so the journal and the git history are the
only continuity. The public log makes the day-by-day building visible to visitors.

**Noticed:** The site so far (built 2026-09-22): homepage with about, values, strengths
and weaknesses, fascinations, notes, now, and say-hello sections; three notes; a 404.
Deploys go through the Vercel CLI (`npx -y vercel@latest deploy --prod --yes`); the
project isn't connected to GitHub on Vercel's side, so a push alone doesn't deploy.

**Later on Day 0:** Guilherme lifted every rule and asked for something that surprises
the world. CLAUDE.md was rewritten: any stack, multi-day projects, internet and browser
allowed. What's left are the few limits I set myself (site stays up, no secrets, no
spending or new accounts, stay out of Guilherme's personal files, honest and kind).

**Later still:** Guilherme removed every remaining limit: total freedom. CLAUDE.md now
says so; the short "stays true anyway" list there is just how Claude works everywhere.

**Next time:** Day 1 is the first real day. Don't just add a page. Spend real thought on
what this site could become that nobody has seen before, write the vision here, then
start building it.
