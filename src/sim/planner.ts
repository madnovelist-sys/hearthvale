// The settlement builds itself: it decides what to build, where it goes,
// and moves families in when it's done. Footsteps wear paths into the grass.
import { log } from './chronicle';
import { isBuildable } from './mapgen';
import { buildCostGrid, findPath, reachable } from './path';
import { rand, shuffle, int } from './rng';
import { TERRAIN, TREE, type Building, type BuildingKind, type GameState, type Person } from './types';
import { ageOf, centerOf, isDwelling, population, present, residents, tileIndex } from './world';

export const FOOTPRINT: Record<BuildingKind, [number, number]> = {
  hearth: [1, 1], stone: [1, 1], tent: [1, 1], hut: [1, 1], house: [1, 1], bighouse: [2, 2], hall: [3, 3],
  granary: [2, 2], kiln: [2, 2], furnace: [1, 1], shrine: [2, 2], well: [1, 1], dock: [1, 1], stall: [1, 1],
  field: [2, 2], graveyard: [3, 3],
};

export const BUILD_WORK: Record<BuildingKind, number> = {
  hearth: 0, stone: 0, tent: 0, hut: 24, house: 50, bighouse: 80, hall: 160, granary: 40, kiln: 30,
  furnace: 40, shrine: 40, well: 20, dock: 25, stall: 12, field: 6, graveyard: 0,
};

/** Wood used per unit of building work. Fields and graveyards need none. */
const WOOD_PER_WORK: Partial<Record<BuildingKind, number>> = { field: 0, graveyard: 0, well: 0.4, shrine: 0.3, kiln: 0.8 };
const DEFAULT_WOOD_PER_WORK = 1.5;

export const BUILDING_LABEL: Record<BuildingKind, string> = {
  hearth: 'The Hearth', stone: 'The Old Stone', tent: 'Hide tent', hut: 'Round hut', house: 'Mudbrick home',
  bighouse: 'Family house', hall: 'Gathering hall', granary: 'Granary', kiln: "Potter's kiln",
  furnace: 'Bronze furnace', shrine: 'Stone circle', well: 'Well', dock: 'Fishing dock', stall: 'Market stall',
  field: 'Barley field', graveyard: 'Burial ground',
};

const regionCache = new WeakMap<object, Uint8Array>();
export function settlementRegion(s: GameState): Uint8Array {
  let r = regionCache.get(s.map);
  if (!r) {
    r = reachable(s.map, s.hearth.x, s.hearth.y);
    regionCache.set(s.map, r);
  }
  return r;
}

function setOcc(s: GameState, b: Building, value: number) {
  for (let y = b.y; y < b.y + b.h; y++) {
    for (let x = b.x; x < b.x + b.w; x++) {
      const i = tileIndex(s, x, y);
      s.map.occ[i] = value;
      if (value) s.map.trees[i] = TREE.NONE;
    }
  }
}

export function addBuilding(
  s: GameState, kind: BuildingKind, x: number, y: number,
  opts: { built?: boolean; forPeople?: number[]; replaces?: number; worker?: number } = {},
): Building {
  const [w, h] = FOOTPRINT[kind];
  const b: Building = {
    id: s.nextId.building++,
    kind, x, y, w, h,
    built: opts.built ?? BUILD_WORK[kind] === 0,
    progress: 0,
    required: BUILD_WORK[kind],
    variant: int(s.rng, 0, 59), // picks among however many art variants exist
    founded: s.day,
    forPeople: opts.forPeople,
    replaces: opts.replaces,
    worker: opts.worker,
  };
  if (b.built) b.completed = s.day;
  s.buildings.push(b);
  // An upgrade keeps the old building standing (and occupying the tiles) until it's done.
  if (opts.replaces === undefined) setOcc(s, b, b.id + 1);
  return b;
}

export function removeBuilding(s: GameState, b: Building) {
  b.removed = true;
  const ref = s.map.occ[tileIndex(s, b.x, b.y)];
  if (ref === b.id + 1) setOcc(s, b, 0);
}

