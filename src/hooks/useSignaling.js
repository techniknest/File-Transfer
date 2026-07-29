'use client';
import { useRef, useEffect, useCallback } from 'react';

export function useSignaling() {
  const clientIdRef = useRef(null);
  const roomIdRef = useRef(null);
  const listenersRef = useRef({});
  const pollingTimerRef = useRef(null);

  if (!clientIdRef.current && typeof window !== 'undefined') {
    clientIdRef.current = 'client_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();
  }

  const on = useCallback((event, callback) => {
    if (!listenersRef.current[event]) {
      listenersRef.current[event] = [];
    }
    listenersRef.current[event].push(callback);

    // Return unsubscribe function
    return () => {
      if (listenersRef.current[event]) {
        listenersRef.current[event] = listenersRef.current[event].filter(cb => cb !== callback);
      }
    };
  }, []);

  const off = useCallback((event) => {
    delete listenersRef.current[event];
  }, []);

  const emitEvent = useCallback((event, data) => {
    const handlers = listenersRef.current[event];
    if (handlers && handlers.length > 0) {
      handlers.forEach(cb => cb(data));
    }
  }, []);

  const sendSignal = useCallback(async (type, payload = {}) => {
    if (!roomIdRef.current || !clientIdRef.current) return;
    try {
      await fetch('/api/signal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: roomIdRef.current,
          clientId: clientIdRef.current,
          type,
          payload,
        }),
      });
    } catch (err) {
      console.error('[Signaling] Send error:', err);
    }
  }, []);

  const pollSignals = useCallback(async () => {
    if (!roomIdRef.current || !clientIdRef.current) return;
    try {
      const res = await fetch(`/api/signal?roomId=${roomIdRef.current}&clientId=${clientIdRef.current}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.signals && data.signals.length > 0) {
        for (const sig of data.signals) {
          emitEvent(sig.type, sig.payload);
        }
      }
    } catch (err) {
      console.warn('[Signaling] Poll error:', err.message);
    }
  }, [emitEvent]);

  const startPolling = useCallback((roomId) => {
    roomIdRef.current = roomId;
    if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);
    // Poll immediately, then every 800ms
    pollSignals();
    pollingTimerRef.current = setInterval(pollSignals, 800);
  }, [pollSignals]);

  const stopPolling = useCallback(() => {
    if (pollingTimerRef.current) {
      clearInterval(pollingTimerRef.current);
      pollingTimerRef.current = null;
    }
    roomIdRef.current = null;
  }, []);

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
    startPolling(roomId);
    return data;
  }, [startPolling]);

  const joinRoom = useCallback(async (roomId) => {
    roomIdRef.current = roomId;
    const res = await fetch(`/api/rooms/${roomId}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: clientIdRef.current }),
    });
    const data = await res.json();
    if (!res.ok || data.error) {
      const err = new Error(data.error || 'Failed to join room');
      err.code = data.code;
      throw err;
    }
    startPolling(roomId);
    return data;
  }, [startPolling]);

  useEffect(() => {
    return () => {
      if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);
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
