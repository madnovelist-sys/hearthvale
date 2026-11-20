// Petitions: when people are in trouble, they leave something at the Old Stone
// and ask. You can answer with Favor, or let life take its course.
import { log, P } from './chronicle';
import { endPlague, quenchFires } from './calamity';
import { plantFaithSeed } from './society';
import { chance, pick } from './rng';
import { DAYS_PER_YEAR, type GameState, type Person, type Petition, type PetitionKind } from './types';
import { ageOf, present, seasonIndex } from './world';

const MAX_OPEN = 3;

function add(s: GameState, kind: PetitionKind, from: Person, text: string, cost: number, days: number, target?: number) {
  if (s.petitions.some((p) => p.kind === kind && p.target === target)) return;
  s.petitions.push({ id: s.nextId.petition++, day: s.day, from: from.id, kind, target, text, cost, expires: s.day + days });
}

/** A petition still makes sense only while its trouble lasts. */
function stillNeeded(s: GameState, p: Petition): boolean {
  const t = p.target !== undefined ? s.people[p.target] : undefined;
  const from = s.people[p.from];
  if (!from?.alive || from.left) return false;
  switch (p.kind) {
    case 'heal': return !!t?.alive && !!t.sick;
    case 'return': return !!t?.alive && t.away !== undefined && !t.lost;
    case 'child': return !!t && from.spouse === t.id && !from.pregnant && !t.pregnant;
    case 'harvest': return seasonIndex(s.day) <= 2;
    case 'plague': return !!s.plague;
    case 'fire': return s.buildings.some((b) => b.burning !== undefined);
  }
}

/** Each day: troubles become prayers; answered or not, prayers lapse. */
export function petitionsDay(s: GameState) {
  s.petitions = s.petitions.filter((p) => s.day < p.expires && stillNeeded(s, p));
  if (s.petitions.length >= MAX_OPEN) return;
  const people = present(s);
  const kinOf = (t: Person) => [t.spouse, ...t.parents, ...t.children]
    .map((id) => (id === undefined ? undefined : s.people[id]))
    .filter((k): k is Person => !!k && k.alive && k.away === undefined && ageOf(s, k) >= 14);

  if (s.plague && chance(s.rng, 0.05)) {
    const from = pick(s.rng, people);
    if (from) add(s, 'plague', from, `${P(from.id)} and a crowd of frightened families came to the Stone and begged for ${s.plague.name} to end.`, 4, 30);
  }
  if (s.buildings.some((b) => b.burning !== undefined) && chance(s.rng, 0.5)) {
    const from = pick(s.rng, people);
    if (from) add(s, 'fire', from, `${P(from.id)} ran to the Stone with soot on ${from.sex === 'f' ? 'her' : 'his'} face: the fire is spreading.`, 1, 4);
  }
  if (!chance(s.rng, 0.04)) return;
  const roll = pick(s.rng, ['heal', 'return', 'child', 'harvest'] as const);
  if (roll === 'heal') {
    const sick = people.filter((p) => p.sick && p.sick.severity > 0.6 && !p.sick.plague);
    const t = sick.length ? pick(s.rng, sick) : undefined;
    const from = t ? pick(s.rng, kinOf(t)) : undefined;
    if (t && from) add(s, 'heal', from, `${P(from.id)} left a carved bird at the Stone and asked that ${P(t.id)} be spared.`, 2, 30, t.id);
  } else if (roll === 'return') {
    const away = s.people.filter((p) => p.alive && p.away !== undefined && !p.lost && s.day - (s.quests[p.away]?.departed ?? s.day) > DAYS_PER_YEAR);
    const t = away.length ? pick(s.rng, away) : undefined;
    const from = t ? pick(s.rng, kinOf(t)) : undefined;
    if (t && from) add(s, 'return', from, `${P(from.id)} asks the Stone to bring ${P(t.id)} home safely from ${s.quests[t.away!]?.place ?? 'far away'}.`, 2, 120, t.id);
  } else if (roll === 'child') {
    const couples = people.filter((p) => p.sex === 'f' && p.spouse !== undefined && !p.pregnant && ageOf(s, p) >= 22 && ageOf(s, p) <= 40
      && p.children.length === 0 && s.people[p.spouse]?.sex === 'm');
    const from = couples.length ? pick(s.rng, couples) : undefined;
    if (from) add(s, 'child', from, `${P(from.id)} and ${P(from.spouse!)} have prayed for a child for a long time. They left a little clay doll at the Stone.`, 2, 180, from.spouse);
  } else if (roll === 'harvest' && seasonIndex(s.day) <= 1 && s.stores.food < 150 * people.length / 5) {
    const farmers = people.filter((p) => p.job === 'farmer');
    const from = farmers.length ? pick(s.rng, farmers) : undefined;
    if (from) add(s, 'harvest', from, `The farmers, led by ${P(from.id)}, poured beer on the Stone and asked for a good harvest.`, 2, 160);
  }
}

export type AnswerResult = { ok: true } | { ok: false; reason: string };

/** Answer a petition with Favor. */
export function answerPetition(s: GameState, id: number): AnswerResult {
  const p = s.petitions.find((x) => x.id === id);
  if (!p || !stillNeeded(s, p)) return { ok: false, reason: 'That prayer has already passed.' };
  if (s.favor < p.cost) return { ok: false, reason: `You need ${p.cost} Favor to answer it.` };
  s.favor -= p.cost;
  s.petitions = s.petitions.filter((x) => x !== p);
  const from = s.people[p.from];
  const t = p.target !== undefined ? s.people[p.target] : undefined;
  from.mood += 20;
  from.renown += 3;
  switch (p.kind) {
    case 'heal':
      if (t?.sick) { t.sick = undefined; t.health = Math.max(t.health, 70); }
      log(s, 'petition', `${P(t!.id)}'s fever broke the morning after ${P(from.id)} went to the Stone.`, [t!.id, from.id], 4);
      break;
    case 'return': {
      const q = s.quests[t!.away!];
      if (q) { q.due = Math.min(q.due, s.day + 20); q.patron = true; }
      t!.blessedUntil = Math.max(t!.blessedUntil ?? 0, s.day + DAYS_PER_YEAR);
      log(s, 'petition', `${P(from.id)} dreamed of ${P(t!.id)} on the road home, and woke up smiling.`, [from.id, t!.id], 3);
      break;
    }
    case 'child':
      from.pregnant = { due: s.day + 270, father: t!.id };
      log(s, 'petition', `${P(from.id)} and ${P(t!.id)} were expecting a child before the season was out.`, [from.id, t!.id], 4);
      break;
    case 'harvest':
      s.flags.harvestBoost = true;
      log(s, 'petition', `The barley came up thick and early. ${P(from.id)} swore it was the beer.`, [from.id], 3);
      break;
    case 'plague':
      endPlague(s, true);
      break;
    case 'fire':
      quenchFires(s);
      break;
  }
  plantFaithSeed(s, 'hearth');
  // Believers in the Unseen Keeper grow more certain; doubters, a little less doubtful.
  for (const f of s.faiths) if (!f.gone && f.tenets.includes('hearth')) for (const x of present(s)) if (x.faith === f.id) x.mood += 3;
  return { ok: true };
}
