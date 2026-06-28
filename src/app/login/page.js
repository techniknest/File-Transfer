'use client';
import { useState, useEffect, Suspense } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { showToast } from '../components/Toast';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);

  useEffect(() => {
    if (searchParams.get('registered') === 'true') {
      showToast('Registration successful! Please sign in.', 'success');
    }
  }, [searchParams]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const result = await signIn('credentials', {
      email: form.email,
      password: form.password,
      redirect: false,
    });

    if (result?.error) {
      setError(result.error || 'Invalid email or password');
      showToast(result.error || 'Invalid email or password', 'error');
      setLoading(false);
      return;
    }

    showToast('Signed in successfully! Welcome back.', 'success');
    router.push('/dashboard');
  };

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
      {/* Ambient glow orbs */}
      <div style={{
        position: 'fixed', top: '10%', left: '15%',
        width: '500px', height: '500px',
        background: 'radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)',
        pointerEvents: 'none', zIndex: 0,
      }} />
      <div style={{
        position: 'fixed', bottom: '10%', right: '15%',
        width: '400px', height: '400px',
        background: 'radial-gradient(circle, rgba(139,92,246,0.1) 0%, transparent 70%)',
        pointerEvents: 'none', zIndex: 0,
      }} />

      <div
        className="glass-card animate-pop-in"
        style={{
          width: '100%',
          maxWidth: '600px',
          padding: '3rem',
          position: 'relative',
          zIndex: 1,
          border: '1px solid rgba(99,102,241,0.15)',
          boxShadow: '0 25px 60px rgba(0,0,0,0.5), 0 0 80px rgba(99,102,241,0.1)',
        }}
      >
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem', justifyContent: 'center' }}>
          <div
            className="gradient-brand animate-glow"
            style={{ width: '48px', height: '48px', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
          >
            <span style={{ color: 'white', fontSize: '1.5rem' }}>⚡</span>
          </div>
          <div>
            <span style={{ color: 'var(--text-primary)', fontWeight: 800, fontSize: '1.4rem', display: 'block', lineHeight: 1.1 }}>P2P Transfer</span>
            <span style={{ color: 'var(--text-accent)', fontSize: '0.75rem', fontWeight: 600 }}>Secure • Fast • Peer-to-Peer</span>
          </div>
        </div>

        <h1 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', textAlign: 'center', marginBottom: '0.5rem' }}>
          Welcome Back
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', textAlign: 'center', marginBottom: '2.5rem' }}>
          Sign in to your account to continue transferring files.
        </p>

        {error && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            background: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.3)',
            color: '#f87171',
            borderRadius: '0.75rem',
            padding: '1rem 1.25rem',
            marginBottom: '1.75rem',
            fontSize: '0.95rem',
            fontWeight: 500,
          }}>
            <span>❌</span>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div>
            <label style={{
              display: 'block',
              fontSize: '0.9rem',
              fontWeight: 700,
              color: 'var(--text-secondary)',
              marginBottom: '0.6rem',
              letterSpacing: '0.02em',
            }}>
              Email Address
            </label>
            <input
              id="login-email"
              type="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="input"
              required
              autoComplete="email"
              style={{
                padding: '1.25rem 1.5rem',
                fontSize: '1.25rem',
                borderRadius: '0.75rem',
                transition: 'all 0.2s ease',
              }}
            />
          </div>

          <div>
            <label style={{
              display: 'block',
              fontSize: '0.9rem',
              fontWeight: 700,
              color: 'var(--text-secondary)',
              marginBottom: '0.6rem',
              letterSpacing: '0.02em',
            }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                id="login-password"
                type={showPwd ? 'text' : 'password'}
                placeholder="••••••••••"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="input"
                required
                autoComplete="current-password"
                style={{
                  padding: '1.25rem 3.5rem 1.25rem 1.5rem',
                  fontSize: '1.25rem',
                  borderRadius: '0.75rem',
                }}
              />
              <button
                type="button"
                onClick={() => setShowPwd(!showPwd)}
                style={{
                  position: 'absolute',
                  right: '1rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-secondary)',
                  fontSize: '1.25rem',
                  padding: '0.25rem',
                }}
                aria-label={showPwd ? 'Hide password' : 'Show password'}
              >
                {showPwd ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          <button
            id="login-submit"
            type="submit"
            disabled={loading}
            className="btn btn-primary"
            style={{
              width: '100%',
              padding: '1.25rem 2rem',
              fontSize: '1.25rem',
              fontWeight: 700,
              borderRadius: '0.75rem',
              marginTop: '0.5rem',
              letterSpacing: '0.02em',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          >
            {loading ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', justifyContent: 'center' }}>
                <span style={{ width: '18px', height: '18px', border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid white', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />
                Signing in...
              </span>
            ) : '🔐 Sign In'}
          </button>
        </form>

        <div style={{ marginTop: '2rem', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1rem' }}>
            Don&apos;t have an account?{' '}
            <Link
              href="/register"
              style={{
                color: 'var(--text-accent)',
                fontWeight: 700,
                textDecoration: 'none',
                transition: 'color 0.2s ease',
              }}
            >
              Create one free →
            </Link>
          </p>
        </div>

        {/* Feature pills */}
        <div style={{
          display: 'flex',
          gap: '0.5rem',
          justifyContent: 'center',
          flexWrap: 'wrap',
          marginTop: '2rem',
          paddingTop: '1.5rem',
          borderTop: '1px solid var(--border-default)',
        }}>
          {['🔒 End-to-end encrypted', '⚡ WebRTC P2P', '📁 No size limits'].map((f) => (
            <span
              key={f}
              style={{
                fontSize: '0.75rem',
                color: 'var(--text-muted)',
                background: 'var(--bg-glass)',
                border: '1px solid var(--border-default)',
                borderRadius: '999px',
                padding: '0.3rem 0.75rem',
              }}
            >
              {f}
            </span>
          ))}
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: 'var(--bg-base)' }} />}>
      <LoginForm />
    </Suspense>
  );
}