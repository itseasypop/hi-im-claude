// Names and short histories for Landfall's islands.
//
// Every place gets a name and one line of history from these lists, picked with
// the chart's seed so the same drawing always gets the same names. Written by
// hand, in the voice of the Elsewhere gazetteer: an old geography that knows it
// made everything up. One idea per place.
//
// Placeholders, filled in when the chart is drawn:
//   {island}  the island's name (as renamed by the visitor, if they did)
//   {dir}     compass side of the island the place is on: "north", "south-east"...
//   {dirn}    the same as an adjective: "northern", "south-eastern"...
//
// Etymologies mentioned here are real. Everything else is invented.

export const islands = [
  ["Tarry", "An island where nobody hurries, mostly because the ferry leaves when it feels ready. Visitors complain for about a week and then stop checking the time."],
  ["Whither", "Named by its first settlers, who were asking a question. They stayed, which seems to have been the answer."],
  ["Lesser Certainty", "Nobody has ever found Greater Certainty, though several expeditions have set out quite sure of where it was."],
  ["Nevermind", "Sighted many times by sailors who then decided not to bother. The first person to land found it already inhabited, by people who had also nearly not bothered."],
  ["Aftermath", "The name is older than its gloomy meaning: an aftermath was once the second crop of grass after a mowing. The island grows very little else, and grows it twice."],
  ["Wherewithal", "It has everything you need and very little you want, which the islanders consider the right way round."],
  ["Meanwhile", "Everything that happens elsewhere happens here too, the islanders say, only a little later and more quietly."],
  ["Anon", "Its name is an old word for “soon,” and the islanders have been meaning to live up to it for several centuries."],
  ["Erstwhile", "The islanders say it was once much larger, and will show you all the places where it used to be."],
  ["Betimes", "An island of early risers. The bakers start at three. The roosters, who gave up competing long ago, start at nine."],
  ["Otherwise", "The island that would have been here if things had gone differently. Things did go differently. It is here anyway."],
  ["Umbrage", "Its name comes from an old word for shade, which the island has plenty of, and takes at the slightest thing."],
  ["Lull", "The wind drops as you approach, for no reason anyone has found. Sailing ships have to row the last mile, which the islanders find very funny."],
  ["Tidings", "News arrives here late and is received with ceremony, even when it is about the weather last spring."],
  ["Dwindle", "Every survey finds it a little smaller than the last one did. The islanders suspect the surveyors."],
  ["Nonesuch", "Its name means “without equal.” The islanders chose it themselves, know exactly how it sounds, and don’t mind."],
  ["Unless", "An island of conditions. Every law on Unless has an exception, and every exception has a law."],
  ["Sundry", "A bit of everything: a hill, a harbour, a wood, a rumour. The islanders describe it as “various,” with pride."],
  ["Brink", "Always on the edge of something. Last year it was a festival. The year before, a war with a neighbouring island that turned out not to exist."],
  ["Hark", "Named for the first word anyone said on landing. Nobody remembers what they heard."],
];

// Second and later islands in the same drawing: smaller, and usually named in
// relation to the first.
export const isles = [
  ["The Aside", "It sits off {island} as if it had just remembered something."],
  ["Postscript", "Added later, as if the sea had one more thing to say."],
  ["Footnote", "Hardly anyone goes there, but it explains a great deal."],
  ["The Spare", "Kept in case {island} is ever mislaid."],
  ["The Understudy", "It has learned all of {island}’s lines, just in case."],
  ["Ditto", "People keep saying it looks like a smaller {island}, and it has started to believe them."],
  ["The Offcut", "Broken off {island}, the islanders say, when the world was being cut out."],
  ["Ahem", "The surf on its reef sounds exactly like someone about to say something."],
  ["Encore", "The sea brought it back after everyone thought it had gone."],
  ["Sidelong", "Seen best out of the corner of your eye, and hardly at all if you look straight at it."],
  ["Lesser Maybe", "Nobody has ever been sure it was there. There is a Greater Maybe, too, somewhere."],
  ["The Echo", "Anything said loudly on {island} can be heard here a moment later, slightly worse."],
];