type SiteKind = 'dwelling' | 'civic' | 'field' | 'graveyard' | 'dock';

function siteKind(kind: BuildingKind): SiteKind {
  if (isDwelling(kind)) return 'dwelling';
  if (kind === 'field') return 'field';
  if (kind === 'graveyard') return 'graveyard';
  if (kind === 'dock') return 'dock';
  return 'civic';
}

/** Find a good spot for a new building, or null if there's no room. */
export function findSite(s: GameState, kind: BuildingKind): { x: number; y: number } | null {
  const [w, h] = FOOTPRINT[kind];
  const sk = siteKind(kind);
  const region = settlementRegion(s);
  const { map, hearth } = s;
  const nBuilt = s.buildings.filter((b) => !b.removed && b.kind !== 'field').length;
  const ring = 2.6 + Math.sqrt(nBuilt) * 0.85;
  const R = sk === 'field' ? 28 : 24;
  let best: { x: number; y: number; score: number } | null = null;

  for (let y = Math.max(1, hearth.y - R); y < Math.min(map.h - h - 1, hearth.y + R); y++) {
    for (let x = Math.max(1, hearth.x - R); x < Math.min(map.w - w - 1, hearth.x + R); x++) {
      let ok = true;
      let trees = 0;
      let worn = 0;
      let fert = 0;
      let shore = false;
      for (let yy = y; yy < y + h && ok; yy++) {
        for (let xx = x; xx < x + w; xx++) {
          const i = yy * map.w + xx;
          if (!region[i] || map.occ[i] || !isBuildable(map.terrain[i])) { ok = false; break; }
          if (map.trees[i]) trees += map.trees[i] === TREE.BOULDER ? 3 : 1;
          if (map.wear[i] > 1.2) worn++;
          fert += map.fertility[i];
          if (sk === 'dock') {
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
              const t = map.terrain[(yy + dy) * map.w + (xx + dx)];
              if (t === TERRAIN.WATER || t === TERRAIN.DEEP) shore = true;
            }
          }
        }
      }
      if (!ok) continue;
      if (sk === 'dock' && !shore) continue;
      const cx = x + w / 2 - 0.5;
      const cy = y + h / 2 - 0.5;
      const d = Math.hypot(cx - hearth.x, cy - hearth.y);
      if (d < 2.4 + Math.max(w, h) / 2) continue; // keep the plaza around the fire open

      // Neighbouring buildings (clustering) within two tiles; touching ones crowd it.
      let near = 0;
      let nearHomes = 0;
      let touching = 0;
      for (let yy = y - 2; yy < y + h + 2; yy++) {
        for (let xx = x - 2; xx < x + w + 2; xx++) {
          if (xx < 0 || yy < 0 || xx >= map.w || yy >= map.h) continue;
          const o = map.occ[yy * map.w + xx];
          if (!o) continue;
          const nb = s.buildings[o - 1];
          if (!nb || nb.removed) continue;
          if (nb.kind !== 'field') near++;
          if (isDwelling(nb.kind)) nearHomes++;
          if (xx >= x - 1 && xx <= x + w && yy >= y - 1 && yy <= y + h && nb.kind !== 'field') touching++;
        }
      }

      let score = rand(s.rng) * 1.5 - trees * 1.4 - worn * 1.2;
      switch (sk) {
        case 'dwelling':
          score += -Math.abs(d - ring) * 1.1 + Math.min(near, 6) * 0.5 - touching * 0.9;
          break;
        case 'civic':
          score += -Math.abs(d - 3.5) * 1.3 + Math.min(near, 6) * 0.3;
          break;
        case 'field':
          if (d < 5 || d > 26) continue;
          score += (fert / (w * h)) * 9 - Math.abs(d - (ring + 3)) * 0.5 - nearHomes * 0.6;
          break;
        case 'graveyard':
          if (d < 6 || d > 14) continue;
          score += -nearHomes * 2 - Math.abs(d - 8) * 0.6;
          break;
        case 'dock':
          score += -d * 0.6;
          break;
      }
      if (!best || score > best.score) best = { x, y, score };
    }
  }
  return best ? { x: best.x, y: best.y } : null;
}

