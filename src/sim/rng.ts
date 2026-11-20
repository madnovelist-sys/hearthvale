// Seeded, serializable random numbers. The whole simulation draws from one
// stream stored in the save, so a city replays identically from the same seed.

export interface RngState { s: number }

export function makeRng(seed: number): RngState {
  return { s: (seed >>> 0) || 0x9e3779b9 };
}

/** mulberry32: a small, fast generator with a 32-bit state. */
export function rand(r: RngState): number {
  r.s = (r.s + 0x6d2b79f5) >>> 0;
  let t = r.s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function chance(r: RngState, p: number): boolean {
  return rand(r) < p;
}

/** Integer in [lo, hi], inclusive. */
export function int(r: RngState, lo: number, hi: number): number {
  return lo + Math.floor(rand(r) * (hi - lo + 1));
}

export function range(r: RngState, lo: number, hi: number): number {
  return lo + rand(r) * (hi - lo);
}

export function pick<T>(r: RngState, items: readonly T[]): T {
  return items[Math.floor(rand(r) * items.length)];
}

export function weighted<T>(r: RngState, items: readonly (readonly [T, number])[]): T {
  let total = 0;
  for (const [, w] of items) total += Math.max(0, w);
  let roll = rand(r) * total;
  for (const [item, w] of items) {
    roll -= Math.max(0, w);
    if (roll < 0) return item;
  }
  return items[items.length - 1][0];
}

export function shuffle<T>(r: RngState, items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(rand(r) * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

export function hashString(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
