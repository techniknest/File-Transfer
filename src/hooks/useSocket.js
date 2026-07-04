'use client';
import { useRef, useEffect } from 'react';
import io from 'socket.io-client';

export function useSocket() {
  const socketRef = useRef(null);

  useEffect(() => {
    if (!socketRef.current) {
      socketRef.current = io(window.location.origin, {
        transports: ['websocket', 'polling'],
        autoConnect: true,
      });
    }

    return () => {};
  }, []);

  return socketRef;
}