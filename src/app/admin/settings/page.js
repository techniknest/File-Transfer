'use client';
import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { Settings, Lock, Eye, EyeOff, CheckCircle, AlertTriangle, Shield } from 'lucide-react';
import { showToast } from '../../components/Toast';

export default function AdminSettingsPage() {
  const { data: session } = useSession();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const passwordsMatch = newPassword && confirmPassword && newPassword === confirmPassword;
  const passwordLongEnough = newPassword.length >= 8;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSuccess(false);

    if (!passwordsMatch) {
      showToast('New passwords do not match', 'error');
      return;
    }
    if (!passwordLongEnough) {
      showToast('Password must be at least 8 characters', 'error');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/admin/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });
      const data = await res.json();

      if (data.error) {
        showToast(data.error, 'error');
      } else {
        showToast('Password changed successfully!', 'success');
        setSuccess(true);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch {
      showToast('Failed to change password. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-enter">
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.375rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Settings size={28} style={{ color: '#f59e0b' }} /> Admin Settings
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Manage your admin account credentials and preferences.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', maxWidth: '900px' }}>
        {/* Account Info Card */}
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border-default)' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'linear-gradient(135deg, #f59e0b, #d97706)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Shield size={20} className="text-white" />
            </div>
            <div>
              <p style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.95rem' }}>Account Information</p>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Your admin account details</p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-default)', padding: '0.875rem 1rem', borderRadius: '0.75rem' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Name</span>
              <p style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: '0.2rem' }}>{session?.user?.name || '—'}</p>
            </div>
            <div style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-default)', padding: '0.875rem 1rem', borderRadius: '0.75rem' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Email</span>
              <p style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: '0.2rem' }}>{session?.user?.email || '—'}</p>
            </div>
            <div style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-default)', padding: '0.875rem 1rem', borderRadius: '0.75rem' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Role</span>
              <span className="badge badge-warning" style={{ marginTop: '0.3rem', display: 'inline-flex' }}>Administrator</span>
            </div>
          </div>
        </div>

        {/* Change Password Card */}
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border-default)' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Lock size={20} className="text-white" />
            </div>
            <div>
              <p style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.95rem' }}>Change Password</p>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Update your admin password</p>
            </div>
          </div>

          {success && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.875rem 1rem', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: '0.75rem', marginBottom: '1.25rem' }}>
              <CheckCircle size={18} style={{ color: '#10b981', flexShrink: 0 }} />
              <p style={{ color: '#34d399', fontSize: '0.875rem', fontWeight: 500 }}>Password changed successfully!</p>
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Current Password */}
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                Current Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showCurrent ? 'text' : 'password'}
                  className="input"
                  placeholder="Enter current password"
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  required
                  style={{ paddingRight: '3rem' }}
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent(v => !v)}
                  style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex' }}
                >
                  {showCurrent ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                New Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showNew ? 'text' : 'password'}
                  className="input"
                  placeholder="At least 8 characters"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  required
                  style={{ paddingRight: '3rem' }}
                />
                <button
                  type="button"
                  onClick={() => setShowNew(v => !v)}
                  style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex' }}
                >
                  {showNew ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {newPassword && !passwordLongEnough && (
                <p style={{ fontSize: '0.75rem', color: 'var(--danger)', marginTop: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <AlertTriangle size={12} /> Must be at least 8 characters
                </p>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                Confirm New Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showConfirm ? 'text' : 'password'}
                  className="input"
                  placeholder="Repeat new password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  required
                  style={{ paddingRight: '3rem', borderColor: confirmPassword ? (passwordsMatch ? 'rgba(16,185,129,0.5)' : 'rgba(239,68,68,0.5)') : undefined }}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(v => !v)}
                  style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex' }}
                >
                  {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {confirmPassword && (
                <p style={{ fontSize: '0.75rem', marginTop: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.3rem', color: passwordsMatch ? '#10b981' : 'var(--danger)' }}>
                  {passwordsMatch
                    ? <><CheckCircle size={12} /> Passwords match</>
                    : <><AlertTriangle size={12} /> Passwords do not match</>
                  }
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || !currentPassword || !passwordsMatch || !passwordLongEnough}
              className="btn btn-primary"
              style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
            >
              {loading ? (
                <>
                  <span style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid white', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} />
                  Updating...
                </>
              ) : (
                <><Lock size={16} /> Change Password</>
              )}
            </button>
          </form>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
