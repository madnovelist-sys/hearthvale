// A* over the tile grid. Worn tiles are cheaper to walk, so well-used routes
// pull new routes onto them and footpaths grow into a road network on their own.
import { TERRAIN, type Building, type MapData } from './types';

const SQRT2 = Math.SQRT2;
const DIRS = [
  [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
  [1, 1, SQRT2], [1, -1, SQRT2], [-1, 1, SQRT2], [-1, -1, SQRT2],
] as const;

export function tileCost(map: MapData, buildings: Building[], i: number): number {
  const t = map.terrain[i];
  if (t === TERRAIN.WATER || t === TERRAIN.DEEP) return Infinity;
  const occ = map.occ[i];
  if (occ) {
    const b = buildings[occ - 1];
    if (b && !b.removed && b.kind !== 'field' && b.kind !== 'graveyard') return Infinity;
    if (b?.kind === 'field') return 1.8;
  }
  let c = 1;
  if (t === TERRAIN.SAND) c = 1.1;
  else if (t === TERRAIN.ROCK) c = 1.6;
  else if (t === TERRAIN.MARSH) c = 2.2;
  if (map.trees[i]) c += 0.35;
  const worn = Math.min(1, map.wear[i] / 4);
  return c * (1 - 0.45 * worn);
}

/** Walking cost of every tile, computed once and shared by many searches. */
export function buildCostGrid(map: MapData, buildings: Building[]): Float32Array {
  const out = new Float32Array(map.w * map.h);
  for (let i = 0; i < out.length; i++) out[i] = tileCost(map, buildings, i);
  return out;
}

class Heap {
  private f: number[] = [];
  private v: number[] = [];
  get size() { return this.v.length; }
  push(f: number, v: number) {
    const { f: F, v: V } = this;
    F.push(f); V.push(v);
    let i = V.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (F[p] <= F[i]) break;
      [F[p], F[i]] = [F[i], F[p]];
      [V[p], V[i]] = [V[i], V[p]];
      i = p;
    }
  }
  pop(): number {
    const { f: F, v: V } = this;
    const top = V[0];
    const lf = F.pop()!;
    const lv = V.pop()!;
    if (V.length) {
      F[0] = lf; V[0] = lv;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < V.length && F[l] < F[m]) m = l;
        if (r < V.length && F[r] < F[m]) m = r;
        if (m === i) break;
        [F[m], F[i]] = [F[i], F[m]];
        [V[m], V[i]] = [V[i], V[m]];
        i = m;
      }
    }
    return top;
  }
}

// Scratch buffers reused across searches; a generation stamp marks which
// entries belong to the current search, so nothing needs clearing.
let bufSize = 0;
let gScore = new Float64Array(0);
let cameFrom = new Int32Array(0);
let stamp = new Uint32Array(0);
let generation = 0;

/** Returns tile indices from start to goal (inclusive), or null if unreachable. */
export function findPath(
  map: MapData,
  buildings: Building[],
  sx: number, sy: number,
  gx: number, gy: number,
  maxExpanded = 6000,
  costs?: Float32Array,
): number[] | null {
  const { w, h } = map;
  const n = w * h;
  const costAt = costs ? (i: number) => costs[i] : (i: number) => tileCost(map, buildings, i);
  if (bufSize !== n) {
    bufSize = n;
    gScore = new Float64Array(n);
    cameFrom = new Int32Array(n);
    stamp = new Uint32Array(n);
    generation = 0;
  }
  generation++;
  const start = sy * w + sx;
  const goal = gy * w + gx;
  if (start === goal) return [start];
  const open = new Heap();
  stamp[start] = generation;
  gScore[start] = 0;
  cameFrom[start] = -1;
  open.push(0, start);
  let expanded = 0;
  const hfn = (i: number) => {
    const dx = Math.abs((i % w) - gx);
    const dy = Math.abs(Math.floor(i / w) - gy);
    return (Math.max(dx, dy) + (SQRT2 - 1) * Math.min(dx, dy)) * 0.75;
  };
  const blocked = (i: number) => !isFinite(costAt(i));
  while (open.size) {
    const cur = open.pop();
    if (cur === goal) {
      const path = [cur];
      let c = cur;
      while (cameFrom[c] >= 0) { c = cameFrom[c]; path.push(c); }
      return path.reverse();
    }
    if (++expanded > maxExpanded) return null;
    const cx = cur % w;
    const cy = Math.floor(cur / w);
    const gc = gScore[cur];
    for (const [dx, dy, step] of DIRS) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const ni = ny * w + nx;
      let cost = ni === goal ? 1 : costAt(ni);
      if (!isFinite(cost)) continue;
      // No cutting corners past blocked tiles.
      if (dx && dy && (blocked(cy * w + nx) || blocked(ny * w + cx))) continue;
      cost *= step;
      const ng = gc + cost;
      if (stamp[ni] !== generation || ng < gScore[ni]) {
        stamp[ni] = generation;
        gScore[ni] = ng;
        cameFrom[ni] = cur;
        open.push(ng + hfn(ni), ni);
      }
    }
  }
  return null;
}

/** All land tiles reachable on foot from a point (the settlement's side of the river). */
export function reachable(map: MapData, sx: number, sy: number): Uint8Array {
  const { w, h } = map;
  const seen = new Uint8Array(w * h);
  const stack = [sy * w + sx];
  seen[stack[0]] = 1;
  while (stack.length) {
    const i = stack.pop()!;
    const x = i % w;
    const y = Math.floor(i / w);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const ni = ny * w + nx;
      if (seen[ni]) continue;
      const t = map.terrain[ni];
      if (t === TERRAIN.WATER || t === TERRAIN.DEEP) continue;
      seen[ni] = 1;
      stack.push(ni);
    }
  }
  return seen;
}
