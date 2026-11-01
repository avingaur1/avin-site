/**
 * Unpublished changes are kept in this browser (IndexedDB), photos included,
 * so closing the tab or losing signal never loses work.
 */
export type PendingUpload = { path: string; blob: Blob; width: number; height: number; /** name|size|modified of the original file */ key?: string };

export type Draft = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
  uploads: PendingUpload[];
  /** sha of site.json the draft started from */
  baseSha: string;
  savedAt: number;
};

const DB = "avin-editor";
const STORE = "drafts";
const KEY = "current";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req.result as T);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export async function loadDraft(): Promise<Draft | null> {
  try {
    return (await run<Draft | undefined>("readonly", (s) => s.get(KEY))) ?? null;
  } catch {
    return null;
  }
}

export async function saveDraft(d: Draft) {
  await run("readwrite", (s) => s.put(d, KEY));
}

export async function clearDraft() {
  try {
    await run("readwrite", (s) => s.delete(KEY));
  } catch {}
}
