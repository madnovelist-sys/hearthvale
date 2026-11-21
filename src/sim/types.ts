// Core data model for the city simulation. Everything here is plain JSON so a
// whole city can be saved, exported and reloaded exactly.
import type { RngState } from './rng';

/** One focus hour is one city year: 360 days, so one city day is 10 focus seconds. */
export const DAYS_PER_YEAR = 360;
export const DAYS_PER_SEASON = 90;
export const FOCUS_MS_PER_DAY = 3_600_000 / DAYS_PER_YEAR;

export const SEASONS = ['Spring', 'Summer', 'Autumn', 'Winter'] as const;
export type SeasonName = (typeof SEASONS)[number];

export type Sex = 'f' | 'm';
export type Orientation = 'straight' | 'gay' | 'bi';

export type TraitId =
  | 'brave' | 'timid'
  | 'curious'
  | 'kind' | 'cruel'
  | 'greedy' | 'generous'
  | 'pious' | 'skeptical'
  | 'ambitious' | 'content'
  | 'diligent' | 'lazy'
  | 'cheerful' | 'gloomy'
  | 'restless' | 'homebody'
  | 'clever'
  | 'strong' | 'frail'
  | 'gregarious' | 'shy'
  | 'honest' | 'cunning'
  | 'stubborn';

export type JobId =
  | 'farmer' | 'gatherer' | 'fisher' | 'woodcutter' | 'builder'
  | 'potter' | 'smith' | 'healer' | 'herder' | 'elder' | 'child' | 'none';

export type DreamId = 'love' | 'family' | 'sea' | 'treasure' | 'house' | 'craft' | 'remembered' | 'lead';
export type Origin = 'founder' | 'arrival' | 'born' | 'patron' | 'returned';

export interface Look { skin: number; hair: number }

export interface Person {
  id: number;
  first: string;
  family: string;
  sex: Sex;
  orientation: Orientation;
  born: number;
  alive: boolean;
  died?: number;
  cause?: string;
  traits: TraitId[];
  skill: JobId;
  job: JobId;
  jobSince: number;
  dream: DreamId;
  dreamMet?: boolean;
  origin: Origin;
  backstory?: string;
  /** Created by the player through the Create a Settler act. */
  patron?: boolean;
  /** Descended from a player-created settler. */
  lineage?: boolean;
  spouse?: number;
  widowed?: number; // day they were widowed
  courting?: { with: number; since: number; until: number };
  parents: number[];
  children: number[];
  home?: number;
  health: number;
  sick?: { until: number; severity: number; plague?: boolean };
  injured?: { until: number };
  pregnant?: { due: number; father: number };
  /** Quest id while away from the settlement. */
  away?: number;
  /** Never came back from a quest (may still return one day). */
  lost?: boolean;
  /** Moved away for good (alive elsewhere, but no longer part of the settlement). */
  left?: boolean;
  /** Promised to a quest that departs at dawn. */
  preparing?: boolean;
  blessedUntil?: number;
  mood: number;
  renown: number;
  nickname?: string;
  followed?: boolean;
  look: Look;
  memories: number[];
  /** Faith id, if they hold one. */
  faith?: number;
}

export type BuildingKind =
  | 'hearth' | 'stone' | 'tent' | 'leanto' | 'hut' | 'house' | 'bighouse' | 'hall'
  | 'granary' | 'kiln' | 'furnace' | 'shrine' | 'well' | 'dock' | 'stall'
  | 'field' | 'graveyard' | 'pen';

export interface Building {
  id: number;
  kind: BuildingKind;
  x: number;
  y: number;
  w: number;
  h: number;
  built: boolean;
  progress: number;
  required: number;
  variant: number;
  founded: number;
  completed?: number;
  /** People who move in when it's finished. */
  forPeople?: number[];
  /** Farmer who works this field. */
  worker?: number;
  /** Building this one replaces when finished (an upgrade in place). */
  replaces?: number;
  removed?: boolean;
  /** Burning until this day. */
  burning?: number;
  /** A burned-out shell. */
  burned?: boolean;
  /** Businesses have names and owners. */
  name?: string;
  owner?: number;
  /** Goats and sheep in an animal pen. */
  herd?: number;
  /** Day the herd was last culled in a hunger. */
  culled?: number;
}

