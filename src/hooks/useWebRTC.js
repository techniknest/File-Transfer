'use client';
import { useRef, useCallback } from 'react';

export const ICE_SERVERS = {
  iceServers: [
    // Google Public STUN
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    // Cloudflare Public STUN
    { urls: 'stun:stun.cloudflare.com:3478' },
    // Metered Public STUN & TURN
    { urls: 'stun:openrelay.metered.ca:80' },
    { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' },
  ],
  iceCandidatePoolSize: 10,
};

const CHUNK_SIZE = 64 * 1024; // 64KB chunks for high throughput

/**
 * Wait for ICE gathering to complete or timeout after maxTimeoutMs.
 */
export function waitForIceGathering(pc, maxTimeoutMs = 3000) {
  return new Promise((resolve) => {
    if (pc.iceGatheringState === 'complete') {
      resolve();
      return;
    }

    let timeoutId;

    const checkState = () => {
      if (pc.iceGatheringState === 'complete') {
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

  const initPC = useCallback(({ onConnectionStateChange, onDataChannel, onIceCandidate } = {}) => {
    if (pcRef.current) {
      try {
        pcRef.current.close();
      } catch (_) {}
    }

    pendingCandidatesRef.current = [];
    hasRemoteDescriptionRef.current = false;

    const pc = new RTCPeerConnection(ICE_SERVERS);
    pcRef.current = pc;

    if (onIceCandidate) {
      pc.onicecandidate = (e) => {
        if (e.candidate) {
          onIceCandidate(e.candidate);
        }
      };
    }

    if (onConnectionStateChange) {
      pc.onconnectionstatechange = () => onConnectionStateChange(pc.connectionState);
      pc.oniceconnectionstatechange = () => {
        console.log('[WebRTC] ICE Connection State:', pc.iceConnectionState);
      };
    }

    if (onDataChannel) {
      pc.ondatachannel = (e) => {
        dcRef.current = e.channel;
        onDataChannel(e.channel);
      };
    }

    return pc;
  }, []);

  /**
   * Sender: Creates an atomic SDP Offer with gathered ICE candidates + live trickle listener.
   */
  const createOfferWithIce = useCallback(async ({ onConnectionStateChange, onDataChannel, onIceCandidate } = {}) => {
    const pc = initPC({ onConnectionStateChange, onDataChannel, onIceCandidate });
    const dc = pc.createDataChannel('fileTransfer', { ordered: true });
    dc.binaryType = 'arraybuffer';
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
  }, [initPC]);

  /**
   * Receiver: Sets remote SDP Offer and creates an atomic SDP Answer with gathered ICE candidates + live trickle listener.
   */
  const createAnswerWithIce = useCallback(async (offer, { onConnectionStateChange, onDataChannel, onIceCandidate } = {}) => {
    const pc = initPC({ onConnectionStateChange, onDataChannel, onIceCandidate });

    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    hasRemoteDescriptionRef.current = true;

    // Flush any early candidates
    flushPendingCandidates(pc);

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

  const flushPendingCandidates = (pc) => {
    if (!pc || !hasRemoteDescriptionRef.current) return;
    while (pendingCandidatesRef.current.length > 0) {
      const cand = pendingCandidatesRef.current.shift();
      pc.addIceCandidate(new RTCIceCandidate(cand)).catch((err) => {
        console.warn('[WebRTC] Buffered candidate error:', err);
      });
    }
  };

  /**
   * Add incoming trickle ICE candidate with buffering if remote description isn't set yet.
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
      console.warn('[WebRTC] addIceCandidate error:', err);
    }
  }, []);

  /**
   * Sender: Sets remote SDP Answer received from Receiver.
   */
  const setAnswer = useCallback(async (answer) => {
    if (!pcRef.current) {
      throw new Error('PeerConnection is not initialized');
    }
    await pcRef.current.setRemoteDescription(new RTCSessionDescription(answer));
    hasRemoteDescriptionRef.current = true;
    flushPendingCandidates(pcRef.current);
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
   * Stream files across the RTCDataChannel with backpressure flow-control.
   */
  const sendFiles = useCallback(async (files, dc, callbacks = {}) => {
    const { onProgress, onSpeed, onFileStart, onComplete, isCancelled } = callbacks;
    const totalBytes = files.reduce((a, f) => a + f.size, 0);
    let sentBytes = 0;
    let lastTime = Date.now();
    let lastBytes = 0;

    // Send session header
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

        // Backpressure check: wait until buffer clears if full (> 1MB)
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

      dc.send(JSON.stringify({ type: 'file-end', fileIndex: f }));
    }

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
    createOfferWithIce,
    createAnswerWithIce,
    setAnswer,
    addCandidate,
    sendFiles,
    close,
  };
}