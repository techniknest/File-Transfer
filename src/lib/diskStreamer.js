/**
 * Direct-to-Disk Streaming Engine using File System Access API
 * Streams WebRTC binary chunks directly to the user's local disk/folder.
 * Zero RAM accumulation, no heap exhaustion, and native resume support.
 */

const CHUNK_SIZE = 64 * 1024; // 64KB

export function isDiskStreamingSupported() {
  return typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function';
}

/**
 * Prompt user to select a destination directory on their local filesystem
 */
export async function pickDownloadDirectory() {
  if (!isDiskStreamingSupported()) {
    throw new Error('Direct-to-disk streaming is not supported in this browser. Falling back to in-memory/IndexedDB.');
  }
  return await window.showDirectoryPicker({
    mode: 'readwrite',
    startIn: 'downloads',
  });
}

/**
 * Check if a file already exists in the selected folder, and calculate contiguous resume offset
 */
export async function checkExistingFileOnDisk(dirHandle, fileName) {
  if (!dirHandle) return { exists: false, size: 0, completedChunks: 0, resumeBytes: 0 };
  try {
    const fileHandle = await dirHandle.getFileHandle(fileName, { create: false });
    const file = await fileHandle.getFile();
    const size = file.size || 0;
    const completedChunks = Math.floor(size / CHUNK_SIZE);
    return {
      exists: true,
      size,
      completedChunks,
      resumeBytes: completedChunks * CHUNK_SIZE,
    };
  } catch (_) {
    return { exists: false, size: 0, completedChunks: 0, resumeBytes: 0 };
  }
}

/**
 * Open a streaming writable for a file on disk, seeking to the resume offset if partially received
 */
export async function openDiskWriter(dirHandle, fileName, startByteOffset = 0) {
  if (!dirHandle) throw new Error('No directory selected');

  const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
  const writable = await fileHandle.createWritable({ keepExistingData: startByteOffset > 0 });

  if (startByteOffset > 0) {
    await writable.seek(startByteOffset);
  }

  return writable;
}

/**
 * Write a binary chunk directly to disk
 */
export async function writeChunkToDisk(writable, chunkData) {
  if (!writable) return;
  await writable.write(chunkData);
}

/**
 * Finalize and close the writable stream on disk
 */
export async function closeDiskWriter(writable) {
  if (!writable) return;
  try {
    await writable.close();
  } catch (err) {
    console.warn('[DiskStreamer] Error closing writable stream:', err);
  }
}
