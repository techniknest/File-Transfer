'use client';
import { useRef, useCallback } from 'react';

const customStunServer = process.env.NEXT_PUBLIC_STUN_SERVER;

export const DEFAULT_ICE_SERVERS = {
  iceServers: [
    ...(customStunServer ? [{ urls: customStunServer }] : []),
    // Google Public STUN
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    // Cloudflare Public STUN
    { urls: 'stun:stun.cloudflare.com:3478' },
    // OpenRelay Public STUN & TURN
    { urls: 'stun:openrelay.metered.ca:80' },
    { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' },
  ],
  iceCandidatePoolSize: 10,
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
          iceCandidatePoolSize: 10,
        };
      }
    }
  } catch (err) {
    console.warn('[WEBRTC] Could not fetch dynamic ICE servers from /api/turn:', err.message);
  }
  return DEFAULT_ICE_SERVERS;
}

/**
 * Wait for ICE gathering to complete or timeout after maxTimeoutMs.
 */
export function waitForIceGathering(pc, maxTimeoutMs = 3000) {
  return new Promise((resolve) => {
    if (pc.iceGatheringState === 'complete') {
      console.log('[ICE] Gathering complete');
      resolve();
      return;
    }

    let timeoutId;

    const checkState = () => {
      if (pc.iceGatheringState === 'complete') {
        console.log('[ICE] Gathering complete');
        cleanup();
        resolve();
      }
    };

    const cleanup = () => {
      if (timeoutId) clearTimeout(timeoutId);
      pc.removeEventListener('icegatheringstatechange', checkState);
    };

    pc.addEventListener('icegatheringstatechange', checkState);

    timeoutId = setTimeout(() => {
      console.log('[ICE] Gathering timeout window elapsed, continuing with gathered candidates');
      cleanup();
      resolve();
    }, maxTimeoutMs);
  });
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
   * Initialize RTCPeerConnection with full diagnostic event listeners matching Section 9
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
   * Sender: Creates atomic SDP Offer with gathered ICE candidates
   */
  const createOfferWithIce = useCallback(async ({ onConnectionStateChange, onDataChannel, onIceCandidate } = {}) => {
    const pc = await initPC({ onConnectionStateChange, onDataChannel, onIceCandidate });
    const dc = pc.createDataChannel('fileTransfer', { ordered: true });
    setupDataChannelEvents(dc);
    dcRef.current = dc;

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    // Give STUN/TURN initial window to gather candidates
    await waitForIceGathering(pc, 2500);

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
   * Receiver: Sets remote SDP Offer and creates atomic SDP Answer
   */
  const createAnswerWithIce = useCallback(async (offer, { onConnectionStateChange, onDataChannel, onIceCandidate } = {}) => {
    const pc = await initPC({ onConnectionStateChange, onDataChannel, onIceCandidate });

    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    hasRemoteDescriptionRef.current = true;

    // Process queued candidates
    await flushPendingCandidates(pc);

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    // Give STUN/TURN initial window to gather candidates
    await waitForIceGathering(pc, 2500);

    return {
      answer: {
        type: pc.localDescription.type,
        sdp: pc.localDescription.sdp,
      },
      pc,
    };
  }, [initPC]);

  /**
   * Handle incoming ICE candidates with pending queue (Section 8)
   */
  const addCandidate = useCallback(async (candidate) => {
    if (!candidate) return;
    console.log('[ICE] Received candidate', candidate);
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
   * Read file slice into ArrayBuffer
   */
  const readChunk = (file, start, end) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = reject;
      reader.readAsArrayBuffer(file.slice(start, end));
    });

  /**
   * Stream files across the RTCDataChannel with backpressure flow control (Section 18 & 19)
   */
  const sendFiles = useCallback(async (files, dc, callbacks = {}) => {
    const { onProgress, onSpeed, onFileStart, onComplete, isCancelled } = callbacks;

    if (!dc || dc.readyState !== 'open') {
      console.error('[DATA] Cannot send files: DataChannel is not open (readyState:', dc?.readyState, ')');
      return;
    }

    const totalBytes = files.reduce((a, f) => a + f.size, 0);
    let sentBytes = 0;
    let lastTime = Date.now();
    let lastBytes = 0;

    // Control message: session-info
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

      if (onFileStart) onFileStart(file.name);

      // Control message: meta
      dc.send(
        JSON.stringify({
          type: 'meta',
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type || 'application/octet-stream',
          totalChunks,
          fileIndex: f,
          totalFiles: files.length,
        })
      );

      for (let i = 0; i < totalChunks; i++) {
        if (isCancelled && isCancelled()) return;

        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const chunk = await readChunk(file, start, end);

        // Backpressure check (Section 19): pause if buffer exceeds 1MB
        while (dc.bufferedAmount > 1024 * 1024) {
          if (isCancelled && isCancelled()) return;
          await new Promise((r) => setTimeout(r, 40));
        }

        dc.send(chunk);
        sentBytes += end - start;

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
      dc.send(JSON.stringify({ type: 'file-end', fileIndex: f }));
    }

    // Control message: session-end
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