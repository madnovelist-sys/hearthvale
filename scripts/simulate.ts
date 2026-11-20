// Headless run for tuning: simulate N focus hours with a Spark every 20
// minutes (one arrival party welcomed each time) and print a census per year.
//   npm run simulate -- [hours] [seed] [darkness]
import { makeArrivalOptions, settleParty } from '../src/sim/arrivals';
import { foundSettlement, stepDay } from '../src/sim/sim';
import { DAYS_PER_YEAR } from '../src/sim/types';
import { population } from '../src/sim/world';
import { resolveText } from '../src/sim/text';

const hours = Number(process.argv[2] ?? 40);
const seed = Number(process.argv[3] ?? 12345);
const darkness = Number(process.argv[4] ?? 50);
const s = foundSettlement({ seed, name: 'Testbrook', settings: { darkness, weirdness: 1 } });
const daysPerSpark = (20 / 60) * DAYS_PER_YEAR;
let nextSpark = daysPerSpark;
const t0 = Date.now();
for (let day = 0; day < hours * DAYS_PER_YEAR; day++) {
  stepDay(s);
  if (s.day >= nextSpark) {
    nextSpark += daysPerSpark;
    const options = makeArrivalOptions(s);
    settleParty(s, options[day % 3]);
  }
  if (s.day % DAYS_PER_YEAR === 0) {
    const year = s.day / DAYS_PER_YEAR;
    const alive = s.people.filter((p) => p.alive);
    const buildings = s.buildings.filter((b) => !b.removed);
    const homes = buildings.filter((b) => ['tent', 'hut', 'house'].includes(b.kind) && b.built).length;
    if (year % 5 === 0 || year <= 3) {
      console.log(
        `Y${String(year).padStart(3)} pop ${String(population(s)).padStart(4)} (alive ${alive.length}) ` +
        `food ${Math.round(s.stores.food)} wood ${Math.round(s.stores.wood)} goods ${Math.round(s.stores.goods)} ` +
        `homes ${homes} bld ${buildings.length} stage ${s.stage} | ${s.yearNames[year]}`,
      );
    }
  }
}
const deaths = s.people.filter((p) => !p.alive);
const causes: Record<string, number> = {};
for (const p of deaths) causes[p.cause ?? '?'] = (causes[p.cause ?? '?'] ?? 0) + 1;
console.log('\nDeaths by cause', causes);
const kinds: Record<string, number> = {};
for (const e of s.chronicle) kinds[e.kind] = (kinds[e.kind] ?? 0) + 1;
console.log('Chronicle entries', kinds);
console.log(`Simulated ${hours} years in ${Date.now() - t0} ms`);
console.log('\nSample of the Chronicle:');
for (const e of s.chronicle.filter((e) => e.weight >= 5).slice(0, 25)) {
  console.log(`  [Y${Math.floor(e.day / DAYS_PER_YEAR) + 1}] ${resolveText(s, e.text)}`);
}