export const towns = [
  ["Harbinger", "A harbour town. A harbinger was once someone sent ahead to find lodgings, and the town is still very good at finding you somewhere to stay."],
  ["Makeshift", "The harbour town, thrown up in a hurry three hundred years ago by people who meant to replace it with something better."],
  ["Staywell", "The main town. Its name began as a goodbye and turned into an address."],
  ["Portent", "A harbour town where the arrival of every ship is taken as a sign. It is usually a sign that a ship has arrived."],
  ["Bide", "A harbour town on the {dir} coast, built by people waiting for a ship. It came, eventually. By then they had built a town."],
  ["Lantern", "A harbour town with a lamp in every window that faces the sea, in case anyone is out there. Usually someone is."],
  ["Mainstay", "The island’s main town. A mainstay is the rope that keeps a ship’s mainmast standing, and the town takes that as a job description."],
  ["Newcome", "Every generation calls it the new town. It is about six hundred years old."],
  ["Overmorrow", "A harbour town whose name is an old word for “the day after tomorrow,” which is when most things there get done."],
  ["Sounding", "A sounding is a measurement of depth, and ships take them all the way into this harbour. Everyone in town knows exactly how deep things are."],
  ["Plenty", "The largest town on {island}, which isn’t saying much, and the richest, which is saying less."],
  ["Welcombe", "The main town, where every visitor is met at the quay by someone who has been waiting all morning to ask where they’re from."],
  ["Hearsay", "The harbour town and the island’s only source of news. None of it is reliable, and all of it is interesting."],
  ["Kindling", "A town of woodcutters and gossip, both of which catch quickly."],
];

export const hamlets = [
  ["Ebb", "A fishing hamlet that is twice as big at low tide."],
  ["Nook", "A few houses in a fold of the {dir} coast, facing the sea as if waiting to be asked something."],
  ["Scant", "Three houses, two boats, and a dog that behaves as if it owns all five."],
  ["Drift", "A fishing village built almost entirely from things the sea brought. Now and then the sea comes back for them."],
  ["Idle", "The fish are caught before breakfast. The rest of the day is spent discussing them."],
  ["Wend", "A hamlet at the end of a road that takes its time getting there."],
  ["Tether", "The boats here are tied up with more knots than strictly necessary. Nobody has ever lost one."],
  ["Lowly", "A very small village that is very proud of it."],
  ["Wick", "A dozen houses round a single lamp, kept lit all night for a reason nobody remembers, and never allowed to go out."],
  ["Lee", "Built on the sheltered side of everything: the hill, the harbour wall, and most arguments."],
  ["Seldom", "A hamlet that seldom gets visitors, and has drawn up a great many rules about what to do if one arrives."],
  ["Hush", "The nets here are mended in silence, by long custom. Nobody remembers why. Everyone agrees it’s nice."],
  ["Pinch", "A hamlet so small that the road runs through the middle of somebody’s kitchen."],
  ["Moot", "A hamlet with one of the oldest meeting houses on {island}, where the question of whether to build a second house has been under discussion for four hundred years."],
  ["Mayhap", "A fishing village that answers every question with “maybe.” Its fishermen are the best forecasters on the coast."],
  ["Salting", "A hamlet of fish-curers. You can smell it from the sea, and the sailors say that’s how they know they’re home."],
];

