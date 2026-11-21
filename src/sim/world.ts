// Small queries and helpers shared by every simulation system.
import { DAYS_PER_SEASON, DAYS_PER_YEAR, SEASONS, type Building, type GameState, type Person } from './types';

export const ageOf = (s: GameState, p: Person): number => Math.floor(((p.died ?? s.day) - p.born) / DAYS_PER_YEAR);
export const yearOf = (day: number): number => Math.floor(day / DAYS_PER_YEAR) + 1;
export const seasonIndex = (day: number): number => Math.floor((day % DAYS_PER_YEAR) / DAYS_PER_SEASON);
export const seasonName = (day: number) => SEASONS[seasonIndex(day)];
/** 0..1 progress through the current season. */
export const seasonProgress = (day: number): number => (day % DAYS_PER_SEASON) / DAYS_PER_SEASON;

export const person = (s: GameState, id: number | undefined): Person | undefined =>
  id === undefined ? undefined : s.people[id];

export const building = (s: GameState, id: number | undefined): Building | undefined =>
  id === undefined ? undefined : s.buildings[id];

export const fullName = (p: Person): string => (p.nickname ? `${p.first} ${p.nickname}` : `${p.first} ${p.family}`);

/** Living people who are in the settlement right now. */
export function present(s: GameState): Person[] {
  return s.people.filter((p) => p.alive && p.away === undefined);
}

export function living(s: GameState): Person[] {
  return s.people.filter((p) => p.alive);
}

export function population(s: GameState): number {
  let n = 0;
  for (const p of s.people) if (p.alive && p.away === undefined) n++;
  return n;
}

export const isAdult = (s: GameState, p: Person) => ageOf(s, p) >= 16;
export const isBlessed = (s: GameState, p: Person) => (p.blessedUntil ?? -1) > s.day;
export const hasTrait = (p: Person, t: Person['traits'][number]) => p.traits.includes(t);
export const pronoun = (p: Person) => (p.sex === 'f' ? 'she' : 'he');
export const possessive = (p: Person) => (p.sex === 'f' ? 'her' : 'his');
export const objectPronoun = (p: Person) => (p.sex === 'f' ? 'her' : 'him');

/** Ancestors up to grandparents, plus the person. Shared entries mean close kin. */
function closeFamily(s: GameState, p: Person): Set<number> {
  const out = new Set<number>([p.id]);
  for (const pid of p.parents) {
    out.add(pid);
    const parent = s.people[pid];
    if (parent) for (const gp of parent.parents) out.add(gp);
  }
  return out;
}

export function isCloseKin(s: GameState, a: Person, b: Person): boolean {
  if (a.id === b.id) return true;
  const fa = closeFamily(s, a);
  const fb = closeFamily(s, b);
  for (const x of fa) if (fb.has(x)) return true;
  return false;
}

export function residents(s: GameState, buildingId: number): Person[] {
  return s.people.filter((p) => p.alive && p.home === buildingId && p.away === undefined);
}

export type Tone = 'gentle' | 'balanced' | 'grim';
export function tone(s: GameState): Tone {
  const d = s.settings.darkness;
  return d < 34 ? 'gentle' : d < 67 ? 'balanced' : 'grim';
}

/** Multiplier on avoidable deaths: 0.1 at gentle, 1 at balanced, 2.5 at grim. */
export function darkFactor(s: GameState): number {
  const d = Math.max(0, Math.min(100, s.settings.darkness));
  return d <= 50 ? 0.1 + 0.9 * (d / 50) : 1 + 1.5 * ((d - 50) / 50);
}

export function tileIndex(s: GameState, x: number, y: number): number {
  return y * s.map.w + x;
}

export function inBounds(s: GameState, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < s.map.w && y < s.map.h;
}

/** 0: not on the town wall; 1: the wall itself; 2: a gate. */
export function wallTile(s: GameState, x: number, y: number): 0 | 1 | 2 {
  const w = s.walls;
  if (!w) return 0;
  const dx = x + 0.5 - w.cx;
  const dy = y + 0.5 - w.cy;
  const d = Math.hypot(dx, dy);
  if (Math.abs(d - w.r) >= 0.62) return 0;
  const a = Math.atan2(dy, dx);
  const half = 1.1 / w.r;
  for (const g of w.gates) if (Math.abs(Math.atan2(Math.sin(a - g), Math.cos(a - g))) < half) return 2;
  return 1;
}

export function homesOf(s: GameState): Building[] {
  return s.buildings.filter((b) => !b.removed && b.built && isDwelling(b.kind));
}

export function isDwelling(kind: Building['kind']): boolean {
  return kind === 'tent' || kind === 'leanto' || kind === 'townhouse' || kind === 'hut' || kind === 'house' || kind === 'bighouse';
}

export function centerOf(b: Building): { x: number; y: number } {
  return { x: b.x + Math.floor(b.w / 2), y: b.y + Math.floor(b.h / 2) };
}
