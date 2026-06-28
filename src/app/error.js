'use client';
import { useEffect } from 'react';
import Link from 'next/link';

export default function GlobalError({ error, reset }) {
  useEffect(() => {
    console.error('Global application error:', error);
  }, [error]);

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-base)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem 1.5rem',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{
        position: 'fixed', top: '20%', left: '20%',
        width: '500px', height: '500px',
        background: 'radial-gradient(circle, rgba(239,68,68,0.1) 0%, transparent 70%)',
        pointerEvents: 'none', zIndex: 0,
      }} />

      <div
        className="glass-card animate-pop-in"
        style={{
          width: '100%',
          maxWidth: '500px',
          padding: '3rem',
          position: 'relative',
          zIndex: 1,
          border: '1px solid rgba(239,68,68,0.2)',
          boxShadow: '0 25px 60px rgba(0,0,0,0.5), 0 0 80px rgba(239,68,68,0.1)',
          textAlign: 'center',
        }}
      >
        <div style={{
          width: '64px', height: '64px', borderRadius: '16px',
          background: 'linear-gradient(135deg, #ef4444, #b91c1c)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 1.5rem',
          boxShadow: '0 8px 24px rgba(239,68,68,0.35)'
        }}>
          <span style={{ fontSize: '2rem' }}>⚠️</span>
        </div>

        <h1 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '1rem' }}>
          Something went wrong
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', marginBottom: '2rem' }}>
          We encountered an unexpected error. This might be a temporary issue with our servers or your connection.
        </p>

        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '0.75rem', padding: '1rem', marginBottom: '2rem', textAlign: 'left', overflowX: 'auto' }}>
          <p style={{ color: '#f87171', fontSize: '0.85rem', fontFamily: 'monospace' }}>
            {error.message || 'Unknown error occurred'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
          <button
            onClick={() => reset()}
            className="btn btn-primary"
            style={{ padding: '0.875rem 1.5rem', fontWeight: 700 }}
          >
            🔄 Try Again
          </button>
          <Link href="/" className="btn btn-secondary" style={{ padding: '0.875rem 1.5rem', fontWeight: 700 }}>
            🏠 Go Home
          </Link>
        </div>
      </div>
    </div>
  );
}
