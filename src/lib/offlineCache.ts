/**
 * Offline support, step 3: a tiny promise-based key/value store on top of
 * IndexedDB. One database, one object store. No dependency — the whole
 * surface we need is get / set / del.
 *
 * Everything is best-effort: a private window, disabled storage, a quota
 * error, or IndexedDB being missing all resolve to `null` / a no-op
 * rather than throwing. Callers must treat a cache miss as normal.
 *
 * What we cache (see callers):
 *   user:<userId>   → the hydrateUserData() result, so a signed-in person
 *                     can open the app offline instead of being bounced to
 *                     the sign-in screen.
 *   plan:<planId>   → a shared Crew Plan fetched by id, so a crew member
 *                     can view it at a no-service aid station.
 *   weather:<planId>→ the resolved per-station weather for that plan.
 *
 * Segment images (as Blobs) and an explicit "Save for offline" control
 * come in later slices of the offline spec.
 */

const DB_NAME = 'trg-offline';
const DB_VERSION = 1;
const STORE = 'kv';

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') {
      resolve(null);
      return;
    }
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) {
          req.result.createObjectStore(STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

/** Wrapper for a snapshot: the value plus when it was written. */
export interface Cached<T> {
  value: T;
  cachedAt: number;
}

export async function cacheGet<T>(key: string): Promise<Cached<T> | null> {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = () => {
        const v = req.result;
        resolve(v && typeof v === 'object' && 'value' in v ? (v as Cached<T>) : null);
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function cacheSet<T>(key: string, value: T): Promise<void> {
  const db = await openDb();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put({ value, cachedAt: Date.now() } satisfies Cached<T>, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function cacheDel(key: string): Promise<void> {
  const db = await openDb();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
}

/** "3 minutes ago", "2 hours ago", "yesterday", "5 days ago". */
export function relativeTime(ts: number, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 45) return 'just now';
  const m = Math.round(s / 60);
  if (m < 45) return `${m} minute${m === 1 ? '' : 's'} ago`;
  const h = Math.round(m / 60);
  if (h < 22) return `${h} hour${h === 1 ? '' : 's'} ago`;
  const d = Math.round(h / 24);
  if (d === 1) return 'yesterday';
  if (d < 30) return `${d} days ago`;
  const mo = Math.round(d / 30);
  return `${mo} month${mo === 1 ? '' : 's'} ago`;
}
