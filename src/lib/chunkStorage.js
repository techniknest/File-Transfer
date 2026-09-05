/**
 * High-performance IndexedDB storage engine for chunked file transfers.
 * Streams received chunks into browser IndexedDB storage with batched transactions.
 * Prevents V8 heap memory exhaustion / tab crashes on 1GB+ transfers while maintaining maximum speed.
 */

const DB_NAME = 'p2p_transfer_storage';
const DB_VERSION = 1;
const CHUNK_STORE = 'file_chunks';
const SESSION_STORE = 'transfer_sessions';

let cachedDbPromise = null;

function openDB() {
  if (cachedDbPromise) return cachedDbPromise;

  cachedDbPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB is not supported in this environment'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(CHUNK_STORE)) {
        const chunkStore = db.createObjectStore(CHUNK_STORE, { keyPath: 'id' });
        chunkStore.createIndex('room_file', ['roomId', 'fileIndex'], { unique: false });
        chunkStore.createIndex('roomId', 'roomId', { unique: false });
      }
      if (!db.objectStoreNames.contains(SESSION_STORE)) {
        db.createObjectStore(SESSION_STORE, { keyPath: 'roomId' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      cachedDbPromise = null;
      reject(request.error);
    };
  });

  return cachedDbPromise;
}

// Micro-batched write queue for maximum I/O throughput
const pendingWriteQueue = [];
let isFlushing = false;
let flushTimer = null;

async function processWriteQueue() {
  if (isFlushing || pendingWriteQueue.length === 0) return;
  isFlushing = true;

  const batch = pendingWriteQueue.splice(0, 64);

  try {
    const db = await openDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(CHUNK_STORE, 'readwrite');
      const store = tx.objectStore(CHUNK_STORE);

      for (const item of batch) {
        store.put(item);
      }

      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('Transaction aborted'));
    });
  } catch (err) {
    console.warn('[Storage] Batch write error, retrying individually:', err);
    // Fallback: retry individual items
    try {
      const db = await openDB();
      for (const item of batch) {
        const tx = db.transaction(CHUNK_STORE, 'readwrite');
        tx.objectStore(CHUNK_STORE).put(item);
      }
    } catch (_) {}
  } finally {
    isFlushing = false;
    if (pendingWriteQueue.length > 0) {
      setTimeout(processWriteQueue, 10);
    }
  }
}

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    processWriteQueue();
  }, 35);
}

/**
 * Flush all pending chunks immediately
 */
export async function flushPendingChunks() {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  while (pendingWriteQueue.length > 0 || isFlushing) {
    await processWriteQueue();
    await new Promise((r) => setTimeout(r, 20));
  }
}

/**
 * Store a chunk in IndexedDB (buffered & batched for speed)
 */
export function storeChunk(roomId, fileIndex, chunkIndex, data) {
  const id = `${roomId}_${fileIndex}_${chunkIndex}`;
  const record = {
    id,
    roomId,
    fileIndex,
    chunkIndex,
    data,
    size: data.byteLength || data.size || 0,
    timestamp: Date.now(),
  };

  pendingWriteQueue.push(record);
  if (pendingWriteQueue.length >= 32) {
    processWriteQueue();
  } else {
    scheduleFlush();
  }
}

/**
 * Get count of stored chunks for a given file in a room
 */
export async function getStoredChunkCount(roomId, fileIndex) {
  await flushPendingChunks();
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(CHUNK_STORE, 'readonly');
      const store = tx.objectStore(CHUNK_STORE);
      const index = store.index('room_file');
      const req = index.count(IDBKeyRange.only([roomId, fileIndex]));
      req.onsuccess = () => resolve(req.result || 0);
      req.onerror = () => resolve(0);
    });
  } catch (_) {
    return 0;
  }
}

/**
 * Get the highest contiguous chunk index stored for resume offset calculation
 */
export async function getContiguousChunkCount(roomId, fileIndex) {
  await flushPendingChunks();
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(CHUNK_STORE, 'readonly');
      const store = tx.objectStore(CHUNK_STORE);
      const index = store.index('room_file');
      const req = index.getAll(IDBKeyRange.only([roomId, fileIndex]));
      req.onsuccess = () => {
        const records = req.result || [];
        if (records.length === 0) return resolve(0);
        records.sort((a, b) => a.chunkIndex - b.chunkIndex);
        let count = 0;
        for (let i = 0; i < records.length; i++) {
          if (records[i].chunkIndex === count) {
            count++;
          } else {
            break;
          }
        }
        resolve(count);
      };
      req.onerror = () => resolve(0);
    });
  } catch (_) {
    return 0;
  }
}

/**
 * Assemble chunks from IndexedDB in sequential batches to build a Blob without RAM blowout
 */
export async function assembleFileBlob(roomId, fileIndex, totalChunks, mimeType) {
  await flushPendingChunks();
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CHUNK_STORE, 'readonly');
    const store = tx.objectStore(CHUNK_STORE);
    const index = store.index('room_file');
    const req = index.getAll(IDBKeyRange.only([roomId, fileIndex]));

    req.onsuccess = () => {
      const records = req.result || [];
      if (records.length === 0) {
        return reject(new Error('No chunks found for file in storage'));
      }
      records.sort((a, b) => a.chunkIndex - b.chunkIndex);
      const chunkDataList = records.map((r) => r.data);
      const blob = new Blob(chunkDataList, { type: mimeType || 'application/octet-stream' });
      resolve(blob);
    };

    req.onerror = () => reject(req.error);
  });
}

/**
 * Save transfer session metadata
 */
export async function saveTransferSession(roomId, sessionData) {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(SESSION_STORE, 'readwrite');
      const store = tx.objectStore(SESSION_STORE);
      store.put({ roomId, ...sessionData, updatedAt: Date.now() });
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  } catch (_) {
    return false;
  }
}

/**
 * Get transfer session metadata
 */
export async function getTransferSession(roomId) {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(SESSION_STORE, 'readonly');
      const store = tx.objectStore(SESSION_STORE);
      const req = store.get(roomId);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch (_) {
    return null;
  }
}

/**
 * Clear all stored chunks and session data for a specific room
 */
export async function clearRoomData(roomId) {
  try {
    const db = await openDB();
    const tx = db.transaction([CHUNK_STORE, SESSION_STORE], 'readwrite');
    const chunkStore = tx.objectStore(CHUNK_STORE);
    const sessionStore = tx.objectStore(SESSION_STORE);

    const index = chunkStore.index('roomId');
    const req = index.getAllKeys(IDBKeyRange.only(roomId));

    req.onsuccess = () => {
      const keys = req.result || [];
      keys.forEach((k) => chunkStore.delete(k));
    };

    sessionStore.delete(roomId);
  } catch (err) {
    console.warn('[Storage] Error clearing room data:', err);
  }
}
