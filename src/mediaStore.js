/**
 * Multimedia en IndexedDB (binario). En localStorage solo van referencias `idb:<uuid>`.
 */

const DB_NAME = 'gamecounter_media';
const DB_VERSION = 1;
const STORE = 'blobs';

let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB no disponible'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error || new Error('IndexedDB error'));
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
  });
  return dbPromise;
}

export function isIdbMediaRef(s) {
  return typeof s === 'string' && s.startsWith('idb:') && s.length > 8 && s.length < 96;
}

export function idbKeyFromRef(ref) {
  if (!isIdbMediaRef(ref)) return null;
  return ref.slice(4);
}

export async function putMediaBlob(blob) {
  const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `id_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const rec = { id, blob };
    const req = store.put(rec);
    req.onsuccess = () => resolve(`idb:${id}`);
    req.onerror = () => reject(req.error || new Error('No se pudo guardar el archivo'));
  });
}

export async function getMediaBlob(ref) {
  const id = idbKeyFromRef(ref);
  if (!id) return null;
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(id);
    req.onsuccess = () => {
      const v = req.result;
      resolve(v && v.blob instanceof Blob ? v.blob : null);
    };
    req.onerror = () => reject(req.error || new Error('Lectura IndexedDB'));
  });
}

export async function deleteMediaRef(ref) {
  const id = idbKeyFromRef(ref);
  if (!id) return;
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const req = tx.objectStore(STORE).delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error || new Error('Borrado IndexedDB'));
  });
}

export async function deleteMediaRefs(refs) {
  if (!refs || !refs.length) return;
  const ids = refs.map(idbKeyFromRef).filter(Boolean);
  if (!ids.length) return;
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    for (const id of ids) {
      store.delete(id);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Borrado IndexedDB'));
  });
}

export async function clearAllMediaBlobs() {
  if (typeof indexedDB === 'undefined') return;
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const req = tx.objectStore(STORE).clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error || new Error('Clear IndexedDB'));
  });
}

/** Data URL para export JSON o canvas. */
export async function refToDataUrl(ref) {
  if (typeof ref !== 'string') return null;
  if (ref.startsWith('data:')) return ref;
  const blob = await getMediaBlob(ref);
  if (!blob) return null;
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(typeof r.result === 'string' ? r.result : null);
    r.onerror = () => reject(new Error('readAsDataURL'));
    r.readAsDataURL(blob);
  });
}

/** Object URL para <img> o Audio; el llamador debe hacer revokeObjectURL cuando toque. */
export async function refToObjectURL(ref) {
  if (typeof ref !== 'string') return null;
  if (ref.startsWith('data:') || ref.startsWith('blob:')) return ref;
  const blob = await getMediaBlob(ref);
  if (!blob) return null;
  return URL.createObjectURL(blob);
}

export function collectIdbRefsFromMatch(m) {
  const out = [];
  if (!m || typeof m !== 'object') return out;
  for (const k of ['teamAImage', 'teamBImage', 'teamAAudio', 'teamBAudio']) {
    const v = m[k];
    if (isIdbMediaRef(v)) out.push(v);
  }
  return out;
}

export function collectIdbRefsFromTeam(t) {
  const out = [];
  if (!t || typeof t !== 'object') return out;
  for (const k of ['image', 'audio']) {
    const v = t[k];
    if (isIdbMediaRef(v)) out.push(v);
  }
  return out;
}
