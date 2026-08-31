'use client';
import { useRef, useEffect, useCallback } from 'react';

// Polling constants — tuned for Vercel serverless latency
const FAST_POLL_INTERVAL = 500;   // 500ms during initial handshake phase
const STEADY_POLL_INTERVAL = 1200; // 1.2s once connection is established
const FAST_POLL_COUNT = 20;        // Stay fast for 20 polls (10 seconds) to catch receiver joining
const MAX_FAIL_STREAK = 3;

export function useSignaling() {
  const clientIdRef = useRef(null);
  const roomIdRef = useRef(null);
  const listenersRef = useRef({});
  const pollingTimerRef = useRef(null);
  const pollCountRef = useRef(0);
  const failStreakRef = useRef(0);
  const pollingActiveRef = useRef(false);

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
          console.error('[Signaling] Handler error:', e);
        }
      });
    }
  }, []);

  // ── Signal send ──
  const sendSignal = useCallback(async (type, payload = {}) => {
    const cid = getClientId();
    if (!roomIdRef.current || !cid) return;
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
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.warn('[Signaling] Send failed:', err);
      }
    } catch (err) {
      console.error('[Signaling] Send error:', err.message);
    }
  }, [getClientId]);

  // ── Signal poll ──
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
        console.warn('[Signaling] Poll non-OK:', res.status, '(streak:', failStreakRef.current, ')');
        return;
      }

      failStreakRef.current = 0;

      const data = await res.json();
      if (data.signals && data.signals.length > 0) {
        for (const sig of data.signals) {
          console.log('[Signaling] Received signal:', sig.type);
          emitEvent(sig.type, sig.payload);
        }
      }
    } catch (err) {
      failStreakRef.current += 1;
      console.warn('[Signaling] Poll error (streak:', failStreakRef.current, '):', err.message);
    }
  }, [getClientId, emitEvent]);

  // ── Adaptive polling loop ──
  const scheduleNextPoll = useCallback(() => {
    if (!pollingActiveRef.current) return;

    pollCountRef.current += 1;
    const isInFastPhase = pollCountRef.current <= FAST_POLL_COUNT;

    let delay;
    if (failStreakRef.current >= MAX_FAIL_STREAK) {
      delay = Math.min(STEADY_POLL_INTERVAL * failStreakRef.current, 8000);
    } else {
      delay = isInFastPhase ? FAST_POLL_INTERVAL : STEADY_POLL_INTERVAL;
    }

    pollingTimerRef.current = setTimeout(async () => {
      await pollSignals();
      scheduleNextPoll();
    }, delay);
  }, [pollSignals]);

  const startPolling = useCallback((roomId) => {
    roomIdRef.current = (roomId || '').trim().toUpperCase();
    pollCountRef.current = 0;
    failStreakRef.current = 0;
    pollingActiveRef.current = true;

    if (pollingTimerRef.current) {
      clearTimeout(pollingTimerRef.current);
      pollingTimerRef.current = null;
    }

    pollSignals().then(() => scheduleNextPoll());
  }, [pollSignals, scheduleNextPoll]);

  const stopPolling = useCallback(() => {
    pollingActiveRef.current = false;
    if (pollingTimerRef.current) {
      clearTimeout(pollingTimerRef.current);
      pollingTimerRef.current = null;
    }
    roomIdRef.current = null;
    pollCountRef.current = 0;
    failStreakRef.current = 0;
  }, []);

  // ── Room management ──
  const createRoom = useCallback(async (roomId) => {
    const cleanRoomId = (roomId || '').trim().toUpperCase();
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
      throw new Error('Server returned an invalid response. Please check database connection in Vercel settings.');
    }

    if (!res.ok || data.error) {
      throw new Error(data.error || 'Failed to create room');
    }
    return data;
  }, [getClientId]);

  const joinRoom = useCallback(async (roomId) => {
    const cleanRoomId = (roomId || '').trim().toUpperCase();
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
          throw new Error('Server returned an invalid response (possible database connection timeout).');
        }

        if (!res.ok || data.error) {
          let errorMsg = data.error || 'Failed to join room';
          if (errorMsg.includes('whitelist') || errorMsg.includes('MongoDB Atlas')) {
            errorMsg = 'MongoDB Error: Vercel IP is blocked. Please allow all IPs (0.0.0.0/0) in MongoDB Atlas Network Access settings.';
          }

          const err = new Error(errorMsg);
          err.code = data.code || 'UNKNOWN';

          if (res.status === 404 || res.status === 400) {
            throw err;
          }
          throw err;
        }

        startPolling(cleanRoomId);
        return data;
      } catch (err) {
        attempts++;
        if (err.code === 'ROOM_FULL' || err.code === 'ROOM_NOT_FOUND' || attempts >= maxAttempts) {
          throw err;
        }
        console.warn(`[Signaling] joinRoom attempt ${attempts} failed, retrying in 1s...`);
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
