'use client';
import { useRef, useEffect, useCallback } from 'react';

// ─── Timing constants ──────────────────────────────────────────────────────────
// Vercel serverless functions can have 500ms–2s cold starts + MongoDB latency.
// We use an adaptive strategy:
//   Phase 1 (first 10 polls): poll every 600ms to catch the initial handshake quickly
//   Phase 2 (after that): settle at 1500ms to avoid hammering the DB
const FAST_POLL_INTERVAL = 600;
const STEADY_POLL_INTERVAL = 1500;
const FAST_POLL_COUNT = 10; // ~6 seconds of fast polling, then steady

// Max consecutive failures before backing off
const MAX_FAIL_STREAK = 3;

export function useSignaling() {
  const clientIdRef = useRef(null);
  const roomIdRef = useRef(null);
  const listenersRef = useRef({});
  const pollingTimerRef = useRef(null);
  const pollCountRef = useRef(0);       // how many polls have fired since startPolling
  const failStreakRef = useRef(0);      // consecutive poll failures
  const pollingActiveRef = useRef(false);

  // Generate a stable clientId once per mount (browser only)
  if (!clientIdRef.current && typeof window !== 'undefined') {
    clientIdRef.current =
      'client_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();
  }

  // ── Event system ────────────────────────────────────────────────────────────

  const on = useCallback((event, callback) => {
    if (!listenersRef.current[event]) {
      listenersRef.current[event] = [];
    }
    // Prevent duplicate registration of the same callback
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
      // Copy array before iterating in case a handler calls `off`
      [...handlers].forEach((cb) => {
        try { cb(data); } catch (e) { console.error('[Signaling] Handler error:', e); }
      });
    }
  }, []);

  // ── Signal send ─────────────────────────────────────────────────────────────

  const sendSignal = useCallback(async (type, payload = {}) => {
    if (!roomIdRef.current || !clientIdRef.current) return;
    try {
      const res = await fetch('/api/signal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: roomIdRef.current,
          clientId: clientIdRef.current,
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
  }, []);

  // ── Signal poll ─────────────────────────────────────────────────────────────

  const pollSignals = useCallback(async () => {
    if (!roomIdRef.current || !clientIdRef.current || !pollingActiveRef.current) return;

    try {
      const res = await fetch(
        `/api/signal?roomId=${roomIdRef.current}&clientId=${clientIdRef.current}`
      );

      if (!res.ok) {
        failStreakRef.current += 1;
        console.warn('[Signaling] Poll non-OK:', res.status, '(streak:', failStreakRef.current, ')');
        return;
      }

      failStreakRef.current = 0; // reset on success

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
  }, [emitEvent]);

  // ── Adaptive polling loop ───────────────────────────────────────────────────
  // Instead of a fixed setInterval we use a self-scheduling setTimeout so we
  // can vary the interval based on phase and failure streak.

  const scheduleNextPoll = useCallback(() => {
    if (!pollingActiveRef.current) return;

    pollCountRef.current += 1;
    const isInFastPhase = pollCountRef.current <= FAST_POLL_COUNT;

    let delay;
    if (failStreakRef.current >= MAX_FAIL_STREAK) {
      // Back off when DB is unresponsive
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
    roomIdRef.current = roomId;
    pollCountRef.current = 0;
    failStreakRef.current = 0;
    pollingActiveRef.current = true;

    // Clear any previous timer
    if (pollingTimerRef.current) {
      clearTimeout(pollingTimerRef.current);
      pollingTimerRef.current = null;
    }

    // Fire immediately, then schedule adaptive loop
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

  // ── Room management ──────────────────────────────────────────────────────────

  const createRoom = useCallback(async (roomId) => {
    roomIdRef.current = roomId;
    const res = await fetch('/api/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId, clientId: clientIdRef.current }),
    });
    const data = await res.json();
    if (!res.ok || data.error) {
      throw new Error(data.error || 'Failed to create room');
    }
    // startPolling is called by the caller AFTER listeners are registered
    return data;
  }, []);

  const joinRoom = useCallback(async (roomId) => {
    roomIdRef.current = roomId;
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      try {
        const res = await fetch(`/api/rooms/${roomId}/join`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientId: clientIdRef.current }),
        });
        
        let data;
        try {
          data = await res.json();
        } catch (e) {
          throw new Error('Server returned an invalid response (possible timeout).');
        }

        if (!res.ok || data.error) {
          let errorMsg = data.error || 'Failed to join room';
          // Check if it's the common Vercel/MongoDB Atlas IP Whitelist error
          if (errorMsg.includes('whitelist') || errorMsg.includes('MongoDB Atlas')) {
            errorMsg = 'MongoDB Error: Vercel IP is blocked. Please allow all IPs (0.0.0.0/0) in your MongoDB Atlas Network Access settings.';
          }
          
          const err = new Error(errorMsg);
          err.code = data.code || 'UNKNOWN';
          // Don't retry on user errors like full room or not found
          if (res.status === 404 || res.status === 400) {
            throw err;
          }
          throw err;
        }

        startPolling(roomId);
        return data;
      } catch (err) {
        attempts++;
        if (err.code === 'ROOM_FULL' || err.code === 'ROOM_NOT_FOUND' || attempts >= maxAttempts) {
          throw err;
        }
        console.warn(`[Signaling] joinRoom attempt ${attempts} failed, retrying in 1s...`);
        await new Promise(r => setTimeout(r, 1000));
      }
    }
  }, [startPolling]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      pollingActiveRef.current = false;
      if (pollingTimerRef.current) clearTimeout(pollingTimerRef.current);
    };
  }, []);

  return {
    clientId: clientIdRef.current,
    on,
    off,
    sendSignal,
    createRoom,
    joinRoom,
    startPolling,
    stopPolling,
  };
}
