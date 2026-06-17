const DB_NAME = 'PalestraPlayerDB';
const DB_VERSION = 1;
const TRACKS_STORE = 'tracks_binary';

export interface StoredBinary {
  id: string; // trackId
  audioBlob: Blob;
  coverBlob?: Blob | null;
}

export function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(TRACKS_STORE)) {
        db.createObjectStore(TRACKS_STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function storeTrackBinary(id: string, audioBlob: Blob, coverBlob?: Blob | null): Promise<void> {
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(TRACKS_STORE, 'readwrite');
      const store = transaction.objectStore(TRACKS_STORE);
      const request = store.put({ id, audioBlob, coverBlob });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    console.error('Error storing binary to IndexedDB:', e);
  }
}

export async function getTrackBinary(id: string): Promise<StoredBinary | null> {
  try {
    const db = await openDatabase();
    return await new Promise<StoredBinary | null>((resolve, reject) => {
      const transaction = db.transaction(TRACKS_STORE, 'readonly');
      const store = transaction.objectStore(TRACKS_STORE);
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    console.error('Error getting binary from IndexedDB:', e);
    return null;
  }
}

export async function deleteTrackBinary(id: string): Promise<void> {
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(TRACKS_STORE, 'readwrite');
      const store = transaction.objectStore(TRACKS_STORE);
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    console.error('Error deleting binary from IndexedDB:', e);
  }
}