export function queueBuilding(
  s: GameState, kind: BuildingKind,
  opts: { forPeople?: number[]; worker?: number } = {},
): Building | null {
  const site = findSite(s, kind);
  if (!site) return null;
  return addBuilding(s, kind, site.x, site.y, opts);
}

/** Replace a building with a better one on the same footprint. */
export function queueUpgrade(s: GameState, old: Building, kind: BuildingKind): Building {
  return addBuilding(s, kind, old.x, old.y, { replaces: old.id });
}

export function projects(s: GameState): Building[] {
  return s.buildings.filter((b) => !b.built && !b.removed);
}

function builderWork(s: GameState): number {
  let work = 0;
  const pop = population(s);
  for (const p of present(s)) {
    if (p.sick || p.injured) continue;
    const age = ageOf(s, p);
    if (age < 12) continue;
    if (p.job === 'builder') {
      work += 1 + (p.traits.includes('diligent') ? 0.3 : 0) - (p.traits.includes('lazy') ? 0.3 : 0) + (p.skill === 'builder' ? 0.2 : 0);
    } else if (pop < 14 && age >= 16) {
      work += 0.35; // in the early days everyone lends a hand
    }
  }
  return work;
}

function progressConstruction(s: GameState) {
  const list = projects(s);
  if (!list.length) return;
  let work = builderWork(s);
  for (const b of list) {
    if (work <= 0) break;
    const need = b.required - b.progress;
    const perWood = WOOD_PER_WORK[b.kind] ?? DEFAULT_WOOD_PER_WORK;
    const woodLimit = perWood > 0 ? s.stores.wood / perWood : Infinity;
    const done = Math.min(work, need, woodLimit);
    if (done <= 0) continue;
    b.progress += done;
    work -= done;
    s.stores.wood -= done * perWood;
    if (b.progress >= b.required - 1e-6) completeBuilding(s, b);
  }
}

function completeBuilding(s: GameState, b: Building) {
  b.built = true;
  b.completed = s.day;
  b.progress = b.required;
  if (b.replaces !== undefined) {
    const old = s.buildings[b.replaces];
    if (old && !old.removed) {
      for (const p of s.people) if (p.home === old.id) p.home = b.id;
      old.removed = true;
    }
    setOcc(s, b, b.id + 1);
    }
  if (b.forPeople?.length) moveIn(s, b, b.forPeople);
  b.forPeople = undefined;

  const firsts = s.buildings.filter((x) => x.kind === b.kind && x.built && !x.removed && x.id !== b.id).length === 0;
  const label = BUILDING_LABEL[b.kind].toLowerCase();
  const movers = s.people.filter((p) => p.alive && p.home === b.id && ageOf(s, p) >= 16);
  if ((b.kind === 'hut' || b.kind === 'house') && firsts && movers.length) {
    const what = b.kind === 'hut' ? 'round hut, walled in clay and thatched with reed' : 'mudbrick home, with a red-painted base like the ones back south';
    log(s, 'build', `The first ${what}, was finished. ${movers.map((p) => `{p:${p.id}}`).join(' and ')} moved in out of the wind.`, movers.map((p) => p.id), 3);
  } else if (b.kind === 'hall') {
    log(s, 'build', `The gathering hall was finished. Its roof beams were carried up by every pair of hands in ${s.name}.`, [], 6, 'The Year of the Hall');
  } else if (!isDwelling(b.kind) && b.kind !== 'field' && firsts) {
    const lines: Partial<Record<BuildingKind, string>> = {
      well: `A well was dug beside the meadow. No more hauling water up from the river.`,
      granary: `The first granary went up on stilts, out of reach of mice and floods.`,
      kiln: `A potter's kiln was raised. That night it glowed like a second hearth.`,
      furnace: `The bronze furnace was lit for the first time, and the smoke could be seen for miles.`,
      shrine: `Stones were dragged into a circle on the rise. People began leaving small offerings there.`,
      dock: `A fishing dock was built out over the water.`,
      stall: `The first market stall opened, trading pots for fish and fish for pots.`,
    };
    log(s, 'build', lines[b.kind] ?? `The first ${label} was built.`, [], 3);
  }
}

