'use client';
import { useRef, useEffect } from 'react';
import io from 'socket.io-client';

let globalSocket = null;

export function useSocket() {
  const socketRef = useRef(null);

  useEffect(() => {
    if (!globalSocket) {
      globalSocket = io({ autoConnect: true });
    }
    socketRef.current = globalSocket;

    return () => {};
  }, []);

  return socketRef;
}