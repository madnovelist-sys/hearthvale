// Fortunes: reaching your daily goal offers three rare opportunities. Pick one.
import { log } from './chronicle';
import { draftPerson } from './people';
import { BUILD_WORK } from './planner';
import { int, pick, shuffle } from './rng';
import type { FortuneId, GameState, JobId } from './types';
import { DAYS_PER_YEAR } from './types';
import { ageOf, hasTrait, present } from './world';

export const FORTUNES: Record<FortuneId, { title: string; text: string }> = {
  master: { title: 'A master crafter', text: 'A famous potter, smith, builder or healer is passing through and would stay, if asked.' },
  healer: { title: 'A traveling healer', text: 'A healer stays a season: everyone who is sick gets well, and sickness is gentler for a year.' },
  treasure: { title: 'A treasure map', text: 'A map turns up in a trader\'s pack. The bravest settler sets out at once, with better odds than any quest.' },
  harvest: { title: 'A bumper harvest', text: 'The signs are good: this year\'s harvest will be the best anyone remembers.' },
  builder: { title: 'A master builder', text: 'A master builder passes through, and everything being built is finished in a week.' },
  feast: { title: 'A great feast', text: 'A feast for the whole settlement: everyone is happier, and couples who are courting marry.' },
  prophet: { title: 'A seeker', text: 'Someone is ready to hear a calling. Your next Raise a Prophet costs nothing.' },
};

/** The daily goal was reached: offer three Fortunes (at most two offers wait). */
export function offerFortune(s: GameState) {
  const pool: FortuneId[] = ['master', 'healer', 'treasure', 'harvest', 'builder', 'feast'];
  if (s.stage !== 'settlement') pool.push('prophet');
  // Don't offer what's already waiting in another offer.
  const waiting = new Set(s.fortunes.flatMap((f) => f.options));
  const fresh = pool.filter((f) => !waiting.has(f));
  const options = shuffle(s.rng, fresh.length >= 3 ? fresh : pool).slice(0, 3);
  s.fortunes.push({ id: s.nextId.fortune++, options });
  if (s.fortunes.length > 2) s.fortunes.shift();
}

export function takeFortune(s: GameState, offerId: number, choice: FortuneId): { ok: true; text: string } | { ok: false; reason: string } {
  const offer = s.fortunes.find((f) => f.id === offerId);
  if (!offer || !offer.options.includes(choice)) return { ok: false, reason: 'That Fortune has passed.' };
  s.fortunes = s.fortunes.filter((f) => f !== offer);
  const people = present(s);
  switch (choice) {
    case 'master': {
      const skill: JobId = pick(s.rng, ['potter', 'smith', 'builder', 'healer'] as JobId[]);
      const d = draftPerson(s.rng, { age: int(s.rng, 34, 52), skill, traits: ['clever', 'diligent'] });
      d.backstory = `A master ${skill === 'smith' ? 'bronzesmith' : skill}, known three valleys over, who decided to stay.`;
      s.pending.push({ kind: 'party', party: { id: s.nextId.party++, story: d.backstory, people: [d] } });
      return { ok: true, text: `${d.first} ${d.family} will arrive at dawn.` };
    }
    case 'healer': {
      for (const p of people) if (p.sick && !p.sick.plague) p.sick = undefined;
      s.flags.healerUntil = s.day + DAYS_PER_YEAR;
      log(s, 'fortune', `A traveling healer stayed a season in ${s.name}, setting bones and boiling willow bark, and taught anyone who'd listen.`, [], 4, 'The Year of the Healer');
      return { ok: true, text: 'The healer has arrived.' };
    }
    case 'treasure': {
      const brave = people.filter((p) => ageOf(s, p) >= 18 && ageOf(s, p) <= 50 && !p.preparing)
        .sort((a, b) => Number(hasTrait(b, 'brave')) - Number(hasTrait(a, 'brave')) || b.renown - a.renown)[0];
      if (!brave) return { ok: false, reason: 'There is no one able to go.' };
      brave.blessedUntil = Math.max(brave.blessedUntil ?? 0, s.day + DAYS_PER_YEAR * 3);
      brave.preparing = true;
      s.pending.push({ kind: 'quest', leader: brave.id, members: [], questKind: 'ruins' });
      return { ok: true, text: `${brave.first} will set out with the map at dawn.` };
    }
    case 'harvest':
      s.flags.harvestBoost = true;
      log(s, 'fortune', `The old farmers read the signs, and for once they all agreed: it would be a year of plenty.`, [], 3);
      return { ok: true, text: 'This year\'s harvest will be a great one.' };
    case 'builder': {
      let n = 0;
      for (const b of s.buildings) if (!b.built && !b.removed) { b.progress = Math.max(b.progress, (b.required || BUILD_WORK[b.kind]) - 0.01); n++; }
      log(s, 'fortune', `A master builder passed through ${s.name}, and in a week of shouting and singing, ${n || 'every'} half-finished building${n === 1 ? ' was' : 's were'} done.`, [], 4, 'The Year of the Master Builder');
      return { ok: true, text: n ? 'Everything being built will be finished.' : 'Nothing was being built, but the builder taught a few tricks.' };
    }
    case 'feast': {
      for (const p of people) p.mood += 20;
      let weddings = 0;
      for (const p of people) {
        if (weddings >= 3 || !p.courting || p.id > p.courting.with) continue;
        p.courting.until = s.day; // they wed at the next chance
        weddings++;
      }
      log(s, 'fortune', `A great feast was held for no reason at all. There was dancing, and ${weddings ? 'by the end of it, promises were made' : 'singing until the fire was embers'}.`, [], 4, 'The Year of the Great Feast');
      return { ok: true, text: 'A feast is held.' };
    }
    case 'prophet':
      s.flags.freeProphet = true;
      return { ok: true, text: 'Your next Raise a Prophet is free.' };
  }
}

/** A Fortune harvest overrides the year's luck. */
export function applyHarvestBoost(s: GameState) {
  if (!s.flags.harvestBoost) return;
  s.flags.harvest = Math.max(s.flags.harvest ?? 1, 1.45);
  s.flags.harvestBoost = false;
}

