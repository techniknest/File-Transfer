'use client';

export default function Loading() {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-base)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          width: '52px', height: '52px',
          border: '3px solid rgba(99,102,241,0.2)',
          borderTop: '3px solid #6366f1',
          borderRadius: '50%',
          margin: '0 auto 1rem',
          animation: 'spin 0.8s linear infinite'
        }} />
        <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', fontWeight: 600 }}>
          Loading...
        </p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