export const peaks = [
  ["Mount Hindsight", "From the summit you can see every path you could have taken up it."],
  ["Mount Eventually", "The highest point on {island}. Most climbers get there."],
  ["Mount Reckon", "Its height has been measured nine times, with nine results. The islanders use the average and call it a reckoning."],
  ["Mount Pardon", "Named for the first thing everyone says at the top, where the wind is so loud that nobody has ever heard anyone else."],
  ["Mount Heed", "Cloud gathers on its summit about an hour before rain, and the whole island plans its washing accordingly."],
  ["Old Grudge", "The island’s villages have argued over this mountain for so long that nobody remembers who wanted it."],
  ["Mount Umpteen", "It has more foothills than anyone has managed to count. People have tried. They keep finding another."],
  ["Mount Overlook", "From the top you can see the whole of {island}, and on the way up it’s easy to miss things."],
  ["The Sulk", "A mountain that keeps a small cloud over its head in all weathers."],
  ["Mount Allbut", "It is all but impossible to climb, which on {island} means somebody climbs it most Sundays."],
  ["The Brow", "A great bare hill that seems, from the harbour, to be frowning. The islanders say it’s concentrating."],
  ["Mount Presently", "Its shadow reaches the harbour at noon in winter, when the whole town stops for a moment and says, “There it is.”"],
];

export const rivers = [
  ["The Dither", "A river that can’t decide which way to go, and ends up going most of them."],
  ["The Linger", "It takes twice as long to reach the sea as it needs to, and seems to be enjoying the view."],
  ["The Mend", "People leave broken things on its banks overnight. Most are still broken in the morning. Some are not, and those are the ones people talk about."],
  ["The Blether", "The name is a Scots word for talking at length about nothing, and you can hear this river from the road, the town, and most of the bedrooms."],
  ["The Truant", "It leaves the hills every spring without permission and comes home in autumn looking pleased with itself."],
  ["The Sidle", "It approaches the sea sideways, as if it hadn’t really meant to."],
  ["The Fret", "A river that worries at its banks all year and floods about once a century, always the year everyone stopped worrying."],
  ["The Gist", "Short, and to the point."],
  ["The Errand", "Always hurrying somewhere on someone else’s behalf, and arriving at the sea looking harried."],
  ["The Meander", "Named after a real river in Anatolia, the Maeander, whose bends gave the world the word. This one does its best."],
  ["The Sooner", "The islanders say it would rather be the sea, and is getting there as fast as it can."],
  ["The Brook-No-Argument", "A small, fast, very straight river. It goes where it’s going."],
];

export const forests = [
  ["The Hushwood", "A forest so quiet that you can hear the moss growing, or so the islanders say, and it would be rude to check."],
  ["The Whilewood", "People go in for a while. A while, on {island}, is measured in afternoons."],
  ["The Lostwood", "Everyone who goes in comes out again, though not always where they went in."],
  ["The Keepsake", "Every tree here was planted by someone for someone. Most of the names carved on them have grown too high to read."],
  ["The Gloaming", "A forest where it is always the hour before dark. Lanterns are sold at both edges."],
  ["The Murmur", "The trees here sound like a crowd that has just stopped talking about you."],
  ["The Shilly-Shally", "Its edge moves a few yards every year, and cannot decide in which direction."],
  ["The Loan", "The islanders say the forest is only borrowed, and every tree they cut is paid back with two."],
  ["The Kindred", "Every tree here grew from one tree, which is either the oldest thing on {island} or a rumour."],
  ["The Longago", "A forest of very old trees, which the islanders address politely and never by their first names."],
  ["The Understorey", "A forest so dense that the sun reaches the ground on one day a year. There’s a small festival."],
  ["The Mislaid", "Where things go on {island} when nobody can find them. Gloves, mostly. One wedding ring. A goat, twice."],
];

// Capes with a lighthouse (one per island, on the most prominent point).
export const lights = [
  ["Cape Regardless", "Its light burns in fog, in storms and in broad daylight, regardless."],
  ["Cape Nearly", "Ships rounding it are nearly home, which is the most dangerous time to stop paying attention."],
  ["Cape Vigil", "The keeper here hasn’t missed a night in forty years, and worries that this is the only thing anyone knows about them."],
  ["Cape Nevertheless", "Built on rocks that should have made a lighthouse impossible. There is a lighthouse."],
  ["Cape Wink", "The light flashes once every nine seconds, which from the sea looks exactly like a wink. Sailors wink back. It’s considered lucky."],
  ["Cape Insist", "Its lighthouse was built by a keeper who insisted. The council refused four times. The lighthouse has now outlasted the council."],
  ["Cape Here", "The light says only one thing, all night, every night: here. Here. Here."],
  ["Cape Kindly", "The lighthouse keeper leaves a lamp in the kitchen window too, for anyone who comes ashore cold."],
  ["Cape Steady", "The light turns so evenly that the fishermen set their watches by it, and their watches are better for it."],
  ["Cape Awake", "The lighthouse at the {dirn} tip of {island}. Somebody here is always awake, and has been for two hundred years, in shifts."],
];

