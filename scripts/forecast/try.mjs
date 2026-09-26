// Fetch the current issue's weather, compose the bulletin, print it.
// Usage: node scripts/forecast/try.mjs [--save fixture.json] [--from fixture.json] [--json]
// --save keeps the raw readings so compose() can be tried again offline (--from).
import { readFileSync, writeFileSync } from "node:fs";
import { gather } from "../../api/forecast.js";
import { compose } from "../../forecast/compose.js";
import { issueAt } from "../../forecast/areas.js";

const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const from = arg("--from");
const data = from ? JSON.parse(readFileSync(from, "utf8")) : await gather(issueAt());
if (arg("--save")) writeFileSync(arg("--save"), JSON.stringify(data));
const b = compose(data);
if (process.argv.includes("--json")) { console.log(JSON.stringify(b, null, 1)); process.exit(0); }
console.log(`Issued ${b.issue}, for 24 hours.`);
if (b.warnings.length) console.log(`There are warnings of gales in ${b.warnings.map((w) => w.name).join(", ")}.`), b.warnings.forEach((w) => console.log(`  ${w.name}: ${w.text}`));
console.log(`\nGeneral synopsis at ${b.synopsis.time}: ${b.synopsis.text}\n`);
for (const g of b.groups) console.log(`${g.names.join(", ")}: ${g.wind}. ${g.sea}. ${g.weather}. ${g.visibility}.`);
