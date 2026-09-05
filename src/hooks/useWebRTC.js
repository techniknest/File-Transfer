'use client';
import { useRef, useCallback } from 'react';

const customStunServer = process.env.NEXT_PUBLIC_STUN_SERVER;

export const DEFAULT_ICE_SERVERS = {
  iceServers: [
    ...(customStunServer ? [{ urls: customStunServer }] : []),
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
    { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
  ],
  iceCandidatePoolSize: 6,
};

const CHUNK_SIZE = 64 * 1024; // 64KB chunks

/**
 * Fetch dynamic ICE servers from /api/turn, falling back to DEFAULT_ICE_SERVERS
 */
async function fetchIceServers() {
  try {
    const res = await fetch('/api/turn', { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.iceServers) && data.iceServers.length > 0) {
        return {
          iceServers: data.iceServers,
          iceCandidatePoolSize: 6,
        };
      }
    }
  } catch (err) {
    console.warn('[WEBRTC] Could not fetch dynamic ICE servers from /api/turn:', err.message);
  }
  return DEFAULT_ICE_SERVERS;
}

export function useWebRTC() {
  const pcRef = useRef(null);
  const dcRef = useRef(null);
  const pendingCandidatesRef = useRef([]);
  const hasRemoteDescriptionRef = useRef(false);

  /**
   * Diagnostic inspector: Logs selected candidate pair (host / srflx / relay)
   */
  const inspectCandidatePair = async (pc) => {
    try {
      const stats = await pc.getStats();
      stats.forEach((report) => {
        if (report.type === 'candidate-pair' && (report.state === 'succeeded' || report.nominated)) {
          console.log('[WEBRTC] Selected Candidate Pair:', report);
        }
      });
    } catch (_) {}
  };

  /**
   * Configure DataChannel listeners with standard logs and buffering thresholds
   */
  const setupDataChannelEvents = useCallback((dc, callbacks = {}) => {
    const { onOpen, onClose, onError, onMessage } = callbacks;
    dc.binaryType = 'arraybuffer';
    dc.bufferedAmountLowThreshold = 256 * 1024; // 256 KB buffer threshold

    dc.onopen = () => {
      console.log('[DATA] Channel Open');
      if (onOpen) onOpen();
    };

    dc.onclose = () => {
      console.log('[DATA] Channel closed');
      if (onClose) onClose();
    };

    dc.onerror = (error) => {
      console.error('[DATA] Error:', error);
      if (onError) onError(error);
    };

    if (onMessage) {
      dc.onmessage = onMessage;
    }
  }, []);

  /**
   * Initialize RTCPeerConnection with full diagnostic event listeners
   */
  const initPC = useCallback(async ({ onConnectionStateChange, onDataChannel, onIceCandidate } = {}) => {
    if (pcRef.current) {
      try {
        pcRef.current.close();
      } catch (_) {}
    }

    hasRemoteDescriptionRef.current = false;
    const config = await fetchIceServers();
    const pc = new RTCPeerConnection(config);
    pcRef.current = pc;

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('[ICE] New candidate:', event.candidate.candidate);
        if (onIceCandidate) {
          onIceCandidate(event.candidate);
        }
      } else {
        console.log('[ICE] Gathering complete');
      }
    };

    pc.onconnectionstatechange = () => {
      console.log('[WEBRTC] Connection:', pc.connectionState);
      if (onConnectionStateChange) {
        onConnectionStateChange(pc.connectionState);
      }
      if (pc.connectionState === 'connected') {
        inspectCandidatePair(pc);
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log('[WEBRTC] ICE Connection:', pc.iceConnectionState);
      if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
        inspectCandidatePair(pc);
      }
    };

    pc.onicegatheringstatechange = () => {
      console.log('[WEBRTC] ICE Gathering:', pc.iceGatheringState);
    };

    pc.onsignalingstatechange = () => {
      console.log('[WEBRTC] Signaling:', pc.signalingState);
    };

    if (onDataChannel) {
      pc.ondatachannel = (e) => {
        console.log('[WEBRTC] ondatachannel event received:', e.channel.label);
        dcRef.current = e.channel;
        onDataChannel(e.channel);
      };
    }

    return pc;
  }, []);

  const flushPendingCandidates = async (pc) => {
    if (!pc || !hasRemoteDescriptionRef.current) return;
    if (pendingCandidatesRef.current.length > 0) {
      console.log(`[ICE] Processing ${pendingCandidatesRef.current.length} pending candidates`);
      while (pendingCandidatesRef.current.length > 0) {
        const candidate = pendingCandidatesRef.current.shift();
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.warn('[ICE] Buffered candidate error:', err.message);
        }
      }
    }
  };

  /**
   * Sender: Creates SDP Offer instantly with Trickle ICE (no artificial delay)
   */
  const createOfferWithIce = useCallback(async ({ onConnectionStateChange, onDataChannel, onIceCandidate } = {}) => {
    const pc = await initPC({ onConnectionStateChange, onDataChannel, onIceCandidate });
    const dc = pc.createDataChannel('fileTransfer', { ordered: true });
    setupDataChannelEvents(dc);
    dcRef.current = dc;

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    return {
      offer: {
        type: pc.localDescription.type,
        sdp: pc.localDescription.sdp,
      },
      dc,
      pc,
    };
  }, [initPC, setupDataChannelEvents]);

  /**
   * Receiver: Sets remote SDP Offer and creates SDP Answer instantly with Trickle ICE
   */
  const createAnswerWithIce = useCallback(async (offer, { onConnectionStateChange, onDataChannel, onIceCandidate } = {}) => {
    const pc = await initPC({ onConnectionStateChange, onDataChannel, onIceCandidate });

    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    hasRemoteDescriptionRef.current = true;

    // Process queued candidates
    await flushPendingCandidates(pc);

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    return {
      answer: {
        type: pc.localDescription.type,
        sdp: pc.localDescription.sdp,
      },
      pc,
    };
  }, [initPC]);

  /**
   * Handle incoming ICE candidates with pending queue
   */
  const addCandidate = useCallback(async (candidate) => {
    if (!candidate) return;
    const pc = pcRef.current;
    if (!pc || !hasRemoteDescriptionRef.current || !pc.remoteDescription) {
      pendingCandidatesRef.current.push(candidate);
      return;
    }
    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      console.warn('[ICE] addIceCandidate error:', err.message);
    }
  }, []);

  /**
   * Sender: Sets remote SDP Answer and flushes queued candidates
   */
  const setAnswer = useCallback(async (answer) => {
    if (!pcRef.current) {
      throw new Error('PeerConnection is not initialized');
    }
    if (pcRef.current.remoteDescription && pcRef.current.remoteDescription.type === 'answer') {
      console.log('[WEBRTC] Remote answer already applied');
      return;
    }
    await pcRef.current.setRemoteDescription(new RTCSessionDescription(answer));
    hasRemoteDescriptionRef.current = true;
    await flushPendingCandidates(pcRef.current);
  }, []);

  /**
   * Stream files across the RTCDataChannel with binary framing, lightweight chunk slicing,
   * micro-yields to prevent UI/GC lockup, and backpressure flow control.
   */
  const sendFiles = useCallback(async (files, dc, callbacks = {}) => {
    const { onProgress, onSpeed, onFileStart, onComplete, isCancelled, resumeOffsets = {} } = callbacks;

    if (!dc || dc.readyState !== 'open') {
      console.error('[DATA] Cannot send files: DataChannel is not open (readyState:', dc?.readyState, ')');
      return;
    }

    const totalBytes = files.reduce((a, f) => a + f.size, 0);
    let sentBytes = 0;
    let lastTime = Date.now();
    let lastBytes = 0;

    // Account for already transferred chunks if resuming
    for (let f = 0; f < files.length; f++) {
      const startChunk = resumeOffsets[f] || 0;
      sentBytes += Math.min(startChunk * CHUNK_SIZE, files[f].size);
    }
    lastBytes = sentBytes;

    // Control message: session-info
    if (dc.readyState !== 'open') throw new DOMException('DataChannel closed before send', 'InvalidStateError');
    dc.send(
      JSON.stringify({
        type: 'session-info',
        totalFiles: files.length,
        totalBytes,
      })
    );

    for (let f = 0; f < files.length; f++) {
      if (isCancelled && isCancelled()) return;

      const file = files[f];
      const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
      const startChunkIndex = resumeOffsets[f] || 0;

      if (onFileStart) onFileStart(file.name, startChunkIndex > 0);

      // Control message: meta
      if (dc.readyState !== 'open') throw new DOMException('DataChannel closed before meta send', 'InvalidStateError');
      dc.send(
        JSON.stringify({
          type: 'meta',
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type || 'application/octet-stream',
          totalChunks,
          fileIndex: f,
          totalFiles: files.length,
          startChunkIndex,
        })
      );

      for (let i = startChunkIndex; i < totalChunks; i++) {
        if (isCancelled && isCancelled()) return;

        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);

        // Direct slice arrayBuffer (fastest method in modern browsers, no FileReader overhead)
        const chunkData = await file.slice(start, end).arrayBuffer();

        // Binary frame: 4 bytes fileIndex + 4 bytes chunkIndex + chunkData
        const packet = new Uint8Array(8 + chunkData.byteLength);
        const view = new DataView(packet.buffer);
        view.setUint32(0, f, false); // big-endian
        view.setUint32(4, i, false); // big-endian
        packet.set(new Uint8Array(chunkData), 8);

        // Backpressure check: wait if buffer exceeds threshold
        while (dc.bufferedAmount > 512 * 1024) {
          if (isCancelled && isCancelled()) return;
          if (dc.readyState !== 'open') return; // channel dropped — bail silently
          await new Promise((r) => setTimeout(r, 20));
        }

        // Guard: DataChannel may have closed during backpressure wait or between chunks
        if (dc.readyState !== 'open') {
          console.warn('[DATA] DataChannel closed mid-transfer at chunk', i, '— aborting send loop');
          return;
        }

        dc.send(packet.buffer);
        sentBytes += end - start;

        // Yield to event loop every 32 chunks to let browser GC and UI breathe
        if (i % 32 === 0) {
          await new Promise((r) => setTimeout(r, 0));
        }

        const now = Date.now();
        const elapsed = (now - lastTime) / 1000;
        if (elapsed >= 0.25) {
          const delta = sentBytes - lastBytes;
          const spd = delta / elapsed;
          const remaining = totalBytes - sentBytes;
          const etaVal = spd > 0 ? remaining / spd : 0;
          lastTime = now;
          lastBytes = sentBytes;

          if (onProgress) onProgress(Math.min(100, Math.round((sentBytes / totalBytes) * 100)));
          if (onSpeed) onSpeed(spd, etaVal);
        }
      }

      // Control message: file-end
      if (dc.readyState !== 'open') return;
      dc.send(JSON.stringify({ type: 'file-end', fileIndex: f, totalChunks }));
    }

    // Control message: session-end
    if (dc.readyState !== 'open') return;
    dc.send(JSON.stringify({ type: 'session-end' }));
    if (onProgress) onProgress(100);
    if (onComplete) onComplete();
  }, []);

  const close = useCallback(() => {
    pendingCandidatesRef.current = [];
    hasRemoteDescriptionRef.current = false;
    if (dcRef.current) {
      try {
        dcRef.current.close();
      } catch (_) {}
      dcRef.current = null;
    }
    if (pcRef.current) {
      try {
        pcRef.current.close();
      } catch (_) {}
      pcRef.current = null;
    }
  }, []);

  return {
    pcRef,
    dcRef,
    initPC,
    setupDataChannelEvents,
    createOfferWithIce,
    createAnswerWithIce,
    setAnswer,
    addCandidate,
    sendFiles,
    close,
  };
}