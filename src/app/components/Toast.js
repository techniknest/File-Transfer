'use client';
import { useState, useEffect, useCallback } from 'react';

// Global toast emitter — usable from any file (no sessionStorage/localStorage)
let globalAddToast = null;

export function showToast(message, type = 'info', duration = 4000) {
  if (globalAddToast) {
    globalAddToast(message, type, duration);
  } else {
    // Queue until mount
    if (typeof window !== 'undefined') {
      window.__pendingToasts = window.__pendingToasts || [];
      window.__pendingToasts.push({ message, type, duration });
    }
  }
}

const ICONS = {
  success: '✅',
  error: '❌',
  warning: '⚠️',
  info: 'ℹ️',
};

const STYLES = {
  success: 'toast-success',
  error: 'toast-error',
  warning: 'toast-warning',
  info: 'toast-info',
};

function ToastItem({ id, message, type, duration, onClose }) {
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      setExiting(true);
      setTimeout(() => onClose(id), 350);
    }, duration);
    return () => clearTimeout(t);
  }, [id, duration, onClose]);

  const handleClose = () => {
    setExiting(true);
    setTimeout(() => onClose(id), 350);
  };

  return (
    <div
      className={`toast ${STYLES[type] || 'toast-info'}`}
      style={{
        opacity: exiting ? 0 : 1,
        transform: exiting ? 'translateX(120%)' : 'translateX(0)',
        transition: 'all 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
        pointerEvents: 'all',
      }}
    >
      <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>{ICONS[type] || 'ℹ️'}</span>
      <span style={{ flex: 1, fontSize: '0.9rem', fontWeight: 600, lineHeight: 1.4 }}>{message}</span>
      <button
        onClick={handleClose}
        style={{
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: 'inherit',
          opacity: 0.7,
          fontSize: '1rem',
          padding: '0 0.25rem',
          lineHeight: 1,
        }}
        aria-label="Close notification"
      >
        ×
      </button>
    </div>
  );
}

export function ToastProvider() {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    setToasts(prev => [...prev, { id, message, type, duration }]);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  useEffect(() => {
    globalAddToast = addToast;
    // Flush any queued toasts from before mount
    if (typeof window !== 'undefined' && window.__pendingToasts?.length) {
      window.__pendingToasts.forEach(({ message, type, duration }) => addToast(message, type, duration));
      window.__pendingToasts = [];
    }
    return () => { globalAddToast = null; };
  }, [addToast]);

  if (toasts.length === 0) return null;

  return (
    <div className="toast-wrap" aria-live="polite" aria-atomic="false">
      {toasts.map(toast => (
        <ToastItem
          key={toast.id}
          {...toast}
          onClose={removeToast}
        />
      ))}
    </div>
  );
}

// Hook version for component-level usage
export function useToast() {
  const addToast = useCallback((message, type = 'info', duration = 4000) => {
    showToast(message, type, duration);
  }, []);

  return { addToast, showToast };
}