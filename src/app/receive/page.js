'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useSignaling } from '@/hooks/useSignaling';
import { useWebRTC } from '@/hooks/useWebRTC';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import {
  FileText, FileImage, FileVideo, FileAudio, FileArchive, FileCode, File,
  Zap, Download, Radio, AlertTriangle, CheckCircle, XCircle, Info, Shield, RefreshCw, Folder
} from 'lucide-react';
import { logEvent } from '@/lib/logger';
import {
  storeChunk,
  assembleFileBlob,
  getContiguousChunkCount,
  getTransferSession,
  saveTransferSession,
  clearRoomData,
  flushPendingChunks,
} from '@/lib/chunkStorage';
import {
  isDiskStreamingSupported,
  pickDownloadDirectory,
  checkExistingFileOnDisk,
  openDiskWriter,
  writeChunkToDisk,
  closeDiskWriter,
} from '@/lib/diskStreamer';

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(2)} MB`;
  return `${(bytes / 1073741824).toFixed(2)} GB`;
}

function formatTime(seconds) {
  if (!isFinite(seconds) || seconds <= 0) return '—';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

function getFileIcon(fileName) {
  if (!fileName) return <File />;
  const ext = fileName.split('.').pop()?.toLowerCase();
  const map = {
    pdf: <FileText />, doc: <FileText />, docx: <FileText />, txt: <FileText />, xls: <FileText />, xlsx: <FileText />,
    ppt: <FileText />, pptx: <FileText />, zip: <FileArchive />, rar: <FileArchive />, '7z': <FileArchive />, tar: <FileArchive />,
    mp4: <FileVideo />, mov: <FileVideo />, avi: <FileVideo />, mkv: <FileVideo />, mp3: <FileAudio />, wav: <FileAudio />,
    flac: <FileAudio />, jpg: <FileImage />, jpeg: <FileImage />, png: <FileImage />, gif: <FileImage />, svg: <FileImage />,
    webp: <FileImage />, js: <FileCode />, ts: <FileCode />, py: <FileCode />, html: <FileCode />, css: <FileCode />,
  };
  return map[ext] || <File />;
}

function Toast({ toasts }) {
  return (
    <div style={{ position: 'fixed', top: '1.5rem', right: '1.5rem', zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '0.5rem', maxWidth: '320px' }}>
      {toasts.map((t) => (
        <div key={t.id} style={{
          background: t.type === 'error' ? 'rgba(239,68,68,0.15)' : t.type === 'success' ? 'rgba(16,185,129,0.15)' : t.type === 'warning' ? 'rgba(245,158,11,0.15)' : 'rgba(99,102,241,0.15)',
          border: `1px solid ${t.type === 'error' ? 'rgba(239,68,68,0.4)' : t.type === 'success' ? 'rgba(16,185,129,0.4)' : t.type === 'warning' ? 'rgba(245,158,11,0.4)' : 'rgba(99,102,241,0.4)'}`,
          borderRadius: '0.75rem', padding: '0.75rem 1rem',
          backdropFilter: 'blur(12px)',
          color: 'white', fontSize: '0.875rem', fontWeight: 500,
          animation: 'slideInRight 0.3s ease',
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
        }}>
          <span>{t.type === 'error' ? <XCircle size={16} /> : t.type === 'success' ? <CheckCircle size={16} /> : t.type === 'warning' ? <AlertTriangle size={16} /> : <Info size={16} />}</span>
          {t.message}
        </div>
      ))}
    </div>
  );
}

function Spinner({ color = '#10b981', size = 48, thickness = 3 }) {
  return (
    <div style={{
      width: size, height: size,
      border: `${thickness}px solid rgba(255,255,255,0.08)`,
      borderTop: `${thickness}px solid ${color}`,
      borderRadius: '50%',
      animation: 'spin 0.9s linear infinite',
      margin: '0 auto',
    }} />
  );
}

export default function ReceivePage() {
  const { data: session } = useSession();
  const [status, setStatus] = useState('idle'); // idle | connecting | waiting-permission | receiving | disconnected-waiting | done | invalid | full | error
  const [roomId, setRoomId] = useState('');
  const [manualLink, setManualLink] = useState('');
  const [prefilledRoomId, setPrefilledRoomId] = useState('');
  const [receivedFiles, setReceivedFiles] = useState([]);
  const [toasts, setToasts] = useState([]);
  const [errorMessage, setErrorMessage] = useState('');
  // Bytes already received before this session (for resume-from display)
  const [resumeFromBytes, setResumeFromBytes] = useState(0);

  const signaling = useSignaling();
  const { createAnswerWithIce, addCandidate, close: closeWebRTC } = useWebRTC();

  const [stats, setStats] = useState({
    progress: 0,
    currentFile: '',
    speed: 0,
    eta: 0,
    totalFiles: 0,
    receivedCount: 0,
    totalBytes: 0,
    receivedBytes: 0,
  });

  const metaRef = useRef(null);
  const roomIdRef = useRef('');
  const trackRef = useRef({ totalBytes: 0, receivedBytes: 0, lastTime: Date.now(), lastBytes: 0 });
  const filesRef = useRef([]);
  const initializedRef = useRef(false);
  // Holds the setInterval ID for the periodic server-side progress heartbeat
  const heartbeatRef = useRef(null);

  // Direct-to-Disk streaming state (File System Access API)
  const [folderName, setFolderName] = useState('');
  const dirHandleRef = useRef(null);
  const currentDiskWriterRef = useRef(null);
  const diskOffsetsRef = useRef({});

  const addToast = useCallback((message, type = 'info', duration = 3500) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), duration);
  }, []);

  const handleSelectFolder = useCallback(async () => {
    try {
      const dir = await pickDownloadDirectory();
      dirHandleRef.current = dir;
      setFolderName(dir.name);
      addToast(`Download folder: ${dir.name}. Files will stream directly to disk with zero RAM load!`, 'success', 4000);
      return dir;
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.warn('Folder selection error:', err);
      }
      return null;
    }
  }, [addToast]);

  // Periodically PATCH our chunk progress to the server so the room's
  // receiverLastActivity stays fresh and resume offsets are server-persisted.
  const startHeartbeat = useCallback((targetRoomId, clientId, getResumeOffsets) => {
    if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    heartbeatRef.current = setInterval(async () => {
      try {
        const progress = await getResumeOffsets();
        if (Object.keys(progress).length === 0) return;
        await fetch(`/api/rooms/${encodeURIComponent(targetRoomId)}/progress`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientId, progress }),
        });
      } catch (_) {}
    }, 8000); // ping every 8s
  }, []);

  const stopHeartbeat = useCallback(() => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
  }, []);

  const handleSetupDataChannel = useCallback((dc) => {
    dc.binaryType = 'arraybuffer';
    console.log('[WebRTC] DataChannel connected — stopping signaling polling:', dc.label);
    signaling.stopPolling();
    setStatus('receiving');
    addToast('Transfer connection active!', 'success');

    dc.onmessage = async (ev) => {
      if (typeof ev.data === 'string') {
        let msg;
        try {
          msg = JSON.parse(ev.data);
        } catch {
          return;
        }

        if (msg.type === 'session-info') {
          trackRef.current.totalBytes = msg.totalBytes || 0;
          setStats((prev) => ({
            ...prev,
            totalFiles: msg.totalFiles || 0,
            totalBytes: msg.totalBytes || 0,
          }));
          saveTransferSession(roomIdRef.current, { totalFiles: msg.totalFiles, totalBytes: msg.totalBytes });
        }

        if (msg.type === 'meta') {
          metaRef.current = msg;
          setStats((prev) => ({ ...prev, currentFile: msg.fileName }));

          // Open disk writable directly if folder selected (zero RAM usage!)
          if (dirHandleRef.current) {
            try {
              const startByteOffset = (diskOffsetsRef.current[msg.fileIndex] || 0) * 64 * 1024;
              currentDiskWriterRef.current = await openDiskWriter(
                dirHandleRef.current,
                msg.fileName,
                startByteOffset
              );
              console.log(`[DiskStreamer] Streaming directly to disk: ${msg.fileName} (offset: ${startByteOffset} bytes)`);
            } catch (err) {
              console.warn('[DiskStreamer] Could not open disk writer, falling back to IndexedDB:', err);
              currentDiskWriterRef.current = null;
            }
          }

          logEvent({
            eventType: 'receiver_file_start',
            level: 'info',
            category: 'transfer',
            roomId: roomIdRef.current,
            message: `Receiver receiving file: ${msg.fileName} (${formatBytes(msg.fileSize)})`,
            metadata: msg,
          });
        }

        if (msg.type === 'file-end') {
          const meta = metaRef.current;
          if (!meta) return;

          const fIdx = msg.fileIndex ?? 0;

          if (currentDiskWriterRef.current) {
            // Finalize direct-to-disk write
            await closeDiskWriter(currentDiskWriterRef.current);
            currentDiskWriterRef.current = null;

            const fileEntry = {
              name: meta.fileName,
              url: null,
              size: meta.fileSize,
              expectedSize: meta.fileSize,
              isComplete: true,
              isDirectToDisk: true,
            };

            filesRef.current = [...filesRef.current, fileEntry];
            setReceivedFiles([...filesRef.current]);
            setStats((prev) => ({ ...prev, receivedCount: prev.receivedCount + 1 }));
            addToast(`Saved to folder: ${meta.fileName}`, 'success', 5000);

            logEvent({
              eventType: 'receiver_file_completed',
              level: 'success',
              category: 'transfer',
              roomId: roomIdRef.current,
              message: `File saved directly to disk: ${meta.fileName} (${formatBytes(meta.fileSize)})`,
              metadata: { fileName: meta.fileName, size: meta.fileSize },
            });
          } else {
            try {
              await flushPendingChunks();
              // Assemble blob safely from IndexedDB without memory explosion
              const blob = await assembleFileBlob(roomIdRef.current, fIdx, msg.totalChunks, meta.fileType);
              const blobUrl = URL.createObjectURL(blob);

              console.log(`[DATA] Assembled file ${meta.fileName}: ${blob.size} bytes (Expected: ${meta.fileSize} bytes)`);

              const fileEntry = {
                name: meta.fileName,
                url: blobUrl,
                size: blob.size,
                expectedSize: meta.fileSize,
                isComplete: blob.size >= meta.fileSize,
              };

              filesRef.current = [...filesRef.current, fileEntry];
              setReceivedFiles([...filesRef.current]);
              setStats((prev) => ({ ...prev, receivedCount: prev.receivedCount + 1 }));
              addToast(`Received: ${meta.fileName} (${formatBytes(blob.size)})`, 'success', 5000);

              logEvent({
                eventType: 'receiver_file_completed',
                level: 'success',
                category: 'transfer',
                roomId: roomIdRef.current,
                message: `File download complete: ${meta.fileName} (${formatBytes(blob.size)})`,
                metadata: { fileName: meta.fileName, size: blob.size },
              });

              // Trigger automatic browser download
              setTimeout(() => {
                try {
                  const a = document.createElement('a');
                  a.style.display = 'none';
                  a.href = blobUrl;
                  a.download = meta.fileName;
                  document.body.appendChild(a);
                  a.click();
                  setTimeout(() => {
                    try {
                      document.body.removeChild(a);
                      URL.revokeObjectURL(blobUrl);
                    } catch (_) {}
                  }, 3000);
                } catch (err) {
                  console.warn('[Download] Auto download trigger blocked:', err);
                }
              }, 80);
            } catch (err) {
              console.error('[DATA] Error assembling file from storage:', err);
              addToast(`Error saving file ${meta.fileName}`, 'error');
            }
          }
        }

        if (msg.type === 'session-end') {
          setStatus('done');
          setStats((prev) => ({ ...prev, progress: 100 }));
          addToast('All files successfully transferred!', 'success', 6000);
          stopHeartbeat();
          signaling.stopPolling();

          // Save receiver record to MongoDB transfer history
          try {
            await fetch('/api/transfers', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                roomId: roomIdRef.current,
                receiverEmail: session?.user?.email || 'anonymous',
                files: filesRef.current.map((f) => ({
                  fileName: f.name,
                  fileSize: f.size,
                })),
                totalSize: trackRef.current.totalBytes,
                status: 'completed',
              }),
            });
          } catch (_) {}

          // Clean up chunks from IndexedDB
          clearRoomData(roomIdRef.current);

          logEvent({
            eventType: 'receiver_session_completed',
            level: 'success',
            category: 'transfer',
            roomId: roomIdRef.current,
            message: `All files received successfully in room ${roomIdRef.current}`,
          });
        }
      } else {
        // Binary framed chunk: 4 bytes fileIndex + 4 bytes chunkIndex + chunkPayload
        const dataBuffer = ev.data;
        if (dataBuffer.byteLength >= 8) {
          const view = new DataView(dataBuffer);
          const fileIndex = view.getUint32(0, false);
          const chunkIndex = view.getUint32(4, false);
          const chunkPayload = dataBuffer.slice(8);

          if (currentDiskWriterRef.current) {
            // Stream directly to hard drive with 0 RAM usage!
            writeChunkToDisk(currentDiskWriterRef.current, chunkPayload).catch(() => {});
          } else {
            // Stream into IndexedDB
            storeChunk(roomIdRef.current, fileIndex, chunkIndex, chunkPayload);
          }
          trackRef.current.receivedBytes += chunkPayload.byteLength;
        } else {
          const fIdx = metaRef.current?.fileIndex ?? 0;
          if (currentDiskWriterRef.current) {
            writeChunkToDisk(currentDiskWriterRef.current, dataBuffer).catch(() => {});
          } else {
            storeChunk(roomIdRef.current, fIdx, 0, dataBuffer);
          }
          trackRef.current.receivedBytes += dataBuffer.byteLength;
        }

        const now = Date.now();
        const elapsed = (now - trackRef.current.lastTime) / 1000;
        if (elapsed >= 0.2) {
          const delta = trackRef.current.receivedBytes - trackRef.current.lastBytes;
          const speed = delta / elapsed;
          const remaining = trackRef.current.totalBytes - trackRef.current.receivedBytes;
          const eta = speed > 0 ? remaining / speed : 0;
          const progress =
            trackRef.current.totalBytes > 0
              ? Math.min((trackRef.current.receivedBytes / trackRef.current.totalBytes) * 100, 99.9)
              : 0;

          trackRef.current.lastTime = now;
          trackRef.current.lastBytes = trackRef.current.receivedBytes;

          setStats((prev) => ({
            ...prev,
            progress,
            speed,
            eta,
            receivedBytes: trackRef.current.receivedBytes,
          }));
        }
      }
    };

    dc.onerror = (err) => {
      console.error('[DATA] Error:', err);
      logEvent({
        eventType: 'receiver_datachannel_error',
        level: 'error',
        category: 'webrtc',
        roomId: roomIdRef.current,
        message: `DataChannel error on receiver: ${err.message || 'Unknown channel error'}`,
      });
    };

    dc.onclose = () => {
      console.log('[DATA] Channel closed on Receiver');
      stopHeartbeat();
      // If closed before session-end, don't crash or discard chunks — wait for sender reconnect
      setStatus((prev) => {
        if (prev === 'receiving') {
          addToast('Connection interrupted. Waiting for sender to resume...', 'warning', 6000);
          // Keep signaling polling alive to catch sender-ready
          signaling.startPolling(roomIdRef.current, true);
          return 'disconnected-waiting';
        }
        return prev;
      });
    };
  }, [addToast, signaling, session, startHeartbeat, stopHeartbeat]);

  const connect = useCallback(async (targetRoomId) => {
    if (!targetRoomId) return;
    setToasts([]);
    roomIdRef.current = targetRoomId;
    setRoomId(targetRoomId);
    setStatus('waiting-permission');

    // ── Check if files already exist on disk (Direct-to-Disk) or in IndexedDB ──
    let cachedReceivedBytes = 0;
    const indexedDbOffsets = {};
    diskOffsetsRef.current = {};

    if (dirHandleRef.current) {
      try {
        const roomRes = await fetch(`/api/rooms/${encodeURIComponent(targetRoomId)}`);
        if (roomRes.ok) {
          const roomData = await roomRes.json();
          const rFiles = roomData?.files || [];
          for (let f = 0; f < rFiles.length; f++) {
            const check = await checkExistingFileOnDisk(dirHandleRef.current, rFiles[f].fileName);
            if (check.completedChunks > 0) {
              diskOffsetsRef.current[f] = check.completedChunks;
              cachedReceivedBytes += check.resumeBytes;
            }
          }
        }
      } catch (_) {}
    }

    if (cachedReceivedBytes === 0) {
      try {
        for (let fIdx = 0; fIdx < 10; fIdx++) {
          const count = await getContiguousChunkCount(targetRoomId, fIdx);
          if (count > 0) {
            indexedDbOffsets[fIdx] = count;
            cachedReceivedBytes += count * 64 * 1024;
          }
        }
      } catch (_) {}
    }

    if (cachedReceivedBytes > 0) {
      setResumeFromBytes(cachedReceivedBytes);
    }

    trackRef.current = {
      totalBytes: 0,
      receivedBytes: cachedReceivedBytes,
      lastTime: Date.now(),
      lastBytes: cachedReceivedBytes,
    };
    filesRef.current = [];
    metaRef.current = null;

    // Start polling immediately so we pick up sender-ready if sender is already waiting
    signaling.startPolling(targetRoomId, true);

    logEvent({
      eventType: 'receiver_connect_attempt',
      level: 'info',
      category: 'room',
      roomId: targetRoomId,
      message: `Receiver initiated connection to transfer room: ${targetRoomId}`,
    });

    signaling.off('offer');
    signaling.off('transfer-allow');
    signaling.off('transfer-decline');
    signaling.off('ice-candidate');
    signaling.off('sender-ready');

    let answerCreated = false;

    // Handle sender re-initiating or getting ready (e.g. sender refreshed and reconnected)
    signaling.on('sender-ready', async (readyData) => {
      console.log('[Receiver] Sender ready / reconnected signal received:', readyData);
      answerCreated = false;
      setStatus('waiting-permission');
      addToast('Sender reconnected — re-requesting transfer...', 'info', 3000);

      // Re-read latest offsets from disk (if direct-to-disk) or from IndexedDB
      const resumeOffsets = dirHandleRef.current && Object.keys(diskOffsetsRef.current).length > 0
        ? { ...diskOffsetsRef.current }
        : {};
      if (Object.keys(resumeOffsets).length === 0) {
        try {
          for (let fIdx = 0; fIdx < 10; fIdx++) {
            const count = await getContiguousChunkCount(targetRoomId, fIdx);
            if (count > 0) {
              resumeOffsets[fIdx] = count;
            }
          }
        } catch (_) {}
      }

      // Always send both signals — sender may already be past the transfer-request handler
      await signaling.sendSignal('transfer-request', {
        device: typeof navigator !== 'undefined' ? navigator.userAgent : 'Web Browser',
        receiverEmail: session?.user?.email || 'anonymous',
        resumeOffsets,
        timestamp: Date.now(),
      });
      await signaling.sendSignal('transfer-resume', { resumeOffsets });
    });

    // Handle sender permission approval
    signaling.on('transfer-allow', (allowData) => {
      console.log('[Receiver] Sender allowed transfer:', allowData);
      answerCreated = false;
      setStatus('connecting');
      addToast('Sender approved request! Establishing connection...', 'success');
    });

    // Handle sender declining transfer
    signaling.on('transfer-decline', (declineData) => {
      console.log('[Receiver] Sender declined transfer:', declineData);
      setStatus('declined');
      addToast('Sender declined the transfer request.', 'error', 6000);
    });

    // Trickle ICE: apply sender's ICE candidates as they arrive
    signaling.on('ice-candidate', async (data) => {
      if (data?.from !== 'sender') return;
      await addCandidate(data.candidate);
    });

    signaling.on('offer', async (data) => {
      const offer = data?.offer;
      if (!offer) return;
      if (answerCreated) {
        console.log('[Receiver] Offer already processed, ignoring duplicate offer signal');
        return;
      }
      answerCreated = true;
      setStatus('connecting');
      console.log('[Receiver] Atomic Offer received — generating atomic Answer with ICE candidates');

      logEvent({
        eventType: 'receiver_offer_received',
        level: 'info',
        category: 'webrtc',
        roomId: targetRoomId,
        message: `Receiver received atomic SDP offer from sender for room ${targetRoomId}. Generating atomic answer...`,
      });

      try {
        const { answer } = await createAnswerWithIce(offer, {
          onConnectionStateChange: (state) => {
            console.log('[Receiver] WebRTC Connection State:', state);
            logEvent({
              eventType: 'webrtc_receiver_state_change',
              level: state === 'connected' ? 'success' : state === 'failed' ? 'error' : 'info',
              category: 'webrtc',
              roomId: targetRoomId,
              message: `Receiver WebRTC connection state changed to: ${state}`,
              metadata: { state },
            });
            if (state === 'connected') {
              console.log('[Receiver] Direct P2P tunnel established!');
            } else if (state === 'disconnected' || state === 'failed') {
              setStatus((prev) => {
                if (prev === 'receiving') {
                  addToast('Sender connection interrupted. Waiting for sender to resume...', 'warning', 6000);
                  signaling.startPolling(targetRoomId, true);
                  return 'disconnected-waiting';
                }
                return prev;
              });
            }
          },
          // Trickle ICE: forward receiver's local ICE candidates to sender
          onIceCandidate: async (candidate) => {
            try {
              await signaling.sendSignal('ice-candidate', { candidate, from: 'receiver' });
            } catch (_) {}
          },
          onDataChannel: (dc) => {
            handleSetupDataChannel(dc);
          },
        });

        // Send 1 single atomic Answer (containing all STUN/TURN candidates)
        await signaling.sendSignal('answer', { answer });
        console.log('[Receiver] 1-shot atomic Answer sent');

        logEvent({
          eventType: 'receiver_answer_sent',
          level: 'info',
          category: 'webrtc',
          roomId: targetRoomId,
          message: `Receiver posted 1-shot atomic SDP Answer for room ${targetRoomId}`,
        });
      } catch (err) {
        console.error('[Receiver] Failed to handle offer:', err);
        addToast('WebRTC negotiation failed.', 'error');
        logEvent({
          eventType: 'receiver_negotiation_error',
          level: 'error',
          category: 'webrtc',
          roomId: targetRoomId,
          message: `Receiver failed during WebRTC handshake: ${err.message}`,
          metadata: { stack: err.stack },
        });
      }
    });

    try {
      const joinResult = await signaling.joinRoom(targetRoomId);

      // ── Resume offsets: Use actual contiguous chunks stored on disk or in IndexedDB ──
      const resumeOffsets = dirHandleRef.current && Object.keys(diskOffsetsRef.current).length > 0
        ? { ...diskOffsetsRef.current }
        : { ...indexedDbOffsets };

      // If we picked up server-only progress (no IndexedDB), update bytes estimate
      if (cachedReceivedBytes === 0 && Object.keys(resumeOffsets).length > 0) {
        let serverBytes = 0;
        for (const count of Object.values(resumeOffsets)) {
          serverBytes += count * 64 * 1024;
        }
        if (serverBytes > 0) {
          setResumeFromBytes(serverBytes);
          trackRef.current.receivedBytes = serverBytes;
          trackRef.current.lastBytes = serverBytes;
        }
      }

      const hasResume = Object.keys(resumeOffsets).length > 0;

      // ── Start server heartbeat so room stays "live" and progress is persisted ──
      const clientId = signaling.getClientId();
      const getOffsetsForHeartbeat = async () => {
        const offsets = {};
        try {
          for (let fIdx = 0; fIdx < 10; fIdx++) {
            const count = await getContiguousChunkCount(targetRoomId, fIdx);
            if (count > 0) offsets[fIdx] = count;
          }
        } catch (_) {}
        return offsets;
      };
      startHeartbeat(targetRoomId, clientId, getOffsetsForHeartbeat);

      // ── Send transfer request — always include resumeOffsets ──
      await signaling.sendSignal('transfer-request', {
        device: typeof navigator !== 'undefined' ? navigator.userAgent : 'Web Browser',
        receiverEmail: session?.user?.email || 'anonymous',
        resumeOffsets,
        timestamp: Date.now(),
      });

      // Always also send an explicit transfer-resume signal so sender picks up offsets
      // even if it already saw the transfer-request
      await signaling.sendSignal('transfer-resume', { resumeOffsets });

      if (hasResume) {
        const approxPct = cachedReceivedBytes > 0
          ? `~${Math.round((cachedReceivedBytes / (cachedReceivedBytes + 1)) * 100)}%`
          : 'partial';
        addToast(`Resuming interrupted transfer (${Object.keys(resumeOffsets).length} file(s) partially received)`, 'info', 5000);
      } else {
        addToast('Transfer request sent. Waiting for sender approval...', 'info');
      }

      logEvent({
        eventType: 'receiver_joined_success',
        level: 'success',
        category: 'room',
        roomId: targetRoomId,
        message: `Receiver successfully joined room ${targetRoomId}${
          hasResume ? ` with resume offsets: ${JSON.stringify(resumeOffsets)}` : ''
        }`,
      });
    } catch (err) {
      const msg = err.message || 'Could not connect to room. Please try again.';
      setErrorMessage(msg);
      logEvent({
        eventType: 'receiver_join_failed',
        level: 'error',
        category: 'room',
        roomId: targetRoomId,
        message: `Receiver failed to join room ${targetRoomId}: ${msg}`,
        metadata: { code: err.code, stack: err.stack },
      });
      if (err.code === 'ROOM_NOT_FOUND') {
        setStatus('invalid');
        addToast('Room not found. Check the link or ask the sender to resend.', 'error');
      } else if (err.code === 'ROOM_FULL') {
        setStatus('full');
        addToast('This transfer room already has a receiver.', 'error');
      } else {
        setStatus('error');
        addToast(msg, 'error', 6000);
      }
    }
  }, [signaling, createAnswerWithIce, addCandidate, handleSetupDataChannel, addToast, session, startHeartbeat, stopHeartbeat]);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    if (roomParam) {
      const roomUpper = roomParam.toUpperCase();
      setPrefilledRoomId(roomUpper);
      setManualLink(window.location.origin + '/receive?room=' + roomUpper);
      connect(roomUpper);
    }

    return () => {
      stopHeartbeat();
      signaling.stopPolling();
      closeWebRTC();
    };
  }, [connect, signaling, closeWebRTC, stopHeartbeat]);

  // Periodic resume ping when disconnected and waiting for sender
  useEffect(() => {
    if (status !== 'disconnected-waiting') return;
    const interval = setInterval(async () => {
      if (!roomIdRef.current) return;
      try {
        const resumeOffsets = {};
        for (let fIdx = 0; fIdx < 10; fIdx++) {
          const count = await getContiguousChunkCount(roomIdRef.current, fIdx);
          if (count > 0) resumeOffsets[fIdx] = count;
        }
        await signaling.sendSignal('transfer-request', {
          device: typeof navigator !== 'undefined' ? navigator.userAgent : 'Web Browser',
          receiverEmail: session?.user?.email || 'anonymous',
          resumeOffsets,
          timestamp: Date.now(),
        });
      } catch (_) {}
    }, 2500);

    return () => clearInterval(interval);
  }, [status, signaling, session]);

  useEffect(() => {
    if (status !== 'receiving') return;
    const handler = (e) => {
      e.preventDefault();
      e.returnValue = 'File transfer in progress! Closing will cancel the transfer.';
      return e.returnValue;
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [status]);

  const extractRoomId = (input) => {
    if (!input) return '';
    let val = input.trim();
    try {
      if (val.startsWith('http://') || val.startsWith('https://')) {
        const url = new URL(val);
        const queryRoom = url.searchParams.get('room');
        if (queryRoom) return queryRoom.trim().toUpperCase();
        const pathSegments = url.pathname.split('/').filter(Boolean);
        if (pathSegments.length > 0) {
          const lastSegment = pathSegments[pathSegments.length - 1];
          if (lastSegment !== 'receive') return lastSegment.trim().toUpperCase();
        }
      }
    } catch (_) {}
    // If it has room= in it
    if (val.includes('room=')) {
      const match = val.match(/room=([a-zA-Z0-9_-]+)/i);
      if (match && match[1]) return match[1].trim().toUpperCase();
    }
    return val.replace(/[^a-zA-Z0-9_-]/g, '').trim().toUpperCase();
  };

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    const cleanRoom = extractRoomId(manualLink);
    if (!cleanRoom) {
      addToast('Please enter a valid transfer link or room code', 'warning');
      return;
    }
    if (isDiskStreamingSupported() && !dirHandleRef.current) {
      await handleSelectFolder();
    }
    setErrorMessage('');
    signaling.stopPolling();
    closeWebRTC();
    initializedRef.current = true;
    connect(cleanRoom);
  };

  const handleStartReceivingWithFolder = async (targetId) => {
    if (isDiskStreamingSupported() && !dirHandleRef.current) {
      await handleSelectFolder();
    }
    connect(targetId);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: 'linear-gradient(135deg, #0a0a1a 0%, #0f1225 50%, #0a0a1a 100%)' }}>
      <Navbar />
      <Toast toasts={toasts} />

      <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '100px 1.5rem 60px' }}>
        <div style={{ width: '100%', maxWidth: '520px' }}>
          <div style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '1.5rem',
            padding: '2.5rem 2rem',
            backdropFilter: 'blur(24px)',
            boxShadow: '0 32px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08)',
          }}>
            {/* Brand badge */}
            <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
              <div style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: '64px', height: '64px', borderRadius: '20px',
                background: 'linear-gradient(135deg, #10b981, #059669)',
                boxShadow: '0 8px 32px rgba(16,185,129,0.4)',
                marginBottom: '1rem',
              }}>
                <Zap size={32} className="text-white" />
              </div>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'white', margin: '0 0 0.35rem', letterSpacing: '-0.02em' }}>
                P2P File Receive
              </h1>
              <p style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.45)', margin: 0 }}>
                Secure · Direct · No Cloud
              </p>
            </div>

            {/* ──────────── IDLE state ──────────── */}
            {status === 'idle' && (
              <div>
                {prefilledRoomId ? (
                  <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div style={{
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '1rem',
                      padding: '1.25rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.25rem'
                    }}>
                      <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Ready to Connect
                      </span>
                      <span style={{ fontSize: '1.5rem', fontWeight: 800, color: '#10b981', fontFamily: 'monospace' }}>
                        {prefilledRoomId}
                      </span>
                    </div>

                    {isDiskStreamingSupported() && (
                      <div
                        onClick={handleSelectFolder}
                        style={{
                          background: folderName ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.04)',
                          border: `1px dashed ${folderName ? '#10b981' : 'rgba(255,255,255,0.2)'}`,
                          borderRadius: '0.875rem',
                          padding: '0.75rem 1rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '0.75rem',
                          cursor: 'pointer',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 0 }}>
                          <Folder size={20} color={folderName ? '#10b981' : '#60a5fa'} />
                          <div style={{ textAlign: 'left', minWidth: 0 }}>
                            <div style={{ color: 'white', fontSize: '0.85rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {folderName ? `Folder: ${folderName}` : 'Save directly to disk folder'}
                            </div>
                            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.72rem' }}>
                              {folderName ? 'Direct disk streaming active (Zero browser RAM)' : 'Click to select folder & stream with 0 RAM'}
                            </div>
                          </div>
                        </div>
                        <span style={{
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          color: folderName ? '#10b981' : '#60a5fa',
                          background: folderName ? 'rgba(16,185,129,0.15)' : 'rgba(96,165,250,0.1)',
                          padding: '0.25rem 0.6rem',
                          borderRadius: '0.5rem',
                          flexShrink: 0,
                        }}>
                          {folderName ? 'Change' : 'Select'}
                        </span>
                      </div>
                    )}

                    <button
                      onClick={() => handleStartReceivingWithFolder(prefilledRoomId)}
                      style={{
                        width: '100%', padding: '1.1rem',
                        background: 'linear-gradient(135deg, #10b981, #059669)',
                        border: 'none', borderRadius: '0.875rem',
                        color: 'white', fontSize: '1.1rem', fontWeight: 800,
                        cursor: 'pointer', transition: 'all 0.2s',
                        boxShadow: '0 8px 32px rgba(16,185,129,0.3)',
                      }}
                      onMouseEnter={e => e.target.style.transform = 'translateY(-1px)'}
                      onMouseLeave={e => e.target.style.transform = 'none'}
                    >
                      <div className="flex items-center justify-center gap-2"><Download size={22} /> Start Receiving</div>
                    </button>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.85rem', color: '#10b981', fontWeight: 600 }}>
                        No login required
                      </span>
                      <button
                        onClick={() => { setPrefilledRoomId(''); setManualLink(''); }}
                        style={{
                          background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)',
                          fontSize: '0.8rem', cursor: 'pointer', textDecoration: 'underline'
                        }}
                      >
                        Enter different room code
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <p style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.55)', textAlign: 'center', marginBottom: '1.5rem' }}>
                      Paste a transfer link or room code below to start receiving files.
                    </p>
                    <form onSubmit={handleManualSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                      <input
                        type="text"
                        placeholder="https://…/receive?room=XXXX or room code"
                        value={manualLink}
                        onChange={(e) => setManualLink(e.target.value)}
                        required
                        style={{
                          width: '100%', boxSizing: 'border-box',
                          background: 'rgba(255,255,255,0.07)',
                          border: '1px solid rgba(255,255,255,0.15)',
                          borderRadius: '0.875rem', padding: '0.875rem 1.125rem',
                          color: 'white', fontSize: '0.9rem',
                          outline: 'none', transition: 'border 0.2s',
                        }}
                        onFocus={e => e.target.style.borderColor = 'rgba(16,185,129,0.6)'}
                        onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.15)'}
                      />

                      {isDiskStreamingSupported() && (
                        <div
                          onClick={handleSelectFolder}
                          style={{
                            background: folderName ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.04)',
                            border: `1px dashed ${folderName ? '#10b981' : 'rgba(255,255,255,0.2)'}`,
                            borderRadius: '0.875rem',
                            padding: '0.75rem 1rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '0.75rem',
                            cursor: 'pointer',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 0 }}>
                            <Folder size={20} color={folderName ? '#10b981' : '#60a5fa'} />
                            <div style={{ textAlign: 'left', minWidth: 0 }}>
                              <div style={{ color: 'white', fontSize: '0.85rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {folderName ? `Folder: ${folderName}` : 'Save directly to disk folder'}
                              </div>
                              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.72rem' }}>
                                {folderName ? 'Direct disk streaming active (Zero browser RAM)' : 'Click to select folder & stream with 0 RAM'}
                              </div>
                            </div>
                          </div>
                          <span style={{
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            color: folderName ? '#10b981' : '#60a5fa',
                            background: folderName ? 'rgba(16,185,129,0.15)' : 'rgba(96,165,250,0.1)',
                            padding: '0.25rem 0.6rem',
                            borderRadius: '0.5rem',
                            flexShrink: 0,
                          }}>
                            {folderName ? 'Change' : 'Select'}
                          </span>
                        </div>
                      )}

                      <button type="submit" style={{
                        width: '100%', padding: '0.9rem',
                        background: 'linear-gradient(135deg, #10b981, #059669)',
                        border: 'none', borderRadius: '0.875rem',
                        color: 'white', fontSize: '0.95rem', fontWeight: 700,
                        cursor: 'pointer', transition: 'all 0.2s',
                        boxShadow: '0 4px 20px rgba(16,185,129,0.35)',
                      }}
                        onMouseEnter={e => e.target.style.transform = 'translateY(-1px)'}
                        onMouseLeave={e => e.target.style.transform = 'none'}
                      >
                        <div className="flex items-center justify-center gap-2"><Download size={20} /> Start Receiving</div>
                      </button>
                    </form>
                  </div>
                )}
              </div>
            )}

            {/* ──────────── WAITING-PERMISSION state ──────────── */}
            {status === 'waiting-permission' && (
              <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
                <div style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  background: 'rgba(245,158,11,0.15)',
                  border: '2px solid rgba(245,158,11,0.5)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 1.25rem',
                  animation: 'pulse 1.8s infinite',
                }}>
                  <Shield size={32} color="#f59e0b" />
                </div>
                <h2 style={{ color: 'white', fontWeight: 800, fontSize: '1.3rem', marginBottom: '0.4rem' }}>
                  Permission Requested
                </h2>
                <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.9rem', marginBottom: '1.5rem', lineHeight: 1.5 }}>
                  Connected to room <code style={{ color: '#10b981', fontWeight: 700 }}>{roomId}</code>.
                  <br />Waiting for the sender to approve your transfer request...
                </p>

                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.6rem',
                  background: 'rgba(245,158,11,0.1)',
                  border: '1px solid rgba(245,158,11,0.3)',
                  borderRadius: '999px',
                  padding: '0.4rem 1rem',
                  color: '#f59e0b',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  marginBottom: '1.5rem',
                }}>
                  <Spinner color="#f59e0b" size={14} />
                  <span>Awaiting Sender Approval</span>
                </div>

                <br />
                <button
                  onClick={() => { signaling.stopPolling(); closeWebRTC(); setStatus('idle'); }}
                  style={{
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '0.75rem',
                    padding: '0.5rem 1.25rem',
                    color: 'var(--text-secondary)',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
              </div>
            )}

            {/* ──────────── DECLINED state ──────────── */}
            {status === 'declined' && (
              <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
                <div style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  background: 'rgba(239,68,68,0.15)',
                  border: '2px solid rgba(239,68,68,0.5)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 1.25rem',
                }}>
                  <XCircle size={36} color="#ef4444" />
                </div>
                <h2 style={{ color: '#ef4444', fontWeight: 800, fontSize: '1.3rem', marginBottom: '0.4rem' }}>
                  Request Declined
                </h2>
                <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.9rem', marginBottom: '1.5rem', lineHeight: 1.5 }}>
                  The sender declined your transfer request for room <code style={{ color: '#10b981', fontWeight: 700 }}>{roomId}</code>.
                </p>

                <button
                  onClick={() => {
                    signaling.stopPolling();
                    closeWebRTC();
                    setStatus('idle');
                    setPrefilledRoomId('');
                    setManualLink('');
                  }}
                  style={{
                    background: 'rgba(255,255,255,0.1)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '0.75rem',
                    padding: '0.75rem 1.5rem',
                    color: 'white',
                    fontSize: '0.875rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Enter Another Code
                </button>
              </div>
            )}

            {/* ──────────── CONNECTING state ──────────── */}
            {status === 'connecting' && (
              <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                <Spinner color="#10b981" size={52} />
                <h2 style={{ color: 'white', fontWeight: 700, fontSize: '1.2rem', marginTop: '1.25rem', marginBottom: '0.4rem' }}>
                  Connecting…
                </h2>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.875rem' }}>
                  Joining room <code style={{ color: '#10b981', fontWeight: 600 }}>{roomId}</code>
                </p>
              </div>
            )}

            {/* ──────────── DISCONNECTED-WAITING state ──────────── */}
            {status === 'disconnected-waiting' && (
              <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
                <div style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  background: 'rgba(245,158,11,0.15)',
                  border: '2px solid rgba(245,158,11,0.5)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 1.25rem',
                  animation: 'pulse 2s infinite',
                }}>
                  <RefreshCw size={32} color="#f59e0b" />
                </div>
                <h2 style={{ color: '#f59e0b', fontWeight: 800, fontSize: '1.3rem', marginBottom: '0.4rem' }}>
                  Sender Disconnected
                </h2>
                <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.9rem', marginBottom: '1.25rem', lineHeight: 1.5 }}>
                  The sender refreshed their page or connection dropped.
                  <br />
                  <span style={{ color: '#10b981', fontWeight: 600 }}>
                    Downloaded data ({formatBytes(trackRef.current.receivedBytes)}) is safely cached.
                  </span>
                  <br />
                  Waiting for sender to reconnect and resume transmission…
                </p>

                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.6rem',
                  background: 'rgba(245,158,11,0.1)',
                  border: '1px solid rgba(245,158,11,0.3)',
                  borderRadius: '999px',
                  padding: '0.4rem 1rem',
                  color: '#f59e0b',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  marginBottom: '1.5rem',
                }}>
                  <Spinner color="#f59e0b" size={14} />
                  <span>Listening for Sender Reconnection</span>
                </div>

                <br />
                <button
                  onClick={() => connect(roomIdRef.current)}
                  style={{
                    background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                    border: 'none',
                    borderRadius: '0.75rem',
                    padding: '0.6rem 1.25rem',
                    color: 'white',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  <RefreshCw size={14} style={{ display: 'inline', marginRight: '0.3rem' }} /> Retry Connection Now
                </button>
              </div>
            )}

            {/* ──────────── WAITING state ──────────── */}
            {status === 'waiting' && (
              <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                <div style={{ position: 'relative', width: 80, height: 80, margin: '0 auto 1.5rem' }}>
                  <div style={{
                    position: 'absolute', inset: 0, borderRadius: '50%',
                    background: 'rgba(16,185,129,0.15)',
                    animation: 'pulse-ring 1.6s ease-out infinite',
                  }} />
                  <div style={{
                    position: 'absolute', inset: 8, borderRadius: '50%',
                    background: 'rgba(16,185,129,0.25)',
                    animation: 'pulse-ring 1.6s ease-out 0.4s infinite',
                  }} />
                  <div style={{
                    position: 'absolute', inset: 0, display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Radio size={48} className="text-emerald-500" />
                  </div>
                </div>
                <h2 style={{ color: 'white', fontWeight: 800, fontSize: '1.25rem', marginBottom: '0.5rem' }}>
                  Ready to Receive
                </h2>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.875rem', marginBottom: '1.75rem' }}>
                  Connected to room <code style={{ color: '#10b981', fontWeight: 600 }}>{roomId}</code>
                  <br />Waiting for the sender to transmit files…
                </p>

                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                  background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)',
                  borderRadius: '999px', padding: '0.4rem 1rem',
                  color: '#10b981', fontSize: '0.8rem', fontWeight: 600, marginBottom: '1.5rem',
                }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
                  LIVE · Room {roomId}
                </div>

                <br />
                <button
                  onClick={() => { signaling.stopPolling(); closeWebRTC(); setStatus('idle'); }}
                  style={{
                    background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                    borderRadius: '0.75rem', padding: '0.5rem 1.25rem',
                    color: '#ef4444', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
              </div>
            )}

            {/* ──────────── RECEIVING state ──────────── */}
            {status === 'receiving' && (
              <div>
                <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
                  <h2 style={{ color: 'white', fontWeight: 800, fontSize: '1.2rem', margin: '0 0 0.4rem' }}>
                    Receiving Files…
                  </h2>
                  {resumeFromBytes > 0 && (
                    <div style={{
                      display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                      background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.35)',
                      borderRadius: '999px', padding: '0.25rem 0.75rem',
                      color: '#f59e0b', fontSize: '0.75rem', fontWeight: 600,
                    }}>
                      <RefreshCw size={12} /> Resumed from {formatBytes(resumeFromBytes)}
                    </div>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.625rem', marginBottom: '1.25rem' }}>
                  {[
                    { label: 'Speed', value: `${formatBytes(stats.speed)}/s` },
                    { label: 'ETA', value: formatTime(stats.eta) },
                    { label: 'Files', value: `${stats.receivedCount} / ${stats.totalFiles || '?'}` },
                    { label: 'Progress', value: `${Math.round(stats.progress)}%` },
                  ].map((s, i) => (
                    <div key={i} style={{
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: '0.875rem', padding: '0.75rem',
                      textAlign: 'center',
                    }}>
                      <div style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.2rem' }}>{s.label}</div>
                      <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'white' }}>{s.value}</div>
                    </div>
                  ))}
                </div>

                {stats.currentFile && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '0.75rem',
                    background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)',
                    borderRadius: '0.875rem', padding: '0.75rem 1rem', marginBottom: '1.25rem',
                  }}>
                    <span style={{ fontSize: '1.4rem' }}>{getFileIcon(stats.currentFile)}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Receiving</div>
                      <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#10b981', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {stats.currentFile}
                      </div>
                    </div>
                    <Spinner color="#10b981" size={22} thickness={2} />
                  </div>
                )}

                <div style={{ marginBottom: '1.25rem' }}>
                  <div style={{
                    background: 'rgba(255,255,255,0.07)',
                    borderRadius: '999px', height: '10px', overflow: 'hidden',
                    position: 'relative',
                  }}>
                    <div style={{
                      height: '100%', borderRadius: '999px',
                      background: 'linear-gradient(90deg, #10b981, #059669)',
                      width: `${stats.progress}%`,
                      transition: 'width 0.3s ease',
                      boxShadow: '0 0 12px rgba(16,185,129,0.6)',
                      position: 'relative',
                    }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.4rem' }}>
                    <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)' }}>
                      {formatBytes(stats.receivedBytes)} received
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)' }}>
                      {formatBytes(stats.totalBytes)} total
                    </span>
                  </div>
                </div>

                <div style={{
                  display: 'flex', alignItems: 'flex-start', gap: '0.625rem',
                  background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)',
                  borderRadius: '0.75rem', padding: '0.75rem 1rem',
                }}>
                  <span><AlertTriangle size={18} /></span>
                  <p style={{ fontSize: '0.78rem', color: '#fbbf24', margin: 0, lineHeight: 1.5 }}>
                    Do not close this window or disconnect your internet while the transfer is in progress.
                  </p>
                </div>
              </div>
            )}

            {/* ──────────── DONE state ──────────── */}
            {status === 'done' && (
              <div style={{ textAlign: 'center' }}>
                <div style={{ marginBottom: '0.5rem', display: 'flex', justifyContent: 'center' }}>
                  <CheckCircle size={64} className="text-emerald-500" />
                </div>
                <h2 style={{ color: '#10b981', fontWeight: 800, fontSize: '1.4rem', marginBottom: '0.4rem' }}>
                  All Files Received!
                </h2>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.875rem', marginBottom: '1.75rem' }}>
                  {receivedFiles.length} {receivedFiles.length === 1 ? 'file was' : 'files were'} downloaded to your device.
                </p>

                {receivedFiles.length > 0 && (
                  <div style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '1rem', padding: '0.5rem',
                    maxHeight: '220px', overflowY: 'auto',
                    marginBottom: '1.5rem', textAlign: 'left',
                  }}>
                    {receivedFiles.map((file, idx) => (
                      <div key={idx} style={{
                        display: 'flex', alignItems: 'center', gap: '0.75rem',
                        padding: '0.625rem 0.75rem',
                        borderBottom: idx < receivedFiles.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                        borderRadius: '0.625rem',
                      }}>
                        <span style={{ fontSize: '1.25rem', flexShrink: 0 }}>{getFileIcon(file.name)}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '0.85rem', color: 'white', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {file.name}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)' }}>
                            {formatBytes(file.size)}
                          </div>
                        </div>
                        {file.url !== '#' && (
                          <a
                            href={file.url}
                            download={file.name}
                            style={{
                              background: 'rgba(16,185,129,0.15)',
                              border: '1px solid rgba(16,185,129,0.3)',
                              borderRadius: '0.5rem', padding: '0.35rem 0.65rem',
                              color: '#10b981', fontSize: '0.75rem', fontWeight: 700,
                              textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.3rem',
                            }}
                          >
                            <Download size={13} /> Save
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <button
                  onClick={() => {
                    setReceivedFiles([]);
                    setStatus('idle');
                    setPrefilledRoomId('');
                    setManualLink('');
                  }}
                  style={{
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: '0.75rem', padding: '0.75rem 1.5rem',
                    color: 'white', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  Receive Another File
                </button>
              </div>
            )}

            {/* Error & Invalid States */}
            {(status === 'invalid' || status === 'full' || status === 'error') && (
              <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'center' }}>
                  <XCircle size={56} className="text-red-500" />
                </div>
                <h2 style={{ color: '#ef4444', fontWeight: 800, fontSize: '1.25rem', marginBottom: '0.5rem' }}>
                  {status === 'invalid' ? 'Room Not Found' : status === 'full' ? 'Room Is Full' : 'Connection Failed'}
                </h2>
                <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.875rem', marginBottom: '1.5rem', lineHeight: 1.5, wordBreak: 'break-word' }}>
                  {status === 'invalid'
                    ? (errorMessage || `Transfer session "${roomId || prefilledRoomId}" was not found. Please verify the code or ask the sender to generate a transfer link first.`)
                    : status === 'full'
                    ? 'Another receiver is already connected to this transfer session.'
                    : errorMessage || 'Could not establish connection. Please check your network and database settings.'}
                </p>

                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                  {(roomId || prefilledRoomId) && (
                    <button
                      onClick={() => {
                        const target = roomId || prefilledRoomId;
                        signaling.stopPolling();
                        closeWebRTC();
                        connect(target);
                      }}
                      style={{
                        background: 'linear-gradient(135deg, #10b981, #059669)',
                        border: 'none',
                        borderRadius: '0.75rem', padding: '0.75rem 1.5rem',
                        color: 'white', fontSize: '0.875rem', fontWeight: 700, cursor: 'pointer',
                        boxShadow: '0 4px 16px rgba(16,185,129,0.3)',
                      }}
                    >
                      Retry Connection
                    </button>
                  )}
                  <button
                    onClick={() => {
                      signaling.stopPolling();
                      closeWebRTC();
                      setStatus('idle');
                      setPrefilledRoomId('');
                      setManualLink('');
                      setErrorMessage('');
                    }}
                    style={{
                      background: 'rgba(255,255,255,0.1)',
                      border: '1px solid rgba(255,255,255,0.2)',
                      borderRadius: '0.75rem', padding: '0.75rem 1.5rem',
                      color: 'white', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    Enter Different Room
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
