'use client';
import { useEffect, useState } from 'react';

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(2)} MB`;
  return `${(bytes / 1073741824).toFixed(2)} GB`;
}

function StatCard({ icon, label, value, sub, color = '#6366f1', gradient }) {
  return (
    <div className="stat-card animate-fade-up">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <div style={{ width: '46px', height: '46px', borderRadius: '12px', background: gradient || `linear-gradient(135deg, ${color}, ${color}bb)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem', boxShadow: `0 4px 12px ${color}33` }}>
          {icon}
        </div>
        {sub && <span className="badge badge-muted" style={{ fontSize: '0.7rem' }}>{sub}</span>}
      </div>
      <p style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1, marginBottom: '0.375rem' }}>{value}</p>
      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{label}</p>
    </div>
  );
}

export default function AdminOverviewPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchStats = () => {
    setLoading(true);
    fetch('/api/admin/stats')
      .then(r => r.json())
      .then(data => { setStats(data); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading && !stats) {
    return (
      <div>
        <div style={{ marginBottom: '2rem' }}>
          <div className="skeleton" style={{ height: '2rem', width: '200px', marginBottom: '0.5rem' }} />
          <div className="skeleton" style={{ height: '1rem', width: '300px' }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem' }}>
          {[1,2,3,4,5,6,7,8].map(i => <div key={i} className="skeleton" style={{ height: '140px', borderRadius: '1rem' }} />)}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-card" style={{ padding: '2rem', textAlign: 'center' }}>
        <span style={{ fontSize: '3rem', display: 'block', marginBottom: '1rem' }}>⚠️</span>
        <p style={{ color: 'var(--danger)', fontWeight: 600 }}>{error}</p>
      </div>
    );
  }

  const { users = {}, transfers = {} } = stats || {};

  return (
    <div className="page-enter">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.375rem' }}>
            Admin Overview
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Real-time system statistics • Auto-refreshes every 30s</p>
        </div>
        <button onClick={fetchStats} className="btn btn-secondary btn-sm" disabled={loading}>
          {loading ? '⟳ Refreshing...' : '↻ Refresh'}
        </button>
      </div>

      {/* USER STATS */}
      <div style={{ marginBottom: '1rem' }}>
        <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.875rem' }}>Users</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }} className="stagger">
          <StatCard icon="👥" label="Total Users" value={users.totalUsers ?? '—'} color="#6366f1" gradient="linear-gradient(135deg, #6366f1, #8b5cf6)" />
          <StatCard icon="✅" label="Active Users" value={users.activeUsers ?? '—'} color="#10b981" gradient="linear-gradient(135deg, #10b981, #059669)" />
          <StatCard icon="🚫" label="Suspended" value={users.suspendedUsers ?? '—'} color="#ef4444" gradient="linear-gradient(135deg, #ef4444, #dc2626)" />
          <StatCard icon="🆕" label="New This Week" value={users.newUsersThisWeek ?? '—'} color="#06b6d4" gradient="linear-gradient(135deg, #06b6d4, #0891b2)" sub="7 days" />
        </div>
      </div>

      {/* TRANSFER STATS */}
      <div>
        <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.875rem' }}>Transfers</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }} className="stagger">
          <StatCard icon="📦" label="Total Transfers" value={transfers.totalTransfers ?? '—'} color="#6366f1" gradient="linear-gradient(135deg, #6366f1, #8b5cf6)" />
          <StatCard icon="✅" label="Successful" value={transfers.successTransfers ?? '—'} color="#10b981" gradient="linear-gradient(135deg, #10b981, #059669)" />
          <StatCard icon="❌" label="Failed" value={transfers.failedTransfers ?? '—'} color="#ef4444" gradient="linear-gradient(135deg, #ef4444, #dc2626)" />
          <StatCard icon="🔴" label="In Progress" value={transfers.inProgressTransfers ?? '—'} color="#f59e0b" gradient="linear-gradient(135deg, #f59e0b, #d97706)" />
          <StatCard icon="📊" label="Success Rate" value={`${transfers.successRate ?? 0}%`} color="#8b5cf6" gradient="linear-gradient(135deg, #8b5cf6, #7c3aed)" />
          <StatCard icon="💾" label="Data Transferred" value={formatBytes(transfers.totalBytes)} color="#06b6d4" gradient="linear-gradient(135deg, #06b6d4, #0891b2)" />
          <StatCard icon="🔗" label="Active Sessions" value={transfers.activeSessions ?? 0} color="#10b981" gradient="linear-gradient(135deg, #10b981, #059669)" sub="live" />
        </div>
      </div>

      {/* Quick Links */}
      <div style={{ marginTop: '2rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem' }}>
        {[
          { href: '/admin/users', icon: '👥', label: 'Manage Users', desc: 'View, suspend, and delete users' },
          { href: '/admin/transfers', icon: '📦', label: 'Transfer Records', desc: 'Audit all file transfers' },
          { href: '/admin/health', icon: '❤️', label: 'System Health', desc: 'Monitor server and database' },
        ].map(card => (
          <a key={card.href} href={card.href} className="card card-hover" style={{ padding: '1.5rem', display: 'block', textDecoration: 'none' }}>
            <span style={{ fontSize: '1.75rem', display: 'block', marginBottom: '0.75rem' }}>{card.icon}</span>
            <h3 style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '0.95rem', marginBottom: '0.375rem' }}>{card.label}</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{card.desc}</p>
          </a>
        ))}
      </div>
    </div>
  );
}