export type ItemKind = 'blade' | 'torc' | 'ring' | 'bowl' | 'comb' | 'cloak' | 'flute' | 'mask' | 'stone' | 'disc';
export interface ItemEvent { day: number; person?: number; how: 'made' | 'found' | 'brought' | 'inherited' | 'gift' | 'buried' | 'lost' | 'returned' | 'kept' }
export interface Item {
  id: number;
  name: string;
  kind: ItemKind;
  made: number;
  maker?: number;
  owner?: number;
  /** Kept by the whole settlement when no heir was left. */
  village?: boolean;
  lost?: boolean;
  buried?: boolean;
  history: ItemEvent[];
}

export interface Pet { id: number; kind: 'dog' | 'cat'; name: string; owner?: number; born: number; alive: boolean; died?: number }

export interface Grave { id: number; x: number; y: number; person: number; day: number }

export type QuestKind = 'ruins' | 'city' | 'mountains' | 'sea' | 'wilds';
export interface Quest {
  id: number;
  kind: QuestKind;
  place: string;
  leader: number;
  members: number[];
  departed: number;
  due: number;
  patron: boolean;
  resolved?: boolean;
  outcome?: string;
}

/** A newcomer who hasn't arrived yet (an arrival option or a player-made settler). */
export interface PersonDraft {
  first: string;
  family: string;
  sex: Sex;
  orientation: Orientation;
  age: number;
  traits: TraitId[];
  skill: JobId;
  dream: DreamId;
  backstory?: string;
  patron?: boolean;
  /** Index of their spouse within the same party. */
  spouseOf?: number;
  /** Indexes of their parents within the same party. */
  parentsIdx?: number[];
}

export interface Party { id: number; story: string; people: PersonDraft[] }

export type PendingAct =
  | { kind: 'party'; party: Party; patron?: boolean }
  | { kind: 'quest'; leader: number; members: number[]; questKind: QuestKind };

export type EntryKind =
  | 'founding' | 'arrival' | 'birth' | 'death' | 'wedding' | 'courtship' | 'parting'
  | 'comingOfAge' | 'illness' | 'recovery' | 'injury' | 'hunger' | 'harvest' | 'build'
  | 'departure' | 'return' | 'lost' | 'omen' | 'stage' | 'patron' | 'dream' | 'orphan'
  | 'season' | 'naming' | 'leader' | 'law' | 'faith' | 'plague' | 'fire' | 'petition' | 'fortune' | 'business';

export type LawId = 'share-harvest' | 'open-gates' | 'fever-huts' | 'feast-days' | 'work-dawn' | 'no-blades' | 'elders-voice' | 'tithe';
export interface Law { id: LawId; since: number; by: number; patron?: boolean }
export interface Leader { person: number; since: number }

export type TenetId = 'hearth' | 'ancestors' | 'river' | 'peace' | 'feasting' | 'austerity' | 'comet' | 'relics';
export interface Faith { id: number; name: string; founder: number; founded: number; tenets: TenetId[]; season: number; parent?: number; gone?: boolean }

export type PetitionKind = 'heal' | 'return' | 'child' | 'harvest' | 'plague' | 'fire';
export interface Petition { id: number; day: number; from: number; kind: PetitionKind; target?: number; text: string; cost: number; expires: number }

export interface Plague { name: string; since: number; lastCase: number; cases: number; deaths: number }

export type FortuneId = 'master' | 'healer' | 'treasure' | 'harvest' | 'builder' | 'feast' | 'prophet';
export interface FortuneOffer { id: number; options: FortuneId[] }

export interface Entry {
  id: number;
  day: number;
  kind: EntryKind;
  /** Text with name tokens: {p:12} renders as a clickable full name, {f:12} as a first name. */
  text: string;
  people: number[];
  /** How dramatic this was, 1–10. The year is named after its weightiest event. */
  weight: number;
  yearName?: string;
}

export const TERRAIN = { GRASS: 0, SAND: 1, ROCK: 2, WATER: 3, DEEP: 4, MARSH: 5 } as const;
export const TREE = { NONE: 0, BROADLEAF: 1, PINE: 2, FRUIT: 3, BUSH: 4, BOULDER: 5, STUMP: 6 } as const;