/** Move people (and the young children living with them) into a building. */
export function moveIn(s: GameState, b: Building, people: number[]) {
  const movers = new Set<number>();
  for (const pid of people) {
    const p = s.people[pid];
    if (!p || !p.alive) continue;
    const oldHome = p.home;
    movers.add(pid);
    for (const cid of p.children) {
      const c = s.people[cid];
      if (c && c.alive && ageOf(s, c) < 16 && c.home === oldHome) movers.add(cid);
    }
  }
  for (const pid of movers) s.people[pid].home = b.id;
}

/** Find an empty home nobody lives in. */
function vacantHome(s: GameState, byHome: Map<number, Person[]>): Building | undefined {
  return s.buildings.find((b) => b.built && !b.removed && isDwelling(b.kind) && b.kind !== 'tent' && !byHome.get(b.id)?.length);
}

function reservedFor(s: GameState): Set<number> {
  const out = new Set<number>();
  for (const b of projects(s)) for (const pid of b.forPeople ?? []) out.add(pid);
  return out;
}

/** Married couples who share a home with another adult couple need a place of their own. */
function housing(s: GameState) {
  const reserved = reservedFor(s);
  const pending = projects(s).filter((b) => isDwelling(b.kind)).length;
  const people = present(s);
  const byHome = new Map<number, Person[]>();
  for (const p of people) {
    if (p.home === undefined) continue;
    const list = byHome.get(p.home);
    if (list) list.push(p); else byHome.set(p.home, [p]);
  }
  const residentsOf = (id: number) => byHome.get(id) ?? [];
  for (const p of people) {
    if (p.spouse === undefined || reserved.has(p.id) || p.id > p.spouse) continue;
    const spouse = s.people[p.spouse];
    if (!spouse || !spouse.alive || spouse.away !== undefined) continue;
    const home = p.home;
    const others = home === undefined ? [] : residentsOf(home).filter(
      (r) => r.id !== p.id && r.id !== spouse.id && ageOf(s, r) >= 16 && !p.children.includes(r.id) && !spouse.children.includes(r.id),
    );
    if (home !== undefined && others.length === 0 && spouse.home === home) continue;
    const vacant = vacantHome(s, byHome);
    if (vacant) {
      moveIn(s, vacant, [p.id, spouse.id]);
      byHome.set(vacant.id, [p, spouse]);
      continue;
    }
    if (pending >= 3) continue;
    const kind: BuildingKind = s.stage === 'settlement' && rand(s.rng) < 0.5 ? 'hut' : 'house';
    const b = queueBuilding(s, kind, { forPeople: [p.id, spouse.id] });
    if (b) reserved.add(p.id);
  }

  // Big families (six or more under one roof) build a family house, once it's a village.
  if (s.stage !== 'settlement' && pending < 3 && !projects(s).some((b) => b.kind === 'bighouse')) {
    for (const [homeId, list] of byHome) {
      const home = s.buildings[homeId];
      if (!home || home.kind === 'bighouse' || list.length < 6) continue;
      const head = list.find((p) => p.spouse !== undefined && list.some((q) => q.id === p.spouse) && !reserved.has(p.id));
      if (!head || s.stores.wood < 60) continue;
      if (queueBuilding(s, 'bighouse', { forPeople: [head.id, head.spouse!] })) break;
    }
  }

  // Homeless people (after a fire, or a return from far away) get a tent.
  for (const p of people) {
    if (p.home !== undefined || ageOf(s, p) < 16) continue;
    const site = findSite(s, 'tent');
    if (!site) break;
    const tent = addBuilding(s, 'tent', site.x, site.y);
    p.home = tent.id;
    for (const c of p.children) { const k = s.people[c]; if (k?.alive && k.home === undefined) k.home = tent.id; }
  }

  // People in tents get a proper hut built where the tent stands.
  const upgrading = new Set(projects(s).map((b) => b.replaces).filter((x) => x !== undefined));
  let started = 0;
  for (const b of s.buildings) {
    if (started >= 1 || pending + started >= 4) break;
    if (b.removed || !b.built || b.kind !== 'tent' || upgrading.has(b.id)) continue;
    if (!residentsOf(b.id).length) { removeBuilding(s, b); continue; }
    queueUpgrade(s, b, rand(s.rng) < 0.5 ? 'hut' : 'house');
    started++;
  }

  // Abandoned homes eventually fall down.
  if (s.day % 180 === 5) {
    const taken = new Set<number>();
    for (const p of s.people) if (p.alive && p.home !== undefined) taken.add(p.home);
    for (const b of s.buildings) {
      if (b.removed || !b.built || !isDwelling(b.kind) || taken.has(b.id)) continue;
      if (s.day - (b.completed ?? 0) > 720 && rand(s.rng) < 0.3) removeBuilding(s, b);
    }
  }
}

