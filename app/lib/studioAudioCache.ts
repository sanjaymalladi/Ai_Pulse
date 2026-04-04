/**
 * Persists TTS WAV in IndexedDB so audio survives refresh on Vercel
 * (serverless cannot write durable files under public/).
 */

const DB_NAME = "studio_audio_v1";
const STORE = "blobs";
const TTS_KEY = "tts_output";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE);
    };
  });
}

export async function saveStudioTtsAudio(blob: Blob): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => reject(tx.error);
    tx.objectStore(STORE).put(blob, TTS_KEY);
  });
}

export async function loadStudioTtsAudio(): Promise<Blob | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const r = tx.objectStore(STORE).get(TTS_KEY);
    r.onsuccess = () => {
      db.close();
      resolve((r.result as Blob | undefined) ?? null);
    };
    r.onerror = () => reject(r.error);
  });
}

export async function clearStudioTtsAudio(): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => reject(tx.error);
    tx.objectStore(STORE).delete(TTS_KEY);
  });
}
