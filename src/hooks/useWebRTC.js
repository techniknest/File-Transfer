'use client';
import { useRef, useCallback } from 'react';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' }
  ]
};

const CHUNK_SIZE = 64 * 1024;

export function useWebRTC(onIceCandidate, onDataChannel) {
  const pcRef = useRef(null);
  const dcRef = useRef(null);

  const initPC = useCallback(() => {
    if (pcRef.current) {
      pcRef.current.close();
    }
    const pc = new RTCPeerConnection(ICE_SERVERS);
    pcRef.current = pc;

    pc.onicecandidate = (e) => {
      if (e.candidate && onIceCandidate) {
        onIceCandidate(e.candidate);
      }
    };

    if (onDataChannel) {
      pc.ondatachannel = (e) => {
        onDataChannel(e.channel);
      };
    }

    return pc;
  }, [onIceCandidate, onDataChannel]);

  const createOffer = useCallback(async () => {
    const pc = initPC();
    const dc = pc.createDataChannel('fileTransfer', { ordered: true });
    dcRef.current = dc;

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    return { offer, dc };
  }, [initPC]);

  const handleAnswer = useCallback(async (answer) => {
    if (pcRef.current) {
      await pcRef.current.setRemoteDescription(new RTCSessionDescription(answer));
    }
  }, []);

  const handleIceCandidate = useCallback(async (candidate) => {
    if (pcRef.current && candidate) {
      try {
        await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {}
    }
  }, []);

  const sendFiles = useCallback(async (files, dc, callbacks = {}) => {
    const { onProgress, onSpeed, onFileStart, onComplete } = callbacks;
    const totalBytes = files.reduce((a, f) => a + f.size, 0);
    let sentBytes = 0;
    const startTime = Date.now();
    let lastTime = Date.now();
    let lastBytes = 0;

    // Send session info
    dc.send(JSON.stringify({
      type: 'session-info',
      totalFiles: files.length,
      totalBytes
    }));

    for (let f = 0; f < files.length; f++) {
      const file = files[f];
      const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

      if (onFileStart) onFileStart(file.name);

      dc.send(JSON.stringify({
        type: 'meta',
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type || 'application/octet-stream',
        totalChunks,
        fileIndex: f,
        totalFiles: files.length
      }));

      for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const chunk = await readChunk(file, start, end);

        while (dc.bufferedAmount > 1024 * 1024) {
          await new Promise(r => setTimeout(r, 50));
        }

        dc.send(chunk);
        sentBytes += (end - start);

        const now = Date.now();
        const elapsed = (now - lastTime) / 1000;
        if (elapsed >= 0.25) {
          const delta = sentBytes - lastBytes;
          const spd = delta / elapsed;
          const remaining = totalBytes - sentBytes;
          const etaVal = spd > 0 ? remaining / spd : 0;
          lastTime = now;
          lastBytes = sentBytes;

          if (onProgress) onProgress(Math.round((sentBytes / totalBytes) * 100));
          if (onSpeed) onSpeed(spd, etaVal);
        }
      }

      dc.send(JSON.stringify({ type: 'file-end', fileIndex: f }));
    }

    dc.send(JSON.stringify({ type: 'session-end' }));
    if (onComplete) onComplete();
  }, []);

  const readChunk = (file, start, end) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsArrayBuffer(file.slice(start, end));
  });

  const close = useCallback(() => {
    if (dcRef.current) dcRef.current.close();
    if (pcRef.current) pcRef.current.close();
    pcRef.current = null;
    dcRef.current = null;
  }, []);

  return { initPC, createOffer, handleAnswer, handleIceCandidate, sendFiles, close };
}