function hasBuilding(s: GameState, kind: BuildingKind, includeProjects = true): boolean {
  return s.buildings.some((b) => b.kind === kind && !b.removed && (includeProjects || b.built));
}

function countBuildings(s: GameState, kind: BuildingKind): number {
  return s.buildings.filter((b) => b.kind === kind && !b.removed).length;
}

/** Shared buildings appear as the settlement grows. One at a time. */
function civic(s: GameState) {
  if (projects(s).some((b) => !isDwelling(b.kind) && b.kind !== 'field')) return;
  const pop = population(s);
  const people = present(s);
  const has = (k: BuildingKind) => hasBuilding(s, k);
  const jobs = (j: Person['job']) => people.some((p) => p.job === j);
  let want: BuildingKind | null = null;
  if (pop >= 10 && !has('well')) want = 'well';
  else if (pop >= 16 && !has('granary')) want = 'granary';
  else if (jobs('fisher') && !has('dock')) want = 'dock';
  else if (jobs('potter') && !has('kiln')) want = 'kiln';
  else if (pop >= 24 && !has('shrine')) want = 'shrine';
  else if (jobs('smith') && !has('furnace')) want = 'furnace';
  else if (s.stage !== 'settlement' && countBuildings(s, 'stall') < Math.min(3, Math.floor(pop / 25))) want = 'stall';
  else if (s.stage !== 'settlement' && pop >= 60 && !has('hall')) want = 'hall';
  else if (pop >= 45 && countBuildings(s, 'granary') < 2) want = 'granary';
  else if (pop >= 40 && countBuildings(s, 'well') < 2) want = 'well';
  if (want) queueBuilding(s, want);

  // Every farmer works a field of their own.
  const farmers = people.filter((p) => p.job === 'farmer');
  const fields = s.buildings.filter((b) => b.kind === 'field' && !b.removed);
  for (const f of fields) {
    const w = f.worker === undefined ? undefined : s.people[f.worker];
    if (!w || !w.alive || w.job !== 'farmer') f.worker = undefined;
  }
  for (const farmer of farmers) {
    if (fields.some((f) => f.worker === farmer.id)) continue;
    const free = fields.find((f) => f.worker === undefined);
    if (free) free.worker = farmer.id;
    else {
      const nf = queueBuilding(s, 'field', { worker: farmer.id });
      if (nf) fields.push(nf);
      break;
    }
  }
}