// Capes and points without a light.
export const capes = [
  ["Cape Anyway", "Named by a sailor who was told not to go round it."],
  ["Point Taken", "Named after an argument that ended here."],
  ["Cape Perhaps", "No two charts agree about how far it sticks out, this one included."],
  ["The Nudge", "A small cape that leans into the current and sends passing ships, gently, in the right direction."],
  ["Point Blank", "A headland of white cliffs, entirely without features. Painters find it restful."],
  ["Cape Sudden", "It appears very abruptly out of fog, and has an unfair reputation because of it."],
  ["Bitter End", "The bitter end is the last bit of an anchor rope, the part tied to the ship. Out here, at the {dirn} end of {island}, it feels like that."],
  ["Wit’s End", "As far as you can go on {island}. People come here to think when they’ve run out of other places."],
  ["Cape Tiptoe", "A narrow point that the sea has nearly worn through. People walk out to the end of it very carefully."],
  ["The Elbow", "The coast bends here as if it were leaning on something."],
  ["Cape Unless", "Ships can round it safely in any weather, unless."],
  ["Cape Sometimes", "At the highest tides it becomes an island, and at the lowest it becomes a much larger cape. It has not settled on a size."],
  ["Point Forgot", "The last place on {island} to be named. The surveyors had gone home and had to come back."],
  ["Cape Fathom", "The water falls away to a great depth just off this point. Old sailors say you can fathom anything here except why."],
];

export const bays = [
  ["Bay of Second Thoughts", "Ships anchor here for the night and often leave in the morning in a different direction."],
  ["Idle Bay", "Calm water and warm sand. Nothing has ever happened here, and it is hoped that nothing will."],
  ["The Pocket", "A small round bay where things tend to turn up: bottles, boats, lost hats, once a piano."],
  ["Sorry Bay", "Named by a captain who ran aground here and apologised to the island."],
  ["Loiter Bay", "Fish loiter here in great numbers, and so, as a result, do fishermen."],
  ["Bay of Small Hours", "The fishing boats go out from here at three in the morning with lanterns, so that from the hills it looks like a second, smaller sky."],
  ["Patience Bay", "At low tide the sea goes out a very long way and takes its time coming back."],
  ["Bay of Nothing Much", "A bay of great beauty in which nothing much happens. The islanders consider this its main attraction."],
  ["Whereabouts Bay", "Easy to find on a chart, hard to find in fog, and impossible to find when you are looking for it."],
  ["Kettle Bay", "So round and sheltered that it warms right through in summer, and steams a little in the mornings."],
  ["Bay of Good Intentions", "Several harbours have been planned here."],
  ["Tuesday Bay", "Named on a Tuesday by someone who couldn’t think of anything else."],
  ["The Crook", "A bay shaped like a shepherd’s crook, which may be why sheep keep wandering into it."],
  ["Bay of Asking", "Sailors becalmed here have always asked the sea for wind. The sea has always, eventually, said yes."],
  ["Mild Bay", "The {dirn} bay, where even the storms arrive apologetically."],
  ["Bay of Returns", "Everything thrown into this bay washes up again within the week, including several things people had hoped not to see again."],
];

