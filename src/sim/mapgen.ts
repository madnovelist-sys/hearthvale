// Terrain generation: a meadow valley with a river, woods, rocky rises and
// marsh. Seeded, so each founding site can be re-rolled or reproduced.
import { makeRng, rand, int, range, type RngState } from './rng';
import { TERRAIN, TREE, type MapData } from './types';
import { ensureForest } from './forest';

export const MAP_SIZE = 64;

function valueNoise(r: RngState, w: number, h: number, cell: number): (x: number, y: number) => number {
  const gw = Math.ceil(w / cell) + 2;
  const gh = Math.ceil(h / cell) + 2;
  const grid: number[] = [];
  for (let i = 0; i < gw * gh; i++) grid.push(rand(r));
  const smooth = (t: number) => t * t * (3 - 2 * t);
  return (x, y) => {
    const gx = x / cell;
    const gy = y / cell;
    const x0 = Math.floor(gx);
    const y0 = Math.floor(gy);
    const tx = smooth(gx - x0);
    const ty = smooth(gy - y0);
    const g = (ix: number, iy: number) => grid[iy * gw + ix];
    const a = g(x0, y0) + (g(x0 + 1, y0) - g(x0, y0)) * tx;
    const b = g(x0, y0 + 1) + (g(x0 + 1, y0 + 1) - g(x0, y0 + 1)) * tx;
    return a + (b - a) * ty;
  };
}

function fractal(r: RngState, w: number, h: number): (x: number, y: number) => number {
  const n1 = valueNoise(r, w, h, 16);
  const n2 = valueNoise(r, w, h, 8);
  const n3 = valueNoise(r, w, h, 4);
  return (x, y) => n1(x, y) * 0.55 + n2(x, y) * 0.3 + n3(x, y) * 0.15;
}

export interface GeneratedMap {
  map: MapData;
  hearth: { x: number; y: number };
}

export function generateMap(seed: number, size = MAP_SIZE): GeneratedMap {
  const r = makeRng(seed ^ 0x5eed);
  const w = size;
  const h = size;
  const n = w * h;
  const terrain = new Array<number>(n).fill(TERRAIN.GRASS);
  const trees = new Array<number>(n).fill(TREE.NONE);
  const wear = new Array<number>(n).fill(0);
  const occ = new Array<number>(n).fill(0);
  const fertility = new Array<number>(n).fill(0);

  const elevation = fractal(r, w, h);
  const moisture = fractal(r, w, h);

  // River: meanders from one edge to the opposite edge.
  const vertical = rand(r) < 0.5;
  let pos = range(r, size * 0.3, size * 0.7);
  let drift = 0;
  const riverCenter: number[] = [];
  for (let t = 0; t < size; t++) {
    drift = drift * 0.85 + range(r, -0.6, 0.6);
    pos = Math.max(6, Math.min(size - 7, pos + drift));
    riverCenter.push(pos);
  }
  const riverWidth = range(r, 1.3, 2.2);
  const distToRiver = (x: number, y: number) => {
    const t = vertical ? y : x;
    const c = vertical ? x : y;
    return Math.abs(c - riverCenter[t]);
  };

  // Maybe a pond.
  const pond = rand(r) < 0.6 ? { x: int(r, 8, w - 9), y: int(r, 8, h - 9), rad: range(r, 2, 3.5) } : null;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const e = elevation(x, y);
      const m = moisture(x, y);
      const dr = distToRiver(x, y);
      const dp = pond ? Math.hypot(x - pond.x, y - pond.y) : 99;
      if (dr < riverWidth * 0.55) terrain[i] = TERRAIN.DEEP;
      else if (dr < riverWidth) terrain[i] = TERRAIN.WATER;
      else if (dp < (pond?.rad ?? 0)) terrain[i] = dp < (pond!.rad - 1.2) ? TERRAIN.DEEP : TERRAIN.WATER;
      else if (dr < riverWidth + 1.1 && m > 0.45) terrain[i] = TERRAIN.SAND;
      else if (m > 0.68 && e < 0.42) terrain[i] = TERRAIN.MARSH;
      else if (e > 0.7) terrain[i] = TERRAIN.ROCK;
      else terrain[i] = TERRAIN.GRASS;

      // Fertility: wet, low land near the river is best.
      const nearWater = Math.max(0, 1 - dr / 14);
      fertility[i] = Math.max(0, Math.min(1, 0.35 + nearWater * 0.4 + (m - 0.5) * 0.5 - Math.max(0, e - 0.6)));

      // Trees: woods where it's moist, pines up high, bushes scattered.
      if (terrain[i] === TERRAIN.GRASS) {
        const roll = rand(r);
        if (e > 0.6 && roll < 0.55) trees[i] = TREE.PINE;
        else if (m > 0.56 && roll < 0.75) trees[i] = roll < 0.06 ? TREE.FRUIT : TREE.BROADLEAF;
        else if (roll < 0.035) trees[i] = TREE.BUSH;
        else if (roll < 0.045) trees[i] = TREE.BROADLEAF;
      } else if (terrain[i] === TERRAIN.ROCK && rand(r) < 0.18) {
        trees[i] = TREE.BOULDER;
      }
    }
  }

  // The hearth: open grass close (but not too close) to the river, near the middle.
  let best = { x: Math.floor(w / 2), y: Math.floor(h / 2), score: -Infinity };
  for (let y = 10; y < h - 10; y++) {
    for (let x = 10; x < w - 10; x++) {
      const i = y * w + x;
      if (terrain[i] !== TERRAIN.GRASS) continue;
      const dr = distToRiver(x, y);
      if (dr < 4) continue;
      let open = 0;
      for (let dy = -4; dy <= 4; dy++) {
        for (let dx = -4; dx <= 4; dx++) {
          const j = (y + dy) * w + (x + dx);
          if (terrain[j] === TERRAIN.GRASS) open += trees[j] ? 0.4 : 1;
        }
      }
      const center = -Math.hypot(x - w / 2, y - h / 2) * 0.8;
      const score = open + center - Math.abs(dr - 7) * 2 + rand(r) * 3;
      if (score > best.score) best = { x, y, score };
    }
  }
  // Clear a little meadow around the fire.
  for (let dy = -3; dy <= 3; dy++) {
    for (let dx = -3; dx <= 3; dx++) {
      const i = (best.y + dy) * w + (best.x + dx);
      if (Math.hypot(dx, dy) <= 3.2 && terrain[i] === TERRAIN.GRASS) trees[i] = TREE.NONE;
    }
  }

  const map: MapData = { w, h, terrain, trees, wear, occ, fertility, growth: [], wood: [] };
  ensureForest(map);
  return { map, hearth: { x: best.x, y: best.y } };
}

export function isWater(t: number): boolean {
  return t === TERRAIN.WATER || t === TERRAIN.DEEP;
}

export function isBuildable(t: number): boolean {
  return t === TERRAIN.GRASS || t === TERRAIN.SAND;
}
