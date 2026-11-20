// Newcomers. Each Spark brings three parties to the road; the player welcomes
// one at their next break, or the settlement takes one in on its own.
import { F, log, P } from './chronicle';
import { familyName } from './names';
import { createPerson, draftPerson } from './people';
import { addBuilding, findSite } from './planner';
import { chance, int, pick, weighted } from './rng';
import { makeItem } from './items';
import { hasLaw } from './society';
import type { GameState, Party, PersonDraft } from './types';

type PartyShape = 'single' | 'couple' | 'family' | 'siblings' | 'elder';

export function makeParty(s: GameState): Party {
  const r = s.rng;
  const village = s.stage !== 'settlement';
  const shape = weighted<PartyShape>(r, [
    ['single', village ? 34 : 56],
    ['couple', village ? 30 : 30],
    ['family', village ? 22 : 6],
    ['siblings', village ? 9 : 5],
    ['elder', village ? 5 : 3],
  ]);
  const family = familyName(r);
  const people: PersonDraft[] = [];
  let story = '';
  switch (shape) {
    case 'single': {
      const p = draftPerson(r, { age: int(r, 17, 45) });
      people.push(p);
      const job = p.skill;
      story = pick(r, [
        `${p.first} walked out of the hills with nothing but a ${pick(r, ['bedroll', 'bone knife', 'sack of seed', 'cooking pot'])}.`,
        `${p.first}, a ${job}, left a crowded valley to the south looking for room to breathe.`,
        `${p.first} saw the smoke from your fire three days' walk away and followed it.`,
        `${p.first} heard about the settlement from a trader and came to see for ${p.sex === 'f' ? 'herself' : 'himself'}.`,
        p.traits.includes('cunning') || p.traits.includes('greedy')
          ? `${p.first} is running from a debt, or so the rumor goes.`
          : `${p.first} buried a spouse last winter and wanted to start again somewhere new.`,
      ]);
      break;
    }
    case 'couple': {
      const a = draftPerson(r, { age: int(r, 18, 40), family, orientation: 'straight' });
      const sameSex = int(r, 0, 99) < 8;
      const b = draftPerson(r, {
        age: Math.max(17, a.age + int(r, -6, 6)),
        family,
        sex: sameSex ? a.sex : a.sex === 'f' ? 'm' : 'f',
        orientation: sameSex ? 'gay' : 'straight',
        spouseOf: 0,
      });
      if (sameSex) a.orientation = 'gay';
      a.spouseOf = 1;
      people.push(a, b);
      story = pick(r, [
        `${a.first} and ${b.first}, newly wed, came looking for land of their own.`,
        `${a.first} and ${b.first} ran away from a village upriver, where their families would not bless the match.`,
        `${a.first} and ${b.first} lost their home to a flood and walked until they saw your fire.`,
      ]);
      break;
    }
    case 'family': {
      const a = draftPerson(r, { age: int(r, 24, 40), family, sex: 'f', orientation: 'straight', spouseOf: 1 });
      const b = draftPerson(r, { age: Math.max(20, a.age + int(r, -4, 6)), family, sex: 'm', orientation: 'straight', spouseOf: 0 });
      people.push(a, b);
      const kids = village ? int(r, 1, 3) : 1;
      for (let i = 0; i < kids; i++) people.push(draftPerson(r, { age: int(r, 1, Math.min(14, a.age - 17)), family, parentsIdx: [0, 1] }));
      story = pick(r, [
        `The ${family} family, driven out of the lowlands by floods, with ${kids === 1 ? 'one child' : `${kids} children`} and a goat.`,
        `The ${family}s, whose old village was raided last spring.`,
        `The ${family} family, who heard the soil here was good and the people were kind.`,
      ]);
      break;
    }
    case 'siblings': {
      const n = int(r, 2, 3);
      for (let i = 0; i < n; i++) people.push(draftPerson(r, { age: int(r, 14, 26), family }));
      story = `${n === 2 ? 'Two' : 'Three'} ${family} siblings, ${people.map((p) => p.first).join(' and ')}, orphaned by a fever and looking for a place to belong.`;
      break;
    }
    case 'elder': {
      const g = draftPerson(r, { age: int(r, 55, 70), family });
      const c = draftPerson(r, { age: int(r, 6, 14), family });
      people.push(g, c);
      story = `Old ${g.first} ${family} and ${g.sex === 'f' ? 'her' : 'his'} grandchild ${c.first}, the last of their family.`;
      break;
    }
  }
  return { id: s.nextId.party++, story, people };
}

export function makeArrivalOptions(s: GameState): Party[] {
  const n = hasLaw(s, 'open-gates') ? 4 : 3;
  return Array.from({ length: n }, () => makeParty(s));
}

/** The party arrives: real people, a tent, and a line in the Chronicle. */
export function settleParty(s: GameState, party: Party, patron = false) {
  const created = party.people.map((d) => createPerson(s, d, patron ? 'patron' : 'arrival'));
  party.people.forEach((d, i) => {
    const p = created[i];
    if (d.spouseOf !== undefined) p.spouse = created[d.spouseOf].id;
    for (const pi of d.parentsIdx ?? []) {
      p.parents.push(created[pi].id);
      created[pi].children.push(p.id);
    }
    p.backstory = p.backstory ?? party.story;
  });
  const site = findSite(s, 'tent');
  const tent = site ? addBuilding(s, 'tent', site.x, site.y) : undefined;
  for (const p of created) p.home = tent?.id;
  const ids = created.map((p) => p.id);
  if (patron) {
    const p = created[0];
    // Your settlers sometimes bring a keepsake from wherever they came from.
    if (chance(s.rng, 0.5)) makeItem(s, pick(s.rng, ['ring', 'cloak', 'comb'] as const), p, 'brought');
    log(s, 'patron', `${P(p.id)} arrived at dawn, as if ${p.sex === 'f' ? 'she' : 'he'} had been expected. ${p.backstory ?? ''}`.trim(), ids, 5, `The Year ${p.first} Came`);
  } else {
    // Turn the first mention of each newcomer into a clickable name.
    let story = party.story;
    for (const p of created) story = story.replace(new RegExp(`\\b${p.first}\\b`), F(p.id));
    log(s, 'arrival', `New arrivals: ${story}`, ids, 3, created.length >= 4 ? `The Year the ${created[0].family}s Came` : undefined);
  }
  return created;
}
