/**
 * Offline cache for telemetry sessions using IndexedDB.
 * Allows replay and analysis of previously fetched sessions without network.
 */

const DB_NAME = 'pitcrew-cache';
const DB_VERSION = 1;
const STORE_SESSIONS = 'sessions';
const STORE_FRAMES = 'frames';

export interface CachedSession {
  sessionId: string;
  index: unknown;
  cachedAt: number;
}

export interface CachedFrames {
  sessionId: string;
  frames: unknown[];
  cachedAt: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    return Promise.reject(new Error('IndexedDB not supported'));
  }

  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_SESSIONS)) {
        db.createObjectStore(STORE_SESSIONS, { keyPath: 'sessionId' });
      }
      if (!db.objectStoreNames.contains(STORE_FRAMES)) {
        db.createObjectStore(STORE_FRAMES, { keyPath: 'sessionId' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return dbPromise;
}

export async function cacheSession(sessionId: string, index: unknown): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_SESSIONS, 'readwrite');
      tx.objectStore(STORE_SESSIONS).put({ sessionId, index, cachedAt: Date.now() });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Best effort
  }
}

export async function cacheFrames(sessionId: string, frames: unknown[]): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_FRAMES, 'readwrite');
      tx.objectStore(STORE_FRAMES).put({ sessionId, frames, cachedAt: Date.now() });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Best effort
  }
}

export async function getCachedSession(sessionId: string): Promise<CachedSession | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_SESSIONS, 'readonly');
      const request = tx.objectStore(STORE_SESSIONS).get(sessionId);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  } catch {
    return null;
  }
}

export async function getCachedFrames(sessionId: string): Promise<CachedFrames | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_FRAMES, 'readonly');
      const request = tx.objectStore(STORE_FRAMES).get(sessionId);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  } catch {
    return null;
  }
}

export async function listCachedSessions(): Promise<CachedSession[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_SESSIONS, 'readonly');
      const request = tx.objectStore(STORE_SESSIONS).getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  } catch {
    return [];
  }
}

export async function clearCache(): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_SESSIONS, STORE_FRAMES], 'readwrite');
      tx.objectStore(STORE_SESSIONS).clear();
      tx.objectStore(STORE_FRAMES).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Best effort
  }
}