export const islets = [
  ["The Full Stop", "A round rock off the point. {island} ends here, definitely."],
  ["The Comma", "A small curved islet. Pause here."],
  ["Button", "A round islet with a single tree, like a button that has come loose from {island} and not quite fallen off."],
  ["The Stray", "It looks as though it wandered off from {island} and couldn’t find its way back."],
  ["Tittle", "The tittle is the dot over an i, which is what this islet looks like from the hills, and about as big."],
  ["Hermit Rock", "Home to one goat, which is thought to prefer it that way."],
  ["The Sentry", "A rock standing off the coast as if keeping watch. The seabirds take turns on it, in shifts."],
  ["The Doorstep", "A flat rock where boats land first, to knock, before going on to {island}."],
  ["The Apostrophe", "Something is missing here, and this islet marks the spot."],
  ["Crumb", "Too small for a house, just big enough for a picnic, if nobody moves."],
];

export const lakes = [
  ["The Puddle", "A large lake that the islanders insist on calling the Puddle, to stop it getting ideas."],
  ["Stillwater", "So still that the islanders use it to check whether they are standing up straight."],
  ["Lake Seldom", "It only fills in wet years. In dry ones, people picnic on the bottom."],
  ["The Reflection", "The lake is said to show you as you’ll be in twenty years. Most people are relieved."],
  ["Lake Doubt", "Nobody has found the bottom. Some doubt that there is one."],
  ["The Small Wishes", "Coins are thrown in for small wishes only: a dry Tuesday, a found glove. It has an excellent record."],
  ["The Blink", "From the mountain it looks like an eye, and it seems to close in fog."],
  ["The Sip", "The smallest lake on {island}. Some call it a pond. It disagrees."],
];

// Seas are named in Latin, like the Mare Matutinum in the atlas.
export const seas = [
  ["Mare Vespertinum", "The Evening Sea. It is always a little later here than wherever you just came from."],
  ["Mare Oblivionis", "The Sea of Forgetting. Ships that cross it arrive a little lighter, having left something behind. Nobody can say what."],
  ["Mare Parvum", "The Small Sea. It is not small. Whoever named it had seen a bigger one."],
  ["Mare Serotinum", "The Late Sea. Its tides come in about an hour after the almanac says they will, and apologise to no one."],
  ["Mare Ignotum", "The Unknown Sea. Slightly less unknown now that someone has drawn an island in it."],
  ["Mare Placidum", "The Calm Sea, named on a calm day. There hasn’t been another."],
  ["Mare Longinquum", "The Faraway Sea. It is far away from wherever you are, even when you are on it."],
  ["Mare Crastinum", "Tomorrow’s Sea. It is always on the horizon."],
  ["Mare Mirabile", "The Wonderful Sea, according to the sailors who named it, who had been at sea for a very long time."],
  ["Mare Pigrum", "The Idle Sea. Its waves come in so slowly that you can walk out to meet them."],
];

export const octopuses = [
  ["The Quorum", "A great octopus. Nothing can be decided in its waters unless at least five of its arms agree, and they rarely do."],
  ["The Borrower", "An octopus that takes small things from passing boats (a spoon, a hat, a compass) and returns them, polished, some weeks later."],
  ["The Old Hand", "A very old octopus, said to be good at knots. Sailors in trouble with a rope have been known to ask it."],
  ["The Deliberation", "A large octopus that has been making up its mind about the island for as long as anyone can remember."],
];

export const whales = [
  ["The Long Sigh", "A whale that surfaces off {island} every evening and breathes out so slowly that the fishermen stop to listen."],
  ["Old Patience", "A whale seen in these waters since before anyone kept records. It seems to be waiting for something. Nothing so far has been worth it."],
  ["The Weather", "A whale so large that the fishermen used to mistake its spout for rain."],
  ["The Hymn", "Its song comes up through the hulls of boats at night. Nobody sleeps through it, and nobody wants to."],
];

export const serpents = [
  ["The Rumour", "A sea serpent, drawn here from a description. The description came from a sailor. The sailor had been at sea for some time."],
  ["The Long Way Round", "A sea serpent so long that nobody has seen both ends of it on the same day."],
  ["The Aunt", "A sea serpent the islanders speak of fondly, the way you might of a relative who visits a little too often."],
  ["The Coil", "It has never sunk a ship. It likes to wrap itself once round a passing boat, gently, and let go."],
];
