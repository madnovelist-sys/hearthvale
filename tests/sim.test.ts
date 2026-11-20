import { describe, expect, it } from 'vitest';
import { makeArrivalOptions, settleParty } from '../src/sim/arrivals';
import { createSettler, sendOnQuest, welcomeParty } from '../src/sim/acts';
import { foundSettlement, stepDay } from '../src/sim/sim';
import { DAYS_PER_YEAR, type GameState } from '../src/sim/types';
import { ageOf, population } from '../src/sim/world';
import { logWords, startSession, stopSession, tick, focusDay } from '../src/game/clock';
import { parseSave } from '../src/game/save';

function run(seed: number, years: number): GameState {
  const s = foundSettlement({ seed, name: 'Testbrook' });
  for (let d = 0; d < years * DAYS_PER_YEAR; d++) {
    stepDay(s);
    if (d % 120 === 119) settleParty(s, makeArrivalOptions(s)[d % 3]);
  }
  return s;
}

describe('simulation', () => {
  it('is deterministic: the same seed and inputs give the same city', () => {
    const a = run(42, 4);
    const b = run(42, 4);
    expect(JSON.stringify(a)).toEqual(JSON.stringify(b));
  });

  it('founds a settlement of eight around a hearth', () => {
    const s = foundSettlement({ seed: 7, name: 'Ashmere' });
    expect(population(s)).toBe(8);
    expect(s.buildings.some((b) => b.kind === 'hearth')).toBe(true);
    expect(s.chronicle[0].kind).toBe('founding');
  });

  it('keeps families consistent over twenty years', () => {
    const s = run(9, 20);
    expect(population(s)).toBeGreaterThan(20);
    for (const p of s.people) {
      if (p.spouse !== undefined && p.alive) {
        const sp = s.people[p.spouse];
        expect(sp.spouse).toBe(p.id);
        expect(sp.alive).toBe(true);
      }
      if (p.alive && p.away === undefined && p.home !== undefined) {
        expect(s.buildings[p.home].removed).toBeFalsy();
      }
      for (const c of p.children) expect(s.people[c].parents).toContain(p.id);
    }
    // Every finished year has a name.
    for (let y = 1; y < 20; y++) expect(s.yearNames[y]).toBeTruthy();
  });

  it('grows into a village within a reasonable number of focus hours', () => {
    const s = run(12345, 14);
    expect(s.stage).toBe('village');
  });

  it("darkness changes how deadly life is", () => {
    const deaths = (darkness: number) => {
      const s = foundSettlement({ seed: 3, name: 'X', settings: { darkness, weirdness: 1 } });
      for (let d = 0; d < 25 * DAYS_PER_YEAR; d++) {
        stepDay(s);
        if (d % 120 === 119) settleParty(s, makeArrivalOptions(s)[0]);
      }
      return s.people.filter((p) => !p.alive && !p.left && ageOf(s, p) < 50).length;
    };
    expect(deaths(0)).toBeLessThan(deaths(100));
  });
});

describe('acts', () => {
  it('spends Favor and brings a created settler at dawn', () => {
    const s = foundSettlement({ seed: 5, name: 'Y' });
    s.favor = 3;
    const r = createSettler(s, { first: 'Wren', family: 'Ashford', sex: 'f', orientation: 'straight', age: 30, traits: ['brave', 'kind'], skill: 'healer', dream: 'remembered' });
    expect(r.ok).toBe(true);
    expect(s.favor).toBe(0);
    expect(s.people.some((p) => p.first === 'Wren')).toBe(false);
    startSession(s, 1_000_000);
    const wren = s.people.find((p) => p.first === 'Wren')!;
    expect(wren.patron).toBe(true);
    expect(wren.home).toBeDefined();
  });

  it('refuses acts the player cannot afford', () => {
    const s = foundSettlement({ seed: 5, name: 'Y' });
    s.favor = 1;
    const adult = s.people.find((p) => ageOf(s, p) >= 18)!;
    expect(sendOnQuest(s, adult.id, [], 'ruins').ok).toBe(false);
  });

  it('welcomes one party from a group of three', () => {
    const s = foundSettlement({ seed: 5, name: 'Y' });
    s.arrivals.push(makeArrivalOptions(s));
    const before = s.people.length;
    const party = s.arrivals[0][1];
    welcomeParty(s, party.id, true);
    expect(s.arrivals.length).toBe(0);
    expect(s.people.length).toBe(before + party.people.length);
  });
});

describe('focus clock', () => {
  it('turns an hour of work into a year, three Sparks and the daily goal', () => {
    const s = foundSettlement({ seed: 11, name: 'Z' });
    const t0 = new Date(2026, 10, 20, 9, 0).getTime();
    const favor = s.favor;
    startSession(s, t0);
    for (let m = 1; m <= 60; m++) tick(s, t0 + m * 60_000);
    const rec = stopSession(s, t0 + 60 * 60_000)!;
    expect(s.day).toBe(DAYS_PER_YEAR);
    expect(rec.sparks).toBe(3);
    expect(s.favor).toBe(favor + 3 + 5);
    expect(focusDay(s, t0).goalMet).toBe(true);
    expect(s.arrivals.length).toBeGreaterThan(0);
  });

  it('does not run the city while paused', () => {
    const s = foundSettlement({ seed: 11, name: 'Z' });
    tick(s, Date.now() + 3_600_000);
    expect(s.day).toBe(0);
  });

  it('when tracking words, Sparks and the daily goal come from words, not time', () => {
    const s = foundSettlement({ seed: 11, name: 'Z', goals: { track: 'words', dailyMinutes: 60, dailyWords: 1000, sparkMinutes: 20, sparkWords: 250 } });
    const t0 = new Date(2026, 10, 20, 9, 0).getTime();
    startSession(s, t0);
    for (let m = 1; m <= 60; m++) tick(s, t0 + m * 60_000);
    stopSession(s, t0 + 60 * 60_000);
    expect(s.day).toBe(DAYS_PER_YEAR); // the city still lives while the timer runs
    expect(s.arrivals.length).toBe(0); // but an hour of time alone brings no Sparks
    expect(focusDay(s, t0).goalMet).toBe(false);
    logWords(s, 1100, t0 + 61 * 60_000);
    expect(s.arrivals.length).toBe(3); // 4 Sparks; the oldest group moves on past 3 waiting
    expect(s.focus.sparkWords).toBe(100);
    expect(focusDay(s, t0).goalMet).toBe(true);
  });

  it('when tracking time, logged words are recorded but bring no Sparks', () => {
    const s = foundSettlement({ seed: 11, name: 'Z' });
    logWords(s, 600, Date.now());
    expect(s.arrivals.length).toBe(0);
  });

  it('treats a very long gap as an interruption, not work', () => {
    const s = foundSettlement({ seed: 11, name: 'Z' });
    const t0 = Date.now();
    startSession(s, t0);
    let gap = 0;
    tick(s, t0 + 5 * 3_600_000, { gap: (ms) => { gap = ms; } });
    expect(gap).toBeGreaterThan(0);
    expect(s.day).toBe(0);
  });
});

describe('saves', () => {
  it('round-trips through JSON exactly', () => {
    const s = run(77, 3);
    const back = parseSave(JSON.stringify(s));
    expect(JSON.stringify(back)).toEqual(JSON.stringify(s));
  });

  it('rejects files that are not saves', () => {
    expect(() => parseSave('{"hello":1}')).toThrow();
  });
});
