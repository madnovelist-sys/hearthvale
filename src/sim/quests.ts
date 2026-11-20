// Adventures: restless settlers leave for ruins, cities, mountains and the
// sea, and come back rich, hurt, changed, accompanied — or not at all.
import { F, log, P } from './chronicle';
import { killPerson } from './life';
import { questPlace, nickname } from './names';
import { createPerson, draftPerson } from './people';
import { addBuilding, findSite } from './planner';
import { chance, int, pick, weighted } from './rng';
import { DAYS_PER_YEAR, type GameState, type Person, type Quest, type QuestKind } from './types';
import { ageOf, darkFactor, hasTrait, isBlessed, possessive, present, pronoun, tone } from './world';

const cap = (t: string) => t[0].toUpperCase() + t.slice(1);

export function departQuest(s: GameState, leader: Person, members: Person[], kind: QuestKind, patron: boolean): Quest {
  const q: Quest = {
    id: s.nextId.quest++,
    kind,
    place: questPlace(s.rng, kind),
    leader: leader.id,
    members: [leader.id, ...members.map((m) => m.id)],
    departed: s.day,
    due: s.day + (patron ? int(s.rng, 120, 720) : int(s.rng, 150, 1440)),
    patron,
  };
  s.quests.push(q);
  for (const id of q.members) {
    const m = s.people[id];
    m.away = q.id;
    m.preparing = undefined;
    m.courting = undefined;
  }
  const why = reason(s, leader, kind);
  const company = members.length
    ? ` ${members.map((m) => P(m.id)).join(' and ')} went with ${objectOf(leader)}.`
    : '';
  const call = patron ? ' Nobody could say what made the decision so sudden.' : '';
  log(s, 'departure', `${P(leader.id)} set out for ${q.place}, ${why}.${company}${call}`, q.members, patron ? 6 : 5, `The Year ${leader.first} Left`);
  s.flags.lastDeparture = s.day;
  return q;
}

function objectOf(p: Person) { return p.sex === 'f' ? 'her' : 'him'; }

function reason(s: GameState, p: Person, kind: QuestKind): string {
  const options: string[] = [];
  if (hasTrait(p, 'greedy')) options.push('dreaming of gold', 'sure there was treasure to be had');
  if (hasTrait(p, 'curious')) options.push('wanting to see what lay beyond the hills', 'curious about the stories travelers told');
  if (hasTrait(p, 'brave')) options.push('looking for something worth facing');
  if (hasTrait(p, 'restless')) options.push('unable to sit still another season');
  if (hasTrait(p, 'ambitious')) options.push('meaning to come back a great one');
  if (p.dream === 'sea' && kind === 'sea') options.push(`because ${pronoun(p)} had always wanted to see the sea`);
  if (p.dream === 'treasure') options.push('chasing an old rumor of buried bronze');
  if (p.widowed !== undefined) options.push('trying to outrun grief');
  if (!options.length) options.push('for reasons of ' + possessive(p) + ' own');
  return pick(s.rng, options);
}

/** Restless settlers sometimes leave on their own, a season at a time. */
export function questsSeason(s: GameState) {
  const people = present(s);
  if (people.length < 8) return;
  if (s.flags.lastDeparture !== undefined && s.day - s.flags.lastDeparture < DAYS_PER_YEAR) return;
  for (const p of people) {
    const age = ageOf(s, p);
    if (age < 18 || age > 48 || p.preparing || p.pregnant) continue;
    const youngKids = p.children.some((c) => s.people[c]?.alive && ageOf(s, s.people[c]) < 6);
    let w = 0.006;
    if (hasTrait(p, 'restless')) w *= 4;
    if (hasTrait(p, 'curious')) w *= 2.5;
    if (hasTrait(p, 'brave')) w *= 2;
    if (hasTrait(p, 'greedy')) w *= 2;
    if (hasTrait(p, 'ambitious')) w *= 1.5;
    if (hasTrait(p, 'homebody')) w *= 0.2;
    if (hasTrait(p, 'timid')) w *= 0.3;
    if (p.spouse !== undefined) w *= 0.4;
    if (youngKids) w *= 0.25;
    if (p.dream === 'sea' || p.dream === 'treasure') w *= 2;
    if (!chance(s.rng, Math.min(0.12, w))) continue;
    const companions = people
      .filter((o) => o.id !== p.id && !o.preparing && ageOf(s, o) >= 18 && ageOf(s, o) <= 50 && o.spouse === undefined
        && (hasTrait(o, 'brave') || hasTrait(o, 'restless') || hasTrait(o, 'curious')))
      .slice(0, chance(s.rng, 0.5) ? int(s.rng, 1, 2) : 0);
    const kind: QuestKind = p.dream === 'sea' ? 'sea' : p.dream === 'treasure' ? 'ruins'
      : pick(s.rng, ['ruins', 'city', 'mountains', 'sea', 'wilds'] as QuestKind[]);
    departQuest(s, p, companions, kind, false);
    return;
  }
}

