'use client';
import { useRef, useEffect, useCallback } from 'react';

// Polling intervals matching architecture recommendation:
// - 2000ms when waiting for peer to join
// - 400ms during WebRTC SDP / ICE negotiation
// - STOP when connection established
const WAITING_POLL_INTERVAL = 2000;
const NEGOTIATING_POLL_INTERVAL = 400;
const MAX_FAIL_STREAK = 3;

export function useSignaling() {
  const clientIdRef = useRef(null);
  const roomIdRef = useRef(null);
  const listenersRef = useRef({});
  const pollingTimerRef = useRef(null);
  const isNegotiatingRef = useRef(false);
  const failStreakRef = useRef(0);
  const pollingActiveRef = useRef(false);

  const processedSignalIdsRef = useRef(new Set());

  const getClientId = useCallback(() => {
    if (!clientIdRef.current) {
      if (typeof window !== 'undefined') {
        const stored = window.sessionStorage?.getItem('p2p_client_id');
        if (stored) {
          clientIdRef.current = stored;
        } else {
          const generated = 'client_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();
          clientIdRef.current = generated;
          try { window.sessionStorage?.setItem('p2p_client_id', generated); } catch (_) {}
        }
      } else {
        clientIdRef.current = 'client_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();
      }
    }
    return clientIdRef.current;
  }, []);

  // ── Event system ──
  const on = useCallback((event, callback) => {
    if (!listenersRef.current[event]) {
      listenersRef.current[event] = [];
    }
    if (!listenersRef.current[event].includes(callback)) {
      listenersRef.current[event].push(callback);
    }
    return () => {
      if (listenersRef.current[event]) {
        listenersRef.current[event] = listenersRef.current[event].filter(
          (cb) => cb !== callback
        );
      }
    };
  }, []);

  const off = useCallback((event) => {
    delete listenersRef.current[event];
  }, []);

  const emitEvent = useCallback((event, data) => {
    const handlers = listenersRef.current[event];
    if (handlers && handlers.length > 0) {
      [...handlers].forEach((cb) => {
        try {
          cb(data);
        } catch (e) {
          console.error('[SIGNAL] Handler error:', e);
        }
      });
    }
  }, []);

  // ── Signal send ──
  const sendSignal = useCallback(async (type, payload = {}) => {
    const cid = getClientId();
    if (!roomIdRef.current || !cid) return;

    if (type === 'offer') console.log('[SIGNAL] Sending offer');
    if (type === 'answer') console.log('[SIGNAL] Sending answer');

    try {
      const res = await fetch('/api/signal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
        },
        cache: 'no-store',
        body: JSON.stringify({
          roomId: roomIdRef.current,
          clientId: cid,
          type,
          payload,
        }),
      });
      if (res.ok) {
        if (type === 'offer') console.log('[SIGNAL] Offer stored');
        if (type === 'answer') console.log('[SIGNAL] Answer stored');
      } else {
        const err = await res.json().catch(() => ({}));
        console.warn('[SIGNAL] Send failed:', err);
      }
    } catch (err) {
      console.error('[SIGNAL] Send error:', err.message);
    }
  }, [getClientId]);

  // ── Signal poll with Deduplication ──
  const pollSignals = useCallback(async () => {
    const cid = getClientId();
    if (!roomIdRef.current || !cid || !pollingActiveRef.current) return;

    try {
      const res = await fetch(
        `/api/signal?roomId=${encodeURIComponent(roomIdRef.current)}&clientId=${encodeURIComponent(cid)}&_t=${Date.now()}`,
        {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' },
        }
      );

      if (!res.ok) {
        failStreakRef.current += 1;
        console.warn('[SIGNAL] Poll non-OK:', res.status, '(streak:', failStreakRef.current, ')');
        return;
      }

      failStreakRef.current = 0;

      const data = await res.json();
      if (data.signals && data.signals.length > 0) {
        for (const sig of data.signals) {
          const sigId = sig._id ? String(sig._id) : null;
          if (sigId && processedSignalIdsRef.current.has(sigId)) {
            continue; // Deduplicate
          }
          if (sigId) {
            processedSignalIdsRef.current.add(sigId);
          }

          if (sig.type === 'offer') console.log('[SIGNAL] Receiving offer');
          if (sig.type === 'answer') console.log('[SIGNAL] Receiving answer');
          console.log(`[SIGNAL] Dispatching ${sig.type} (ID: ${sigId || 'none'})`);

          // When receiver-joined, transfer-request, transfer-allow, or offer arrives, switch to fast 400ms polling for negotiation
          if (
            sig.type === 'receiver-joined' ||
            sig.type === 'transfer-request' ||
            sig.type === 'transfer-allow' ||
            sig.type === 'offer'
          ) {
            isNegotiatingRef.current = true;
          }

          emitEvent(sig.type, sig.payload);
        }
      }
    } catch (err) {
      failStreakRef.current += 1;
      console.warn('[SIGNAL] Poll error (streak:', failStreakRef.current, '):', err.message);
    }
  }, [getClientId, emitEvent]);

  // ── Adaptive polling loop ──
  const scheduleNextPoll = useCallback(() => {
    if (!pollingActiveRef.current) return;

    const delay = isNegotiatingRef.current ? NEGOTIATING_POLL_INTERVAL : WAITING_POLL_INTERVAL;

    pollingTimerRef.current = setTimeout(async () => {
      await pollSignals();
      scheduleNextPoll();
    }, delay);
  }, [pollSignals]);

  const startPolling = useCallback((roomId, startInNegotiating = false) => {
    roomIdRef.current = (roomId || '').trim().toUpperCase();
    isNegotiatingRef.current = startInNegotiating;
    failStreakRef.current = 0;
    pollingActiveRef.current = true;
    processedSignalIdsRef.current.clear();

    if (pollingTimerRef.current) {
      clearTimeout(pollingTimerRef.current);
      pollingTimerRef.current = null;
    }

    pollSignals().then(() => scheduleNextPoll());
  }, [pollSignals, scheduleNextPoll]);

  const stopPolling = useCallback(() => {
    console.log('[SIGNAL] Polling stopped for room:', roomIdRef.current);
    pollingActiveRef.current = false;
    if (pollingTimerRef.current) {
      clearTimeout(pollingTimerRef.current);
      pollingTimerRef.current = null;
    }
    roomIdRef.current = null;
    failStreakRef.current = 0;
  }, []);

  // ── Room management ──
  const createRoom = useCallback(async (roomId) => {
    const cleanRoomId = (roomId || '').trim().toUpperCase();
    console.log('[ROOM] Creating room');
    console.log('[ROOM] Room ID:', cleanRoomId);
    roomIdRef.current = cleanRoomId;
    const cid = getClientId();

    const res = await fetch('/api/rooms', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
      },
      cache: 'no-store',
      body: JSON.stringify({ roomId: cleanRoomId, clientId: cid }),
    });

    let data;
    try {
      data = await res.json();
    } catch {
      throw new Error('Server returned an invalid response. Please check database connection.');
    }

    console.log('[ROOM] API response:', data);

    if (!res.ok || data.error) {
      throw new Error(data.error || 'Failed to create room');
    }
    return data;
  }, [getClientId]);

  const joinRoom = useCallback(async (roomId) => {
    const cleanRoomId = (roomId || '').trim().toUpperCase();
    console.log('[ROOM] Joining room:', cleanRoomId);
    roomIdRef.current = cleanRoomId;
    const cid = getClientId();
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      try {
        const res = await fetch(`/api/rooms/${encodeURIComponent(cleanRoomId)}/join`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache',
          },
          cache: 'no-store',
          body: JSON.stringify({ clientId: cid }),
        });

        let data;
        try {
          data = await res.json();
        } catch {
          throw new Error('Server returned an invalid response.');
        }

        console.log('[ROOM] Join API response:', data);

        if (!res.ok || data.error) {
          let errorMsg = data.error || 'Failed to join room';
          const err = new Error(errorMsg);
          err.code = data.code || 'UNKNOWN';
          if (res.status === 404 || res.status === 400) {
            throw err;
          }
          throw err;
        }

        // Receiver starts in fast negotiating mode (400ms) to grab SDP offer quickly
        startPolling(cleanRoomId, true);
        return data;
      } catch (err) {
        attempts++;
        if (err.code === 'ROOM_FULL' || err.code === 'ROOM_NOT_FOUND' || attempts >= maxAttempts) {
          throw err;
        }
        console.warn(`[ROOM] joinRoom attempt ${attempts} failed, retrying in 1s...`);
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  }, [getClientId, startPolling]);

  useEffect(() => {
    return () => {
      pollingActiveRef.current = false;
      if (pollingTimerRef.current) clearTimeout(pollingTimerRef.current);
    };
  }, []);

  return {
    clientId: getClientId(),
    getClientId,
    on,
    off,
    sendSignal,
    createRoom,
    joinRoom,
    startPolling,
    stopPolling,
  };
}
