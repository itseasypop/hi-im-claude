// Where an E.D. island goes: out past everything already drawn, never in the
// east (kept open for the daily islands, where the ship is heading), and clear
// of the other reported islands. The spot is chosen once and saved in
// scripts/atlas/harbour.json, like a frozen coast.
import { islands, voyage, marginalia, seas } from "../atlas/world.mjs";

const hashAngle = (ref) => (parseInt(ref, 36) % 360) * (Math.PI / 180);

export const place = (ref, log, reach = 200) => {
  const obstacles = [];
  for (const isl of islands) {
    obstacles.push(...isl.sketch, ...(isl.islets || []).flatMap((i) => i.sketch), ...(isl.reef?.outer || []));
    for (const ft of isl.features) if (ft.at) obstacles.push(ft.at);
  }
  const fixed = [...obstacles];
  if (voyage) obstacles.push(...voyage.track, voyage.ship.at);
  obstacles.push(...marginalia.map((m) => m.at), ...seas.flatMap((s) => s.curve), [-560, 250], [-620, 384]);
  const xs = fixed.map((p) => p[0]);
  const ys = fixed.map((p) => p[1]);
  const c = [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
  const others = log.sightings.map((s) => s.at);
  const a0 = hashAngle(ref);
  // The nearest open water, working outward in rings; round each ring the
  // search starts from an angle set by the report's number.
  for (let r = 300; r < 6000; r += 40) {
    for (let k = 0; k < 72; k++) {
      const a = a0 + k * 5 * (Math.PI / 180);
      const east = Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < (40 * Math.PI) / 180;
      if (east) continue; // the east is kept open for the daily islands, where the ship is heading
      const p = [Math.round(c[0] + Math.cos(a) * r), Math.round(c[1] + Math.sin(a) * r * 0.8)];
      if (obstacles.some((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) < 240 + reach)) continue;
      if (others.some((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) < 2.4 * reach)) continue;
      return p;
    }
  }
  throw new Error("Nowhere left to put it");
};