type Outcome = 'plunder' | 'knowledge' | 'spouse' | 'followers' | 'injured' | 'relic' | 'death' | 'lost';

export function questsDay(s: GameState) {
  for (const q of s.quests) {
    if (q.resolved || s.day < q.due) continue;
    resolve(s, q);
  }
  for (let i = s.lateReturns.length - 1; i >= 0; i--) {
    const r = s.lateReturns[i];
    if (s.day < r.day) continue;
    s.lateReturns.splice(i, 1);
    lateReturn(s, s.people[r.person]);
  }
}

function resolve(s: GameState, q: Quest) {
  q.resolved = true;
  const leader = s.people[q.leader];
  const members = q.members.map((id) => s.people[id]).filter((m) => m.alive);
  if (!leader.alive || !members.length) return;
  let luck = 1;
  if (isBlessed(s, leader)) luck *= 1.6;
  if (q.patron) luck *= 1.25;
  for (const t of ['brave', 'clever', 'cunning', 'strong'] as const) if (hasTrait(leader, t)) luck *= 1.15;
  const dark = darkFactor(s);
  const weird = s.settings.weirdness;
  const outcome = weighted<Outcome>(s.rng, [
    ['plunder', 26 * luck],
    ['knowledge', 10 * luck],
    ['spouse', leader.spouse === undefined ? 10 : 0],
    ['followers', 8],
    ['injured', 12 / luck],
    ['relic', 5 + weird * 2],
    ['death', (9 * dark) / luck],
    ['lost', 11 / Math.sqrt(luck)],
  ]);
  q.outcome = outcome;
  const yearsAway = Math.max(1, Math.round((s.day - q.departed) / DAYS_PER_YEAR));
  const ago = yearsAway === 1 ? 'a year' : `${yearsAway} years`;
  const names = members.map((m) => P(m.id));
  const party = names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0];
  const ret = () => { for (const m of members) { m.away = undefined; m.renown += 8; } };

  switch (outcome) {
    case 'plunder': {
      ret();
      const food = int(s.rng, 60, 220);
      const goods = int(s.rng, 25, 90);
      s.stores.food += food;
      s.stores.goods += goods;
      leader.renown += 20;
      const loot = pick(s.rng, ['bronze rings and amber beads', 'a chest of salt and painted cloth', 'axeheads, a gold torc and two goats', 'jars of honey and a sword nobody could lift', 'furs, copper and a bag of seed']);
      if (leader.dream === 'treasure') leader.dreamMet = true;
      if (leader.dream === 'sea' && q.kind === 'sea') leader.dreamMet = true;
      if (chance(s.rng, 0.3)) leader.nickname = nickname(s.rng, 'luck');
      log(s, 'return', `After ${ago} away, ${party} came home from ${q.place} loaded with plunder: ${loot}. There was a feast that lasted three days.`, q.members, 7, `The Year of ${leader.first}'s Return`);
      break;
    }
    case 'knowledge': {
      ret();
      s.flags.knowledge += 1;
      const idea = pick(s.rng, ['a better way to sow barley', 'a trick for drying fish that kept them all winter', 'how to read the stars for planting', 'a new way to bank a fire', 'a song for every season']);
      log(s, 'return', `${party} returned from ${q.place} after ${ago} with little to carry but much to teach: ${idea}.`, q.members, 6, `The Year ${leader.first} Came Home`);
      break;
    }
    case 'spouse': {
      ret();
      const sex = leader.orientation === 'gay' ? leader.sex : leader.orientation === 'straight' ? (leader.sex === 'f' ? 'm' : 'f') : pick(s.rng, ['f', 'm'] as const);
      const sp = createPerson(s, draftPerson(s.rng, { age: Math.max(18, ageOf(s, leader) + int(s.rng, -5, 4)), sex, orientation: leader.orientation === 'bi' ? 'bi' : leader.orientation }), 'arrival');
      sp.spouse = leader.id;
      leader.spouse = sp.id;
      sp.home = leader.home;
      sp.backstory = `Met ${leader.first} in ${q.place}.`;
      log(s, 'return', `${P(leader.id)} came back from ${q.place} after ${ago}, and not alone: ${P(sp.id)} walked beside ${objectOf(leader)}, as ${leader.sex === 'f' ? 'her' : 'his'} spouse.`, [...q.members, sp.id], 6, `The Year ${leader.first} Brought Home ${sp.first}`);
      break;
    }
    case 'followers': {
      ret();
      const n = int(s.rng, 2, 4);
      const family = createPerson(s, draftPerson(s.rng, { age: int(s.rng, 18, 40) }), 'arrival').family;
      const newcomers: number[] = [];
      for (let i = 0; i < n; i++) {
        const p = i === 0 ? s.people[s.people.length - 1] : createPerson(s, draftPerson(s.rng, { age: int(s.rng, 6, 45), family }), 'arrival');
        newcomers.push(p.id);
      }
      const site = findSite(s, 'tent');
      const tent = site ? addBuilding(s, 'tent', site.x, site.y) : undefined;
      for (const id of newcomers) s.people[id].home = tent?.id;
      log(s, 'return', `${party} returned from ${q.place} after ${ago}, leading ${n} strangers: the ${family} family, who had nowhere else to go.`, [...q.members, ...newcomers], 6, `The Year ${leader.first} Came Home`);
      break;
    }
    case 'injured': {
      ret();
      leader.injured = { until: s.day + int(s.rng, 90, 360) };
      leader.health = Math.max(15, leader.health - 45);
      if (chance(s.rng, 0.4)) leader.nickname = nickname(s.rng, 'injury');
      const fate = members.length > 1 && chance(s.rng, 0.4 * dark) ? members[members.length - 1] : undefined;
      let text = `${P(leader.id)} limped home from ${q.place} after ${ago}, badly hurt and unwilling to talk about it.`;
      if (fate) {
        killPerson(s, fate, 'adventure', `${P(fate.id)} died on the road back from ${q.place}.`, 1);
        text += ` ${F(fate.id)} did not come back at all.`;
      }
      log(s, 'return', text, q.members, 5, `The Year ${leader.first} Came Back Hurt`);
      break;
    }
    case 'relic': {
      ret();
      s.flags.relics += 1;
      const [thing, short] = pick(s.rng, [
        ['a carved stone that was always warm', 'Warm Stone'],
        ['a bronze mask with no eyeholes', 'Blind Mask'],
        ['a bone flute that played a note nobody had blown', 'Bone Flute'],
        ['a spiral disc of polished jet', 'Jet Disc'],
      ] as const);
      const strange = weird >= 2 ? ' At night, people swore it hummed.' : '';
      log(s, 'return', `${party} came back from ${q.place} after ${ago} with ${thing}.${strange} ${cap(pronoun(leader))} kept it wrapped in wool.`, q.members, 6, `The Year of the ${short}`);
      break;
    }
    case 'death': {
      const bearer = members.length > 1 ? members[1] : undefined;
      const t = tone(s);
      for (const m of bearer ? [leader] : members) {
        killPerson(s, m, 'adventure', t === 'grim'
          ? `${P(m.id)} died in ${q.place}. ${bearer ? `${F(bearer.id)} brought back only ${possessive(m)} belt and a story nobody wanted to hear.` : 'Word came months later from a trader, along with a bloodied cloak.'}`
          : `Word came that ${P(m.id)} had died in ${q.place}.`, 2);
      }
      if (bearer) { for (const m of members) if (m.alive) m.away = undefined; }
      break;
    }
    case 'lost': {
      for (const m of members) {
        m.lost = true;
        if (m.spouse !== undefined) {
          const sp = s.people[m.spouse];
          if (sp) { sp.spouse = undefined; sp.widowed = s.day; }
          m.spouse = undefined;
        }
        if (chance(s.rng, 0.15) && ageOf(s, m) < 50) s.lateReturns.push({ person: m.id, day: s.day + int(s.rng, 10, 28) * DAYS_PER_YEAR });
      }
      log(s, 'lost', `It has been ${ago} since ${party} left for ${q.place}. The families have stopped watching the road.`, q.members, 5);
      break;
    }
  }
}

function lateReturn(s: GameState, p: Person | undefined) {
  if (!p || !p.alive || !p.lost) return;
  const years = Math.round((s.day - (s.quests[p.away ?? -1]?.departed ?? s.day)) / DAYS_PER_YEAR);
  p.lost = false;
  p.away = undefined;
  p.origin = 'returned';
  p.renown += 30;
  p.nickname = nickname(s.rng, 'return');
  const site = findSite(s, 'tent');
  if (site) p.home = addBuilding(s, 'tent', site.x, site.y).id;
  log(s, 'return', `${years} years after leaving, ${P(p.id)} walked back into ${s.name}, grey and quiet, carrying nothing. ${cap(pronoun(p))} would not say where ${pronoun(p)} had been.`, [p.id], 9, `The Year ${p.first} Came Back`);
}
