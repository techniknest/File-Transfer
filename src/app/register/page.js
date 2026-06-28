'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { showToast } from '../components/Toast';

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [strength, setStrength] = useState(0);

  const calcStrength = (pwd) => {
    let s = 0;
    if (pwd.length >= 8) s++;
    if (/[A-Z]/.test(pwd)) s++;
    if (/[0-9]/.test(pwd)) s++;
    if (/[^A-Za-z0-9]/.test(pwd)) s++;
    return s;
  };

  const strengthLabels = ['', 'Weak', 'Fair', 'Good', 'Strong'];
  const strengthColors = ['', '#ef4444', '#f59e0b', '#06b6d4', '#10b981'];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirm) {
      setError('Passwords do not match.');
      showToast('Passwords do not match', 'error');
      return;
    }
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters.');
      showToast('Password too short', 'error');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name, email: form.email, password: form.password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Something went wrong');
        showToast(data.error || 'Something went wrong', 'error');
        setLoading(false);
        return;
      }

      showToast('Account created! Redirecting to login...', 'success');
      router.push('/login?registered=true');
    } catch (err) {
      setError('Registration failed. Please check your connection.');
      showToast('Registration failed', 'error');
      setLoading(false);
    }
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
      {/* Ambient orbs */}
      <div style={{
        position: 'fixed', top: '5%', right: '10%',
        width: '600px', height: '600px',
        background: 'radial-gradient(circle, rgba(139,92,246,0.1) 0%, transparent 70%)',
        pointerEvents: 'none', zIndex: 0,
      }} />
      <div style={{
        position: 'fixed', bottom: '5%', left: '10%',
        width: '400px', height: '400px',
        background: 'radial-gradient(circle, rgba(6,182,212,0.08) 0%, transparent 70%)',
        pointerEvents: 'none', zIndex: 0,
      }} />

      <div
        className="glass-card animate-pop-in"
        style={{
          width: '100%',
          maxWidth: '620px',
          padding: '3rem',
          position: 'relative',
          zIndex: 1,
          border: '1px solid rgba(139,92,246,0.15)',
          boxShadow: '0 25px 60px rgba(0,0,0,0.5), 0 0 80px rgba(139,92,246,0.08)',
        }}
      >
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem', justifyContent: 'center' }}>
          <div
            style={{
              width: '48px', height: '48px', borderRadius: '14px',
              background: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 20px rgba(139,92,246,0.4)',
            }}
          >
            <span style={{ color: 'white', fontSize: '1.5rem' }}>⚡</span>
          </div>
          <div>
            <span style={{ color: 'var(--text-primary)', fontWeight: 800, fontSize: '1.4rem', display: 'block', lineHeight: 1.1 }}>P2P Transfer</span>
            <span style={{ color: '#8b5cf6', fontSize: '0.75rem', fontWeight: 600 }}>Create your free account</span>
          </div>
        </div>

        <h1 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', textAlign: 'center', marginBottom: '0.5rem' }}>
          Create Account
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', textAlign: 'center', marginBottom: '2.5rem' }}>
          Join thousands of users sharing files directly with zero cloud storage.
        </p>

        {error && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.75rem',
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
            color: '#f87171', borderRadius: '0.75rem', padding: '1rem 1.25rem',
            marginBottom: '1.75rem', fontSize: '0.95rem', fontWeight: 500,
          }}>
            <span>❌</span><span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.6rem' }}>
              Full Name
            </label>
            <input
              id="register-name"
              type="text"
              placeholder="Alex Johnson"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="input"
              required
              autoComplete="name"
              style={{ padding: '1.25rem 1.5rem', fontSize: '1.25rem', borderRadius: '0.75rem' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.6rem' }}>
              Email Address
            </label>
            <input
              id="register-email"
              type="email"
              placeholder="alex@example.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="input"
              required
              autoComplete="email"
              style={{ padding: '1.25rem 1.5rem', fontSize: '1.25rem', borderRadius: '0.75rem' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.6rem' }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                id="register-password"
                type={showPwd ? 'text' : 'password'}
                placeholder="Min. 6 characters"
                value={form.password}
                onChange={(e) => {
                  setForm({ ...form, password: e.target.value });
                  setStrength(calcStrength(e.target.value));
                }}
                className="input"
                required
                autoComplete="new-password"
                style={{ padding: '1.25rem 3.5rem 1.25rem 1.5rem', fontSize: '1.25rem', borderRadius: '0.75rem' }}
              />
              <button
                type="button"
                onClick={() => setShowPwd(!showPwd)}
                style={{
                  position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)',
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  color: 'var(--text-secondary)', fontSize: '1.25rem',
                }}
              >
                {showPwd ? '🙈' : '👁️'}
              </button>
            </div>
            {/* Password strength bar */}
            {form.password && (
              <div style={{ marginTop: '0.5rem' }}>
                <div style={{ display: 'flex', gap: '4px', marginBottom: '0.25rem' }}>
                  {[1, 2, 3, 4].map(i => (
                    <div
                      key={i}
                      style={{
                        flex: 1, height: '4px', borderRadius: '999px',
                        background: i <= strength ? strengthColors[strength] : 'var(--bg-elevated)',
                        transition: 'background 0.3s ease',
                      }}
                    />
                  ))}
                </div>
                <span style={{ fontSize: '0.75rem', color: strengthColors[strength] || 'var(--text-muted)', fontWeight: 600 }}>
                  {strengthLabels[strength] || ''}
                </span>
              </div>
            )}
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.6rem' }}>
              Confirm Password
            </label>
            <input
              id="register-confirm"
              type={showPwd ? 'text' : 'password'}
              placeholder="Re-enter your password"
              value={form.confirm}
              onChange={(e) => setForm({ ...form, confirm: e.target.value })}
              className="input"
              required
              autoComplete="new-password"
              style={{
                padding: '1.25rem 1.5rem', fontSize: '1.25rem', borderRadius: '0.75rem',
                borderColor: form.confirm && form.password !== form.confirm ? 'rgba(239,68,68,0.5)' : undefined,
              }}
            />
            {form.confirm && form.password !== form.confirm && (
              <p style={{ fontSize: '0.8rem', color: '#f87171', marginTop: '0.35rem' }}>Passwords don&apos;t match</p>
            )}
          </div>

          <button
            id="register-submit"
            type="submit"
            disabled={loading}
            className="btn btn-primary"
            style={{
              width: '100%', padding: '1.25rem 2rem', fontSize: '1.25rem',
              fontWeight: 700, borderRadius: '0.75rem', marginTop: '0.5rem',
            }}
          >
            {loading ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', justifyContent: 'center' }}>
                <span style={{ width: '18px', height: '18px', border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid white', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />
                Creating account...
              </span>
            ) : '🚀 Create Free Account'}
          </button>
        </form>

        <div style={{ marginTop: '2rem', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1rem' }}>
            Already have an account?{' '}
            <Link href="/login" style={{ color: 'var(--text-accent)', fontWeight: 700, textDecoration: 'none' }}>
              Sign in →
            </Link>
          </p>
        </div>

        {/* Feature pills */}
        <div style={{
          display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap',
          marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border-default)',
        }}>
          {['✅ Free forever', '🔒 No data stored', '⚡ Instant transfers'].map((f) => (
            <span key={f} style={{
              fontSize: '0.75rem', color: 'var(--text-muted)', background: 'var(--bg-glass)',
              border: '1px solid var(--border-default)', borderRadius: '999px', padding: '0.3rem 0.75rem',
            }}>
              {f}
            </span>
          ))}
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}