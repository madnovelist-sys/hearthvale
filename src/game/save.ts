// Saving. A city can hold hundreds of hours of someone's work, so it's saved
// often, backed up daily, and can be exported to a file at any time.
import type { GameState } from '../sim/types';
import { SAVE_VERSION } from '../sim/sim';

const DB_NAME = 'hearthwork';
const STORE = 'saves';
const CURRENT = 'current';
const BACKUPS_KEPT = 7;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    tx.oncomplete = () => { db.close(); resolve(req.result); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

const backupKey = (date: string) => `backup:${date}`;

export async function saveGame(s: GameState, date: string): Promise<void> {
  const json = JSON.stringify(s);
  try {
    await withStore('readwrite', (st) => st.put(json, CURRENT));
    const key = backupKey(date);
    const existing = await withStore<IDBValidKey[]>('readonly', (st) => st.getAllKeys());
    if (!existing.includes(key)) {
      await withStore('readwrite', (st) => st.put(json, key));
      const backups = existing.filter((k) => String(k).startsWith('backup:')).map(String).sort();
      for (const old of backups.slice(0, Math.max(0, backups.length + 1 - BACKUPS_KEPT))) {
        await withStore('readwrite', (st) => st.delete(old));
      }
    }
  } catch {
    // Storage unavailable (private window, blocked site data): fall back to localStorage.
    try { localStorage.setItem('hearthwork:current', json); } catch { /* nowhere left to save */ }
  }
}

export async function loadGame(): Promise<GameState | null> {
  let json: string | undefined;
  try {
    json = await withStore<string | undefined>('readonly', (st) => st.get(CURRENT));
  } catch { /* fall through */ }
  if (!json) {
    try { json = localStorage.getItem('hearthwork:current') ?? undefined; } catch { /* none */ }
  }
  if (!json) return null;
  return parseSave(json);
}

export async function listBackups(): Promise<string[]> {
  try {
    const keys = await withStore<IDBValidKey[]>('readonly', (st) => st.getAllKeys());
    return keys.map(String).filter((k) => k.startsWith('backup:')).map((k) => k.slice(7)).sort().reverse();
  } catch {
    return [];
  }
}

export async function loadBackup(date: string): Promise<GameState | null> {
  const json = await withStore<string | undefined>('readonly', (st) => st.get(backupKey(date)));
  return json ? parseSave(json) : null;
}

export async function deleteSave(): Promise<void> {
  try { await withStore('readwrite', (st) => st.delete(CURRENT)); } catch { /* ignore */ }
  try { localStorage.removeItem('hearthwork:current'); } catch { /* ignore */ }
}

export function parseSave(json: string): GameState {
  const data = JSON.parse(json) as GameState;
  if (!data || typeof data !== 'object' || !Array.isArray(data.people) || !data.map) {
    throw new Error("This file doesn't look like a Hearthwork save.");
  }
  if (data.version > SAVE_VERSION) throw new Error('This save comes from a newer version of Hearthwork.');
  return migrate(data);
}

function migrate(s: GameState): GameState {
  // Version 1 is the first format; future versions upgrade older saves here.
  s.flags ??= { relics: 0, knowledge: 0 };
  s.lateReturns ??= [];
  s.pending ??= [];
  s.arrivals ??= [];
  s.goals.track ??= 'time';
  return s;
}

export function exportGame(s: GameState): void {
  const blob = new Blob([JSON.stringify(s)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `hearthwork-${s.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function importGame(file: File): Promise<GameState> {
  return parseSave(await file.text());
}