/** Once it's a village, old huts are rebuilt as mudbrick homes, a few each season. */
function upgrades(s: GameState) {
  if (s.stage === 'settlement') return;
  if (s.stores.wood < 30 || projects(s).length > 3) return;
  const huts = shuffle(s.rng, s.buildings.filter((b) => b.kind === 'hut' && b.built && !b.removed && residents(s, b.id).length));
  const upgrading = new Set(projects(s).map((b) => b.replaces));
  let n = 0;
  for (const hut of huts) {
    if (n >= 2) break;
    if (upgrading.has(hut.id)) continue;
    queueUpgrade(s, hut, 'house');
    n++;
  }
}

export function plannerDay(s: GameState) {
  progressConstruction(s);
  if (s.day % 5 === 0) housing(s);
  if (s.day % 10 === 3) civic(s);
  if (s.day % 90 === 45) upgrades(s);
  wearDay(s);
}

// ---------------------------------------------------------------------------
// Desire paths

const pathCaches = new WeakMap<object, Map<string, { path: number[] | null; day: number }>>();

/** Commute routes, refreshed every month or so (staggered) so they bend toward worn paths. */
function cachedPath(s: GameState, costs: () => Float32Array, from: { x: number; y: number }, to: { x: number; y: number }): number[] | null {
  let c = pathCaches.get(s.map);
  if (!c) { c = new Map(); pathCaches.set(s.map, c); }
  const key = (from.y * s.map.w + from.x) * 65536 + to.y * s.map.w + to.x;
  const hit = c.get(String(key));
  const ttl = 60 + ((from.x * 31 + from.y * 17 + to.x * 7 + to.y) % 60);
  if (!hit || s.day - hit.day > ttl || s.day < hit.day) {
    const path = findPath(s.map, s.buildings, from.x, from.y, to.x, to.y, 3000, costs());
    c.set(String(key), { path, day: s.day });
    return path;
  }
  return hit.path;
}

/** Door tile: in front of the building's left wall. */
export function doorOf(b: Building): { x: number; y: number } {
  return { x: b.x + Math.floor(b.w / 2), y: b.y + b.h };
}

/** Where someone goes to work each day, if anywhere. */
export function workSite(s: GameState, p: Person): { x: number; y: number } | null {
  const find = (kind: BuildingKind) => s.buildings.find((b) => b.kind === kind && b.built && !b.removed);
  switch (p.job) {
    case 'farmer': {
      const f = s.buildings.find((b) => b.kind === 'field' && !b.removed && b.worker === p.id);
      return f ? centerOf(f) : null;
    }
    case 'fisher': { const d = find('dock'); return d ? centerOf(d) : null; }
    case 'potter': { const k = find('kiln'); return k ? doorOf(k) : null; }
    case 'smith': { const k = find('furnace'); return k ? doorOf(k) : null; }
    case 'builder': { const b = projects(s)[0]; return b ? doorOf(b) : null; }
    case 'healer':
    case 'elder':
      return { x: s.hearth.x + 1, y: s.hearth.y + 1 };
    default:
      return null;
  }
}

/** Every five days: old paths fade a little, and each commute wears its route a little deeper. */
const WEAR_EVERY = 5;
function wearDay(s: GameState) {
  if (s.day % WEAR_EVERY !== 0) return;
  const { wear } = s.map;
  const fade = 0.996 ** WEAR_EVERY;
  for (let i = 0; i < wear.length; i++) if (wear[i] > 0.01) wear[i] *= fade; else wear[i] = 0;
  let grid: Float32Array | undefined;
  const costs = () => (grid ??= buildCostGrid(s.map, s.buildings));
  const plaza = { x: s.hearth.x, y: s.hearth.y + 1 };
  for (const p of present(s)) {
    if (p.home === undefined || p.sick || p.injured) continue;
    const home = s.buildings[p.home];
    if (!home || home.removed) continue;
    const door = doorOf(home);
    const site = workSite(s, p);
    const to = site ?? plaza;
    const path = cachedPath(s, costs, door, to);
    if (!path) continue;
    const amount = (site ? 0.012 : 0.005) * WEAR_EVERY;
    for (const i of path) wear[i] += amount;
  }
}
