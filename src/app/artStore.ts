// Art dropped into the test scene is kept on this computer (IndexedDB) and
// loaded on startup, so it shows in the city until real files replace it.
import { setOverride, type Sprite } from '../render/sprites';

interface StoredArt { dataUrl: string; ax: number; ay: number; tilePx: number }

function db(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('hearthwork-art', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('art');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const d = await db();
  return new Promise((resolve, reject) => {
    const t = d.transaction('art', mode);
    const r = fn(t.objectStore('art'));
    t.oncomplete = () => { d.close(); resolve(r.result); };
    t.onerror = () => { d.close(); reject(t.error); };
  });
}

export async function saveArt(key: string, dataUrl: string, s: Sprite) {
  try { await tx('readwrite', (st) => st.put({ dataUrl, ax: s.ax, ay: s.ay, tilePx: s.tilePx } satisfies StoredArt, key)); } catch { /* storage unavailable */ }
}

export async function deleteArt(key: string) {
  try { await tx('readwrite', (st) => st.delete(key)); } catch { /* ignore */ }
}

export async function loadStoredArt() {
  try {
    const keys = await tx<IDBValidKey[]>('readonly', (st) => st.getAllKeys());
    for (const key of keys) {
      const a = await tx<StoredArt | undefined>('readonly', (st) => st.get(key));
      if (!a) continue;
      const img = new Image();
      img.src = a.dataUrl;
      await img.decode();
      setOverride(String(key), { img, w: img.naturalWidth, h: img.naturalHeight, ax: a.ax, ay: a.ay, tilePx: a.tilePx, lights: [], smoke: [], real: true });
    }
  } catch { /* nothing stored */ }
}
