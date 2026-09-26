// The sea areas of Elsewhere, and where their weather comes from.
//
// Pure data and arithmetic, shared by the forecast page, the atlas,
// api/forecast.js and scripts/atlas/build.mjs. Coordinates are atlas world
// units (y grows south), the same as scripts/atlas/world.mjs.
//
// Elsewhere isn't anywhere, but a forecast has to come from somewhere. So the
// whole forecast region is laid over a stretch of open North Atlantic, just west
// of the real Shipping Forecast's western edge (15°W, where Rockall and Shannon
// stop), and every area borrows the real weather of the water beneath it. The
// mapping is a plain rectangle-to-rectangle stretch: see toLatLon.

// The forecast region, in atlas units, and the patch of real ocean it maps onto.
// 34° of longitude at about 49½°N is roughly as wide, mile for mile, as 11° of
// latitude is tall compared with the region's 4600 × 2250 units, so shapes are
// only a little squashed. Everything in it is open water (checked on Day 4:
// Newfoundland is 3½° west of the western edge, Ireland 5° east of the eastern).
export const REGION = {
  x0: -1300, x1: 3300, y0: -950, y1: 1300,
  lon0: -49, lon1: -15, lat0: 55, lat1: 44,
};

export const toLatLon = ([x, y]) => [
  REGION.lat0 + ((y - REGION.y0) / (REGION.y1 - REGION.y0)) * (REGION.lat1 - REGION.lat0),
  REGION.lon0 + ((x - REGION.x0) / (REGION.x1 - REGION.x0)) * (REGION.lon1 - REGION.lon0),
];

// Nautical miles between two atlas points, measured on the real ocean beneath.
export const realMiles = (a, b) => {
  const [la1, lo1] = toLatLon(a);
  const [la2, lo2] = toLatLon(b);
  const k = Math.cos(((la1 + la2) / 2) * (Math.PI / 180));
  return Math.hypot((lo2 - lo1) * k * 60, (la2 - la1) * 60);
};

// The atlas's own scale bar: ten leagues to 24 units, give or take.
export const leagues = (units) => (units * 10) / 24;

// Read in this order, as the real forecast reads its areas in a fixed round.
// Named after what's in them (or will be). `label` is where the name sits on
// the forecast chart; `poly` runs clockwise.
export const AREAS = [
  {
    id: "matutinum", name: "Matutinum",
    poly: [[-1300, -950], [1320, -950], [1320, -300], [480, -300], [-420, -300], [-1300, -300]],
    label: [-120, -640],
    about: "The open sea north of Morrow and Formerly, named after the Mare Matutinum, which is all of it.",
  },
  {
    id: "meanwhile", name: "Meanwhile",
    poly: [[1320, -950], [3300, -950], [3300, -300], [2200, -300], [1320, -300]],
    label: [2310, -640],
    about: "Named after the ship, which is always somewhere in it, or just past it.",
  },
  {
    id: "hitherto", name: "Hitherto",
    poly: [[-1300, -300], [-420, -300], [-420, 450], [-1300, 450]],
    label: [-860, 60],
    about: "The waters west of Morrow, named after the fishing hamlet on its west coast.",
  },
  {
    id: "morrow", name: "Morrow",
    poly: [[-420, -300], [480, -300], [480, 450], [-420, 450]],
    label: [30, 96],
    about: "The first island, and the sea around it.",
  },
  {
    id: "formerly", name: "Formerly",
    poly: [[480, -300], [1320, -300], [1320, 450], [480, 450]],
    label: [960, 262],
    about: "The atoll, its lagoon and the deep water round the reef.",
  },
  {
    id: "anon", name: "Anon",
    poly: [[1320, -300], [2200, -300], [2200, 300], [1320, 300]],
    label: [1690, 20],
    about: "Both halves of Anon, and the causeway between them when the tide allows.",
  },
  {
    id: "hereafter", name: "Hereafter",
    poly: [[2200, -300], [3300, -300], [3300, 300], [2200, 300]],
    label: [2760, 20],
    about: "The sea ahead of the ship, where the next islands will be. When enough of it has been charted, it will be divided and renamed, as real sea areas are.",
  },
  {
    id: "lull", name: "Lull",
    poly: [[-1300, 450], [-420, 450], [480, 450], [480, 1300], [-1300, 1300]],
    label: [-420, 880],
    about: "Named after the first island reported by a visitor in these waters, which lay becalmed there for a week. Lull is seldom calm.",
  },
  {
    id: "unless", name: "Unless",
    poly: [[480, 450], [1320, 450], [1320, 1300], [480, 1300]],
    label: [900, 900],
    about: "Named after the other reported island. Its existence is doubtful; its weather is not.",
  },
  {
    id: "presently", name: "Presently",
    poly: [[1320, 300], [2200, 300], [3300, 300], [3300, 1300], [1320, 1300], [1320, 450]],
    label: [2310, 800],
    about: "The deep water south of Anon, named after the refuge hut on the causeway, where people wait for the weather to change.",
  },
];

const bboxOf = (pts) => {
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
};

export const insidePoly = ([x, y], poly) => {
  let inn = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inn = !inn;
  }
  return inn;
};

// Where each area's weather is sampled: a small grid of points inside it, one
// column per ~800 units of width and two rows. The forecast for an area covers
// every one of its points over the next 24 hours, which is where ranges like
// "5 to 7" come from.
export const samplesFor = (area) => {
  const [x0, y0, x1, y1] = bboxOf(area.poly);
  const nx = Math.max(2, Math.round((x1 - x0) / 800));
  const out = [];
  for (let j = 0; j < 2; j++)
    for (let i = 0; i < nx; i++) {
      const p = [x0 + ((i + 0.5) / nx) * (x1 - x0), y0 + ((j + 0.5) / 2) * (y1 - y0)];
      if (insidePoly(p, area.poly)) out.push(p.map(Math.round));
    }
  return out;
};

// A coarser grid of pressure readings, wider than the region, for the isobars
// and the general synopsis (so a low can be found before it arrives).
export const GRID = { x0: -2300, dx: 660, nx: 11, y0: -1700, dy: 520, ny: 8 };
export const gridPoints = () => {
  const pts = [];
  for (let j = 0; j < GRID.ny; j++) for (let i = 0; i < GRID.nx; i++) pts.push([GRID.x0 + i * GRID.dx, GRID.y0 + j * GRID.dy]);
  return pts;
};

export const areaAt = (p) => AREAS.find((a) => insidePoly(p, a.poly)) || null;

// Forecasts are issued four times a day, at 0000, 0600, 1200 and 1800 UTC,
// and each covers the 24 hours from its issue.
export const ISSUE_HOURS = 6;
export const issueAt = (t = Date.now()) => {
  const step = ISSUE_HOURS * 3600e3;
  return Math.floor(t / step) * step;
};
export const issueKey = (t) => new Date(t).toISOString().slice(0, 13); // "2026-09-26T18"
export const parseIssueKey = (k) => {
  if (typeof k !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}$/.test(k)) return null;
  const t = Date.parse(k + ":00:00Z");
  return Number.isFinite(t) ? t : null;
};

// Where pages get the current bulletin. The issue in the URL makes each one
// its own cache entry, so everyone shares it until the next issue.
export const bulletinUrl = (t = Date.now()) => `/api/forecast?issue=${issueKey(issueAt(t))}`;
