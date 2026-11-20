// The woods: each tree holds a fixed amount of wood. Woodcutters fell the
// nearest grown trees, leaving stumps; saplings take years to grow back, so
// a busy settlement pushes the forest back, and woodcutters walk farther.
import { log } from './chronicle';
import { settlementRegion } from './planner';
import { chance, int } from './rng';
import { TERRAIN, TREE, type GameState, type MapData } from './types';

export const WOOD_PER_TREE = 60;
const YEARS_TO_GROW = 5;
const STUMP_YEARS = 3;
const NEAR = 14; // the "near woods" around the hearth

const choppable = (t: number) => t === TREE.BROADLEAF || t === TREE.PINE;

/** Older saves and new maps: every existing tree is grown and full of wood. */
export function ensureForest(map: MapData) {
  const n = map.w * map.h;
  if (map.growth?.length === n && map.wood?.length === n) return;
  map.growth = new Array<number>(n).fill(0);
  map.wood = new Array<number>(n).fill(0);
  for (let i = 0; i < n; i++) {
    if (map.trees[i] === TREE.NONE) continue;
    map.growth[i] = 1;
    if (choppable(map.trees[i])) map.wood[i] = WOOD_PER_TREE;
  }
}

/** Grown, choppable trees within the near woods. */
export function nearWoods(s: GameState): number {
  const { map, hearth } = s;
  let n = 0;
  for (let y = Math.max(0, hearth.y - NEAR); y < Math.min(map.h, hearth.y + NEAR); y++) {
    for (let x = Math.max(0, hearth.x - NEAR); x < Math.min(map.w, hearth.x + NEAR); x++) {
      const i = y * map.w + x;
      if (choppable(map.trees[i]) && map.growth[i] >= 1) n++;
    }
  }
  return n;
}

// The tree currently being felled, per map, so the search isn't repeated daily.
const targets = new WeakMap<object, number>();

function findTarget(s: GameState): number {
  const { map, hearth } = s;
  const region = settlementRegion(s);
  let best = -1;
  let bestD = Infinity;
  const R = 34;
  for (let y = Math.max(0, hearth.y - R); y < Math.min(map.h, hearth.y + R); y++) {
    for (let x = Math.max(0, hearth.x - R); x < Math.min(map.w, hearth.x + R); x++) {
      const i = y * map.w + x;
      if (!region[i] || !choppable(map.trees[i]) || map.growth[i] < 1 || map.wood[i] <= 0) continue;
      const d = Math.hypot(x - hearth.x, y - hearth.y) + ((x * 7 + y * 13) % 5) * 0.4;
      if (d < bestD) { bestD = d; best = i; }
    }
  }
  return best;
}

/** The tile being felled now (for the woodcutters' walk), or -1. */
export function currentTarget(s: GameState): number {
  const t = targets.get(s.map);
  return t !== undefined && t >= 0 && choppable(s.map.trees[t]) ? t : -1;
}

/**
 * A woodcutter's day: take wood from the nearest grown tree. The farther the
 * walk, the less wood comes home. Returns the wood gathered.
 */
export function chopWood(s: GameState, amount: number): number {
  const { map, hearth } = s;
  let t = currentTarget(s);
  if (t < 0 || map.wood[t] <= 0) {
    t = findTarget(s);
    targets.set(map, t);
  }
  if (t < 0) return amount * 0.2; // dead wood and scraps
  const d = Math.hypot((t % map.w) - hearth.x, Math.floor(t / map.w) - hearth.y);
  const walk = d <= 10 ? 1 : Math.max(0.35, 1 - (d - 10) / 30);
  const got = Math.min(map.wood[t], amount * walk);
  map.wood[t] -= got;
  if (map.wood[t] <= 0.001) {
    map.trees[t] = TREE.STUMP;
    map.wood[t] = 0;
    map.growth[t] = s.day; // for a stump: the day it was felled
    targets.set(map, -1);
  }
  return got;
}

/** Each month: saplings grow, stumps rot or sprout, and seedlings spread from grown trees. */
export function forestMonth(s: GameState) {
  const { map } = s;
  const n = map.w * map.h;
  const step = 30 / (YEARS_TO_GROW * 360);
  for (let i = 0; i < n; i++) {
    const t = map.trees[i];
    if (t === TREE.STUMP) {
      if (s.day - map.growth[i] > STUMP_YEARS * 360) {
        if (chance(s.rng, 0.35) && !map.occ[i]) { map.trees[i] = TREE.BROADLEAF; map.growth[i] = 0.08; }
        else { map.trees[i] = TREE.NONE; map.growth[i] = 0; }
      }
    } else if (t !== TREE.NONE && map.growth[i] < 1) {
      map.growth[i] = Math.min(1, map.growth[i] + step);
      if (map.growth[i] >= 1 && choppable(t)) map.wood[i] = WOOD_PER_TREE;
    }
  }
  // New seedlings, only next to grown trees, and only where people don't tread.
  for (let k = 0; k < 120; k++) {
    const x = int(s.rng, 1, map.w - 2);
    const y = int(s.rng, 1, map.h - 2);
    const i = y * map.w + x;
    if (map.trees[i] !== TREE.NONE || map.occ[i] || map.wear[i] > 0.3 || map.terrain[i] !== TERRAIN.GRASS) continue;
    let grown = 0;
    let pines = 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const j = (y + dy) * map.w + (x + dx);
      if (choppable(map.trees[j]) && map.growth[j] >= 1) { grown++; if (map.trees[j] === TREE.PINE) pines++; }
    }
    if (grown >= 1 && chance(s.rng, 0.25 * grown)) {
      map.trees[i] = pines * 2 >= grown ? TREE.PINE : TREE.BROADLEAF;
      map.growth[i] = 0.05;
    }
  }
  noticeTheWoods(s);
}

/** The Chronicle notices when the near woods thin out, and when they're gone. */
function noticeTheWoods(s: GameState) {
  const now = nearWoods(s);
  if (s.flags.forestStart === undefined) { s.flags.forestStart = Math.max(1, now); s.flags.forestNotice = 0; return; }
  const frac = now / s.flags.forestStart;
  const level = s.flags.forestNotice ?? 0;
  if (level < 1 && frac < 0.5) {
    s.flags.forestNotice = 1;
    log(s, 'season', `The woods around ${s.name} were thinning. Where there had been oaks, there were stumps, and the woodcutters walked farther every season.`, [], 3);
  } else if (level < 2 && frac < 0.12) {
    s.flags.forestNotice = 2;
    log(s, 'season', `The near woods were gone. Children who had never seen them grew up hearing about the old oaks by the river.`, [], 5, 'The Year the Woods Were Gone');
  } else if (level >= 1 && frac > 0.7) {
    s.flags.forestNotice = 0;
    log(s, 'season', `The woods had grown back around ${s.name}. The young trees were thick enough to get lost in.`, [], 3);
  }
}
