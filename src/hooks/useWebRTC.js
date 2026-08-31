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
    // OpenRelay Metered STUN & TURN (UDP + TCP Port 443 / 80)
    { urls: 'stun:openrelay.metered.ca:80' },
    { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' },
  ],
};

const CHUNK_SIZE = 64 * 1024; // 64KB chunks for optimal throughput

/**
 * Wait for ICE gathering to complete or timeout after maxTimeoutMs.
 * This guarantees the generated SDP contains all STUN/TURN candidates,
 * enabling a single atomic HTTP handshake without trickle ICE spam on serverless.
 */
export function waitForIceGathering(pc, maxTimeoutMs = 5000) {
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

    // Safety fallback timer to prevent infinite waiting on sluggish networks
    timeoutId = setTimeout(() => {
      cleanup();
      resolve();
    }, maxTimeoutMs);
  });
}

export function useWebRTC() {
  const pcRef = useRef(null);
  const dcRef = useRef(null);

  const initPC = useCallback(({ onConnectionStateChange, onDataChannel } = {}) => {
    if (pcRef.current) {
      try {
        pcRef.current.close();
      } catch (_) {}
    }

    const pc = new RTCPeerConnection(ICE_SERVERS);
    pcRef.current = pc;

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
   * Sender: Creates an atomic SDP Offer with gathered ICE candidates.
   */
  const createOfferWithIce = useCallback(async ({ onConnectionStateChange, onDataChannel } = {}) => {
    const pc = initPC({ onConnectionStateChange, onDataChannel });
    const dc = pc.createDataChannel('fileTransfer', { ordered: true });
    dc.binaryType = 'arraybuffer';
    dcRef.current = dc;

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    // Wait for STUN/TURN ICE candidate gathering to finish
    await waitForIceGathering(pc, 5000);

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
   * Receiver: Sets remote SDP Offer and creates an atomic SDP Answer with gathered ICE candidates.
   */
  const createAnswerWithIce = useCallback(async (offer, { onConnectionStateChange, onDataChannel } = {}) => {
    const pc = initPC({ onConnectionStateChange, onDataChannel });

    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    // Wait for STUN/TURN ICE candidate gathering to finish
    await waitForIceGathering(pc, 5000);

    return {
      answer: {
        type: pc.localDescription.type,
        sdp: pc.localDescription.sdp,
      },
      pc,
    };
  }, [initPC]);

  /**
   * Sender: Sets remote SDP Answer received from Receiver.
   */
  const setAnswer = useCallback(async (answer) => {
    if (!pcRef.current) {
      throw new Error('PeerConnection is not initialized');
    }
    await pcRef.current.setRemoteDescription(new RTCSessionDescription(answer));
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
    sendFiles,
    close,
  };
}