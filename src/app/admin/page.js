'use client';
import { useEffect, useState } from 'react';
import {
  AlertTriangle, Users, CheckCircle, Ban, UserPlus, Package,
  XCircle, Loader, BarChart3, HardDrive, Link as LinkIcon,
  Heart, RotateCcw, AlertCircle, Star
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar
} from 'recharts';

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
        <div style={{ width: '46px', height: '46px', borderRadius: '12px', background: gradient || `linear-gradient(135deg, ${color}, ${color}bb)`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 4px 12px ${color}33` }}>
          {icon}
        </div>
        {sub && <span className="badge badge-muted" style={{ fontSize: '0.7rem' }}>{sub}</span>}
      </div>
      <p style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1, marginBottom: '0.375rem' }}>{value}</p>
      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{label}</p>
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload?.length) {
    return (
      <div className="glass-card" style={{ padding: '0.75rem 1rem', fontSize: '0.82rem' }}>
        <p style={{ color: 'var(--text-primary)', fontWeight: 700, marginBottom: '0.3rem' }}>{label}</p>
        {payload.map((p, i) => (
          <p key={i} style={{ color: p.color }}>{p.name}: <strong>{p.value}</strong></p>
        ))}
      </div>
    );
  }
  return null;
};

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
          {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
            <div key={i} className="skeleton" style={{ height: '140px', borderRadius: '1rem' }} />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-card" style={{ padding: '2rem', textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
          <AlertTriangle size={48} style={{ color: '#f59e0b' }} />
        </div>
        <p style={{ color: 'var(--danger)', fontWeight: 600 }}>{error}</p>
      </div>
    );
  }

  const { users = {}, transfers = {}, chartData = [], recentErrors = [] } = stats || {};

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
        <button onClick={fetchStats} className="btn btn-secondary btn-sm" disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <RotateCcw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* USER STATS */}
      <div style={{ marginBottom: '1.5rem' }}>
        <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.875rem' }}>Users</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }} className="stagger">
          <StatCard icon={<Users size={24} className="text-white" />} label="Total Users" value={users.totalUsers ?? '—'} color="#6366f1" gradient="linear-gradient(135deg, #6366f1, #8b5cf6)" />
          <StatCard icon={<CheckCircle size={24} className="text-white" />} label="Active Users" value={users.activeUsers ?? '—'} color="#10b981" gradient="linear-gradient(135deg, #10b981, #059669)" />
          <StatCard icon={<Ban size={24} className="text-white" />} label="Blocked Users" value={users.suspendedUsers ?? '—'} color="#ef4444" gradient="linear-gradient(135deg, #ef4444, #dc2626)" />
          <StatCard icon={<UserPlus size={24} className="text-white" />} label="New This Week" value={users.newUsersThisWeek ?? '—'} color="#06b6d4" gradient="linear-gradient(135deg, #06b6d4, #0891b2)" sub="7 days" />
        </div>
      </div>

      {/* TRANSFER STATS */}
      <div style={{ marginBottom: '1.5rem' }}>
        <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.875rem' }}>Transfers</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }} className="stagger">
          <StatCard icon={<Package size={24} className="text-white" />} label="Total Transfers" value={transfers.totalTransfers ?? '—'} color="#6366f1" gradient="linear-gradient(135deg, #6366f1, #8b5cf6)" />
          <StatCard icon={<CheckCircle size={24} className="text-white" />} label="Successful" value={transfers.successTransfers ?? '—'} color="#10b981" gradient="linear-gradient(135deg, #10b981, #059669)" />
          <StatCard icon={<XCircle size={24} className="text-white" />} label="Failed" value={transfers.failedTransfers ?? '—'} color="#ef4444" gradient="linear-gradient(135deg, #ef4444, #dc2626)" />
          <StatCard icon={<Loader size={24} className="text-white" />} label="In Progress" value={transfers.inProgressTransfers ?? '—'} color="#f59e0b" gradient="linear-gradient(135deg, #f59e0b, #d97706)" />
          <StatCard icon={<BarChart3 size={24} className="text-white" />} label="Success Rate" value={`${transfers.successRate ?? 0}%`} color="#8b5cf6" gradient="linear-gradient(135deg, #8b5cf6, #7c3aed)" />
          <StatCard icon={<HardDrive size={24} className="text-white" />} label="Data Transferred" value={formatBytes(transfers.totalBytes)} color="#06b6d4" gradient="linear-gradient(135deg, #06b6d4, #0891b2)" />
          <StatCard icon={<LinkIcon size={24} className="text-white" />} label="Active Sessions" value={transfers.activeSessions ?? 0} color="#10b981" gradient="linear-gradient(135deg, #10b981, #059669)" sub="live" />
        </div>
      </div>

      {/* CHART — Transfers last 7 days */}
      <div style={{ marginBottom: '1.5rem' }}>
        <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.875rem' }}>
          Transfers — Last 7 Days
        </p>
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          {chartData.length === 0 || chartData.every(d => d.transfers === 0) ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px', color: 'var(--text-secondary)', flexDirection: 'column', gap: '0.5rem' }}>
              <BarChart3 size={32} style={{ opacity: 0.4 }} />
              <p style={{ fontSize: '0.85rem' }}>No transfers in the last 7 days</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="transferGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis
                  dataKey="day"
                  tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                  axisLine={{ stroke: 'var(--border-default)' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="transfers"
                  name="Transfers"
                  stroke="#6366f1"
                  strokeWidth={2.5}
                  fill="url(#transferGrad)"
                  dot={{ r: 4, fill: '#6366f1', stroke: 'var(--bg-base)', strokeWidth: 2 }}
                  activeDot={{ r: 6 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ERROR LOG */}
      <div style={{ marginBottom: '2rem' }}>
        <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.875rem' }}>
          Recent System Errors
        </p>
        <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
          {recentErrors.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
              <CheckCircle size={32} style={{ color: '#10b981', margin: '0 auto 0.5rem', display: 'block' }} />
              <p style={{ fontSize: '0.85rem' }}>No errors logged — system running smoothly</p>
            </div>
          ) : (
            <div>
              {recentErrors.map((err, i) => (
                <div
                  key={err._id || i}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: '0.875rem', padding: '0.875rem 1.25rem',
                    borderBottom: i < recentErrors.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                  }}
                >
                  <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '0.1rem', color: err.severity === 'critical' ? '#ef4444' : err.severity === 'high' ? '#f97316' : '#f59e0b' }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                      <p style={{ color: 'var(--text-primary)', fontSize: '0.85rem', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {err.message}
                      </p>
                      <span className={`badge ${err.severity === 'critical' ? 'badge-danger' : err.severity === 'high' ? 'badge-danger' : 'badge-warning'}`} style={{ flexShrink: 0, fontSize: '0.65rem' }}>
                        {err.severity || 'medium'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '1rem', marginTop: '0.2rem' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{err.route || 'unknown route'}</span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        {new Date(err.timestamp).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick Links */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem' }}>
        {[
          { href: '/admin/users', icon: <Users size={32} style={{ color: '#818cf8' }} />, label: 'Manage Users', desc: 'View, block, and manage roles' },
          { href: '/admin/transfers', icon: <Package size={32} style={{ color: '#818cf8' }} />, label: 'Transfer Records', desc: 'Audit all file transfers' },
          { href: '/admin/reviews', icon: <Star size={32} style={{ color: '#818cf8' }} />, label: 'Review Moderation', desc: 'Approve or reject user reviews' },
          { href: '/admin/health', icon: <Heart size={32} style={{ color: '#818cf8' }} />, label: 'System Health', desc: 'Monitor server and database' },
        ].map(card => (
          <a key={card.href} href={card.href} className="card card-hover" style={{ padding: '1.5rem', display: 'block', textDecoration: 'none' }}>
            <span style={{ display: 'block', marginBottom: '0.75rem' }}>{card.icon}</span>
            <h3 style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '0.95rem', marginBottom: '0.375rem' }}>{card.label}</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{card.desc}</p>
          </a>
        ))}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
