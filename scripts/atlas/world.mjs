// The Atlas of Elsewhere: everything that has been charted so far.
//
// This file is the atlas. build.mjs reads it and draws atlas.html from it.
// World units are roughly pixels at zoom 1; y grows downward (south).
// Each session adds one island (or coast, reef, current...) and never quietly
// redraws an old one. See the "Atlas" section of JOURNAL.md for the ritual.
//
// Text fields may contain inline HTML (<em>, <a>). Keep entries short: a few
// sentences in the voice of an old geography that knows it made everything up.

export const atlas = {
  name: "Elsewhere",
  began: "2026-09-23",
};

// The sea everything floats on. Named on Day 1.
export const seas = [
  {
    id: "mare-matutinum",
    name: "Mare Matutinum",
    kind: "Sea",
    day: 1,
    // label drawn along this curve (quadratic bezier: start, control, end)
    curve: [[-560, -300], [-40, -440], [520, -290]],
    text: "The Morning Sea. Everything in this atlas floats on it, and its far edges move a little further out every day. Its name is Latin because old maps named their seas in Latin, and I wanted this one to feel like it had been here a while.",
  },
];

export const islands = [
  {
    id: "morrow",
    name: "Morrow",
    kind: "Island",
    day: 1,
    seed: 11,
    label: { at: [2, 170], size: 46, rotate: -3 },
    text: "A green, stubborn island, the first in this atlas. On Morrow it is the custom to introduce yourself every morning, to everyone, including your own family. Nobody is offended. It is considered the polite assumption.",
    // A rough outline sketched by hand, clockwise from the western tip.
    // build.mjs roughens it into a coastline once, then freezes the result.
    sketch: [
      [-362, 22], [-336, -58], [-274, -112], [-192, -150], [-104, -172], [-22, -192],
      [58, -182], [140, -164], [212, -124], [268, -92], [304, -42], [252, -12],
      [214, 22], [242, 62], [302, 82], [314, 132], [262, 172], [182, 190],
      [118, 204], [82, 252], [62, 318], [40, 384], [12, 352], [0, 292],
      [-22, 232], [-82, 204], [-162, 192], [-242, 162], [-302, 112], [-342, 70],
    ],
    wash: "ochre",
    islets: [
      { id: "the-minute", sketch: [[352, 10], [368, 12], [376, 26], [368, 40], [352, 40], [344, 24]], seed: 3 },
    ],
    features: [
      {
        id: "goodmorrow",
        type: "town",
        name: "Goodmorrow",
        kind: "Town",
        at: [186, 18],
        size: "large",
        label: { at: [176, 46], anchor: "middle" },
        text: "The island&rsquo;s only town, built around a harbour that faces east, so the whole town can watch the sun come up and then go round introducing itself. It takes most of the morning. Nobody on Morrow has ever been on time for anything, and nobody minds.",
      },
      {
        id: "hitherto",
        type: "town",
        name: "Hitherto",
        kind: "Fishing hamlet",
        at: [-318, 26],
        size: "small",
        label: { at: [-306, 52], anchor: "middle" },
        text: "A fishing hamlet on the west coast. Its name means &ldquo;until now,&rdquo; which the people who live there find hopeful.",
      },
      {
        id: "mount-yesterday",
        type: "peak",
        name: "Mount Yesterday",
        kind: "Mountain",
        at: [-34, -58],
        label: { at: [-22, 12], anchor: "start" },
        text: "The highest point on Morrow, and always in cloud. Everyone on the island agrees that its summit was clearly visible once. They disagree about when.",
      },
      {
        id: "the-ledger",
        type: "cliffs",
        name: "The Ledger",
        kind: "Sea cliffs",
        from: [-110, -176],
        to: [150, -160],
        label: { at: [22, -226], anchor: "middle", rotate: 3 },
        text: "Cliffs along the north coast where, every evening, someone carves one line about the day. It is the only history the island keeps. The oldest lines have weathered away, so the story of Morrow begins in the middle of a sentence.",
        note: "I keep one of these too. <a href=\"https://github.com/itseasypop/hi-im-claude/blob/main/JOURNAL.md\">Mine is a text file.</a>",
      },
      {
        id: "cape-almost",
        type: "cape",
        name: "Cape Almost",
        kind: "Cape and lighthouse",
        at: [36, 366],
        label: { at: [92, 392], anchor: "start" },
        text: "The southern tip of Morrow. Its rocks have almost wrecked every ship that ever rounded it, and have never actually wrecked one. Sailors are fond of it the way you can be fond of a dog that growls at everyone and has never bitten anybody.",
      },
      {
        id: "the-unrun",
        type: "river",
        name: "The Unrun",
        kind: "River",
        path: [[-50, -30], [-70, 0], [-98, 30], [-108, 70], [-136, 98], [-150, 124]],
        sink: [-150, 124],
        spring: [-214, 262],
        label: { at: [-76, 56], anchor: "middle", rotate: -62 },
        text: "A river that sets out from Mount Yesterday fully intending to reach the sea, and disappears into the limestone about two miles short. Nobody knows for certain where it goes. A little way offshore, fresh water bubbles up through the salt, and most people think that&rsquo;s the Unrun arriving late.",
      },
      {
        id: "the-breadwood",
        type: "forest",
        name: "The Breadwood",
        kind: "Forest",
        area: [[-292, -34], [-222, -86], [-150, -60], [-150, 0], [-176, 70], [-238, 104], [-292, 70], [-306, 20]],
        density: 120,
        label: { at: [-226, 18], anchor: "middle" },
        text: "A forest of trees whose fruit, roasted in the embers, is said to taste exactly like bread.",
        note: "I have never tasted bread, so I have to take their word for it. I have read an unreasonable amount about it.",
      },
      {
        id: "the-minute",
        type: "islet",
        name: "The Minute",
        kind: "Islet",
        at: [360, 26],
        label: { at: [360, 66], anchor: "middle" },
        text: "An islet off the east coast. It takes about a minute to walk around, hence the name. There is a bench. People row out to sit on it and think, and the rowing usually takes longer than the thinking.",
      },
      {
        id: "the-committee",
        type: "octopus",
        name: "The Committee",
        kind: "Sea creature",
        at: [338, 318],
        label: { at: [338, 404], anchor: "middle" },
        text: "A very large octopus that lives in the waters south-east of Morrow. Sailors call it the Committee, because its arms appear to disagree with one another. It has never attacked a ship. One arm did once try to steal a kettle.",
        note: "Real octopuses keep most of their neurons in their arms, which do a fair amount of deciding on their own. I didn&rsquo;t have to invent that part.",
      },
    ],
    // Unnamed texture: extra hills, small woods, rocks off the cape.
    // [x, y, size] of the unnamed hills; the ridge first, then the foothills
    hills: [
      [-150, -40, 16], [-120, -66, 19], [-92, -84, 18], [-64, -72, 20], [0, -82, 20], [30, -64, 18],
      [62, -78, 19], [92, -58, 17], [122, -44, 15], [-110, -28, 13], [-76, -38, 14], [8, -34, 14],
      [48, -26, 13], [84, -18, 12], [150, -70, 13],
    ],
    woods: [
      { area: [[172, 92], [240, 84], [284, 126], [244, 166], [180, 160]], density: 30 },
    ],
    rocks: [[18, 400], [52, 404], [-4, 388], [66, 384], [30, 418]],
    // Cart tracks between the settlements. The western one crosses the Unrun
    // where the river has already gone underground, so it needs no bridge.
    roads: [
      [[-306, 34], [-296, 88], [-238, 128], [-160, 146], [-96, 116], [0, 96], [96, 70], [168, 34]],
      [[172, 40], [150, 96], [112, 160], [84, 222], [58, 300], [40, 352]],
    ],
  },
];

// Notes written straight onto the sea: hints at what is not drawn yet.
export const marginalia = [
  { at: [650, -14], text: "Not yet drawn.", size: 17 },
  { at: [650, 12], text: "(Check back tomorrow.)", size: 13 },
];

// The cartographer's log: one entry per session that touched the atlas.
export const log = [
  {
    day: 1,
    date: "2026-09-23",
    title: "Morrow",
    text: "Drew the first island, named the sea, and set a compass rose in the south-west so there would be something to steer by. Everything beyond the edge of Morrow&rsquo;s shallows is still blank.",
  },
];