export interface MapData {
  w: number;
  h: number;
  terrain: number[];
  trees: number[];
  /** Footsteps; enough wear turns grass into a dirt path. */
  wear: number[];
  /** Building id + 1 on each occupied tile, 0 if free. */
  occ: number[];
  fertility: number[];
  /** Trees: 0..1 while growing (1 = grown). Stumps: the day they were felled. */
  growth: number[];
  /** Wood left in each tree. */
  wood: number[];
}

export type Stage = 'settlement' | 'village' | 'town' | 'city' | 'metropolis';
export type Era = 'bronze' | 'iron' | 'stone-timber' | 'sail-dome' | 'steam' | 'electric' | 'glass';

export interface Settings {
  /** 0 = gentle, 50 = balanced, 100 = grim. */
  darkness: number;
  /** 0 = historical ... 4 = fantastical. */
  weirdness: number;
  /** Pause a session after this many minutes away from the computer (0 = never). Mac app only. */
  awayMinutes: number;
  /** System notifications for Sparks and the daily goal. */
  notify: boolean;
  /** Day and night follow the real clock, or the city's own days (one per 15 minutes of work). */
  dayNight: 'clock' | 'city';
  /** End a running session automatically at this local time ("18:00"), or never. */
  stopAt: string | null;
}

export interface Goals {
  /** How progress is measured: time worked, or words written. */
  track: 'time' | 'words';
  dailyMinutes: number;
  dailyWords: number;
  sparkMinutes: number;
  sparkWords: number;
}

export interface FocusDay { ms: number; words: number; goalMet: boolean; sparks: number }

export interface SessionRecord {
  start: number;
  end: number;
  ms: number;
  words: number;
  fromDay: number;
  toDay: number;
  firstEntry: number;
  sparks: number;
  favor: number;
}

export interface RunningSession {
  startedAt: number;
  lastTickAt: number;
  /** Focus time counted so far in this session. */
  ms: number;
  fromDay: number;
  firstEntry: number;
  sparks: number;
  favor: number;
}

export interface Focus {
  running: RunningSession | null;
  carryMs: number;
  sparkMs: number;
  sparkWords: number;
  totalMs: number;
  days: Record<string, FocusDay>;
  sessions: SessionRecord[];
}

export interface GameState {
  version: number;
  seed: number;
  rng: RngState;
  name: string;
  stage: Stage;
  age: { name: string; era: Era; since: number };
  day: number;
  map: MapData;
  hearth: { x: number; y: number };
  people: Person[];
  buildings: Building[];
  graves: Grave[];
  quests: Quest[];
  chronicle: Entry[];
  yearNames: Record<number, string>;
  playerNamedYears: Record<number, boolean>;
  stores: { food: number; wood: number; goods: number };
  favor: number;
  /** Groups of three parties waiting at the gate, one group per Spark. */
  arrivals: Party[][];
  pending: PendingAct[];
  goals: Goals;
  settings: Settings;
  focus: Focus;
  nextId: { person: number; building: number; entry: number; quest: number; grave: number; party: number; faith: number; petition: number; fortune: number; pet: number; item: number };
  flags: {
    hungerSince?: number;
    coldSince?: number;
    /** This year's harvest quality, 0.55–1.35. */
    harvest?: number;
    graveyard?: number;
    relics: number;
    knowledge: number;
    lastDeparture?: number;
    /** The last few kinds of everyday moment, so they don't repeat. */
    recentMoments?: number[];
    /** Things that might inspire a new faith: omens, relics, answered prayers. */
    faithSeeds?: number;
    /** What inspired the most recent seed. */
    faithSeedKind?: TenetId;
    /** A travelling healer's lessons last until this day. */
    healerUntil?: number;
    /** A Fortune promised a bumper harvest. */
    harvestBoost?: boolean;
    /** Grown trees in the near woods at the start, and which thinning the Chronicle has noted. */
    forestStart?: number;
    forestNotice?: number;
    /** Day a fire last left a family homeless (one Chronicle line per fire). */
    lastFireLoss?: number;
    /** A Fortune made the next Raise a Prophet free. */
    freeProphet?: boolean;
  };
  lateReturns: { person: number; day: number }[];
  leader?: Leader;
  laws: Law[];
  faiths: Faith[];
  petitions: Petition[];
  plague?: Plague;
  fortunes: FortuneOffer[];
  pets: Pet[];
  wild: { deer: number };
  items: Item[];
}
