'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Activity, Search, RefreshCw, Trash2, Filter, AlertTriangle,
  CheckCircle, Info, XCircle, ChevronRight, Copy, Check,
  Clock, User, Radio, ArrowUpDown, Database, Cpu, Eye, X
} from 'lucide-react';

const CATEGORIES = [
  { id: 'all', label: 'All Categories' },
  { id: 'auth', label: '🔐 Auth & Logins' },
  { id: 'navigation', label: '🧭 Page Views' },
  { id: 'file', label: '📁 Files & Selections' },
  { id: 'room', label: '🚪 Rooms & Links' },
  { id: 'webrtc', label: '📡 WebRTC Signaling' },
  { id: 'transfer', label: '⚡ File Transfers' },
  { id: 'system', label: '⚙️ System & Errors' },
];

const LEVELS = [
  { id: 'all', label: 'All Levels' },
  { id: 'error', label: '🔴 Errors', color: '#ef4444' },
  { id: 'warn', label: '🟡 Warnings', color: '#f59e0b' },
  { id: 'success', label: '🟢 Success', color: '#10b981' },
  { id: 'info', label: '🔵 Info', color: '#6366f1' },
];

export default function AdminLogsPage() {
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState({ totalLogs: 0, totalErrors: 0, uniqueRooms: 0, uniqueUsers: 0 });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [category, setCategory] = useState('all');
  const [level, setLevel] = useState('all');
  const [search, setSearch] = useState('');
  const [roomFilter, setRoomFilter] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(5000);
  const [selectedLog, setSelectedLog] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [clearing, setClearing] = useState(false);

  const timerRef = useRef(null);

  const fetchLogs = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '50',
        _t: Date.now().toString(),
      });
      if (category !== 'all') params.set('category', category);
      if (level !== 'all') params.set('level', level);
      if (search.trim()) params.set('search', search.trim());
      if (roomFilter.trim()) params.set('roomId', roomFilter.trim().toUpperCase());

      const res = await fetch(`/api/admin/logs?${params.toString()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      });
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
        setTotalPages(data.pages || 1);
        if (data.stats) setStats(data.stats);
      } else {
        console.error('[AdminLogs] Fetch failed:', res.status, await res.text().catch(() => ''));
      }
    } catch (err) {
      console.error('[AdminLogs] Fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [page, category, level, search, roomFilter]);

  useEffect(() => {
    fetchLogs(true);
  }, [fetchLogs]);

  // Auto-refresh loop
  useEffect(() => {
    if (!autoRefresh) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    timerRef.current = setInterval(() => {
      fetchLogs(false);
    }, refreshInterval);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [autoRefresh, refreshInterval, fetchLogs]);

  const handleClearLogs = async () => {
    if (!confirm('Are you sure you want to clear all system audit logs?')) return;
    setClearing(true);
    try {
      const res = await fetch(`/api/admin/logs?_t=${Date.now()}`, {
        method: 'DELETE',
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      });
      if (res.ok) {
        fetchLogs(true);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setClearing(false);
    }
  };

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(typeof text === 'object' ? JSON.stringify(text, null, 2) : text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getLevelBadge = (lvl) => {
    switch (lvl) {
      case 'error':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', padding: '0.2rem 0.6rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700 }}>
            <XCircle size={13} /> ERROR
          </span>
        );
      case 'warn':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)', padding: '0.2rem 0.6rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700 }}>
            <AlertTriangle size={13} /> WARN
          </span>
        );
      case 'success':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)', padding: '0.2rem 0.6rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700 }}>
            <CheckCircle size={13} /> SUCCESS
          </span>
        );
      default:
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', background: 'rgba(99,102,241,0.15)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.3)', padding: '0.2rem 0.6rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700 }}>
            <Info size={13} /> INFO
          </span>
        );
    }
  };

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Title & Live Status Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'linear-gradient(135deg, #f59e0b, #d97706)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(245,158,11,0.3)' }}>
              <Activity size={22} className="text-white" />
            </div>
            <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.02em' }}>
              System Event & Audit Logs
            </h1>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', margin: 0 }}>
            Full real-time telemetry across Logins, Page Views, Rooms, WebRTC Handshakes & Errors.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          {/* Auto Refresh Toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--bg-glass)', border: '1px solid var(--border-default)', padding: '0.4rem 0.8rem', borderRadius: '0.75rem' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: autoRefresh ? '#10b981' : '#6b7280', boxShadow: autoRefresh ? '0 0 10px #10b981' : 'none' }} />
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Live Polling</span>
            <button
              onClick={() => setAutoRefresh(v => !v)}
              style={{ background: 'transparent', border: 'none', color: autoRefresh ? '#10b981' : 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}
            >
              {autoRefresh ? 'ON' : 'PAUSED'}
            </button>
          </div>

          <button
            onClick={() => fetchLogs(true)}
            disabled={loading}
            className="btn btn-ghost btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', border: '1px solid var(--border-default)' }}
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>

          <button
            onClick={handleClearLogs}
            disabled={clearing || logs.length === 0}
            className="btn btn-ghost btn-sm"
            style={{ color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <Trash2 size={15} /> Clear Logs
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
        {[
          { label: 'Total Events Logged', value: stats.totalLogs, icon: <Database size={20} color="#6366f1" />, bg: 'rgba(99,102,241,0.1)' },
          { label: 'System Errors', value: stats.totalErrors, icon: <XCircle size={20} color="#ef4444" />, bg: 'rgba(239,68,68,0.1)' },
          { label: 'Transfer Rooms Tracked', value: stats.uniqueRooms, icon: <Radio size={20} color="#10b981" />, bg: 'rgba(16,185,129,0.1)' },
          { label: 'Unique Users', value: stats.uniqueUsers, icon: <User size={20} color="#f59e0b" />, bg: 'rgba(245,158,11,0.1)' },
        ].map((k, i) => (
          <div key={i} className="glass-card" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: k.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {k.icon}
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>{k.label}</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)' }}>{k.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filter Toolbar */}
      <div className="glass-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {/* Search and Room Filter */}
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ flex: 2, minWidth: '240px', position: 'relative' }}>
            <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search by event, message, user email, or metadata..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: '100%', boxSizing: 'border-box',
                background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
                borderRadius: '0.75rem', padding: '0.75rem 1rem 0.75rem 2.5rem',
                color: 'white', fontSize: '0.9rem', outline: 'none',
              }}
            />
          </div>

          <div style={{ flex: 1, minWidth: '180px' }}>
            <input
              type="text"
              placeholder="Filter by Room ID (e.g. 7A8B9C)"
              value={roomFilter}
              onChange={e => setRoomFilter(e.target.value.toUpperCase())}
              style={{
                width: '100%', boxSizing: 'border-box',
                background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
                borderRadius: '0.75rem', padding: '0.75rem 1rem',
                color: '#10b981', fontFamily: 'monospace', fontWeight: 700, fontSize: '0.9rem', outline: 'none',
              }}
            />
          </div>

          <div style={{ minWidth: '150px' }}>
            <select
              value={level}
              onChange={e => setLevel(e.target.value)}
              style={{
                width: '100%', boxSizing: 'border-box',
                background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
                borderRadius: '0.75rem', padding: '0.75rem 1rem',
                color: 'white', fontSize: '0.9rem', outline: 'none', cursor: 'pointer'
              }}
            >
              {LEVELS.map(l => (
                <option key={l.id} value={l.id}>{l.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Category Pills */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {CATEGORIES.map(c => (
            <button
              key={c.id}
              onClick={() => { setCategory(c.id); setPage(1); }}
              style={{
                background: category === c.id ? 'linear-gradient(135deg, #f59e0b, #d97706)' : 'var(--bg-elevated)',
                border: `1px solid ${category === c.id ? '#f59e0b' : 'var(--border-default)'}`,
                color: category === c.id ? 'white' : 'var(--text-secondary)',
                borderRadius: '999px', padding: '0.4rem 0.9rem',
                fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
              }}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Logs Table */}
      <div className="glass-card" style={{ padding: '0', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--border-default)' }}>
                <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase' }}>Time</th>
                <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase' }}>Level</th>
                <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase' }}>Event / Category</th>
                <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase' }}>Message</th>
                <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase' }}>Room ID</th>
                <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase' }}>User / Client</th>
                <th style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase' }}>Inspect</th>
              </tr>
            </thead>
            <tbody>
              {loading && logs.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-secondary)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                      <RefreshCw size={28} className="animate-spin text-amber-500" />
                      <span>Loading real-time logs...</span>
                    </div>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-secondary)' }}>
                    <Info size={32} style={{ margin: '0 auto 0.75rem', color: 'var(--text-muted)' }} />
                    <p style={{ margin: 0, fontWeight: 600 }}>No system logs match your filters</p>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Try resetting your category or search queries.</span>
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr
                    key={log._id}
                    onClick={() => setSelectedLog(log)}
                    style={{
                      borderBottom: '1px solid var(--border-subtle)',
                      cursor: 'pointer',
                      transition: 'background 0.15s ease',
                      background: selectedLog?._id === log._id ? 'rgba(245,158,11,0.08)' : 'transparent',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                    onMouseLeave={e => e.currentTarget.style.background = selectedLog?._id === log._id ? 'rgba(245,158,11,0.08)' : 'transparent'}
                  >
                    <td style={{ padding: '0.875rem 1rem', whiteSpace: 'nowrap', color: 'var(--text-secondary)', fontSize: '0.8rem', fontFamily: 'monospace' }}>
                      {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 })}
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{new Date(log.timestamp).toLocaleDateString()}</div>
                    </td>

                    <td style={{ padding: '0.875rem 1rem', whiteSpace: 'nowrap' }}>
                      {getLevelBadge(log.level)}
                    </td>

                    <td style={{ padding: '0.875rem 1rem', whiteSpace: 'nowrap' }}>
                      <span style={{ fontWeight: 700, color: 'var(--text-primary)', display: 'block' }}>{log.eventType}</span>
                      <span style={{ fontSize: '0.7rem', color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{log.category}</span>
                    </td>

                    <td style={{ padding: '0.875rem 1rem', maxWidth: '340px' }}>
                      <div style={{ color: 'var(--text-primary)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {log.message}
                      </div>
                    </td>

                    <td style={{ padding: '0.875rem 1rem', whiteSpace: 'nowrap' }}>
                      {log.roomId ? (
                        <button
                          onClick={(e) => { e.stopPropagation(); setRoomFilter(log.roomId); }}
                          style={{
                            background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)',
                            borderRadius: '6px', padding: '0.2rem 0.5rem',
                            color: '#10b981', fontFamily: 'monospace', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer'
                          }}
                          title="Click to filter only this room"
                        >
                          {log.roomId}
                        </button>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>—</span>
                      )}
                    </td>

                    <td style={{ padding: '0.875rem 1rem', maxWidth: '180px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {log.userEmail ? (
                        <div style={{ color: 'var(--text-primary)', fontSize: '0.8rem' }}>{log.userEmail}</div>
                      ) : log.clientId ? (
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontFamily: 'monospace' }}>{log.clientId.substring(0, 14)}…</div>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Guest</span>
                      )}
                    </td>

                    <td style={{ padding: '0.875rem 1rem', textAlign: 'center' }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); setSelectedLog(log); }}
                        className="btn btn-ghost btn-sm"
                        style={{ padding: '0.3rem 0.6rem', color: '#f59e0b' }}
                      >
                        <Eye size={15} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div style={{ padding: '1rem', borderTop: '1px solid var(--border-default)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              Page {page} of {totalPages} ({stats.totalLogs} total records)
            </span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn btn-ghost btn-sm"
                style={{ border: '1px solid var(--border-default)' }}
              >
                Previous
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="btn btn-ghost btn-sm"
                style={{ border: '1px solid var(--border-default)' }}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Log Detail Drawer / Modal */}
      {selectedLog && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem'
        }}>
          <div style={{
            background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
            borderRadius: '1.5rem', width: '100%', maxWidth: '750px', maxHeight: '85vh',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
            boxShadow: '0 24px 80px rgba(0,0,0,0.8)'
          }}>
            {/* Modal Header */}
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-default)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                {getLevelBadge(selectedLog.level)}
                <span style={{ fontWeight: 800, fontSize: '1.1rem', color: 'white' }}>{selectedLog.eventType}</span>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Message</span>
                <p style={{ margin: '0.25rem 0 0', color: 'var(--text-primary)', fontSize: '1rem', fontWeight: 600 }}>{selectedLog.message}</p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                <div style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-default)', borderRadius: '0.75rem', padding: '0.75rem' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Timestamp</div>
                  <div style={{ color: 'white', fontWeight: 600, fontSize: '0.85rem', marginTop: '0.2rem' }}>
                    {new Date(selectedLog.timestamp).toISOString()}
                  </div>
                </div>

                <div style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-default)', borderRadius: '0.75rem', padding: '0.75rem' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Room ID</div>
                  <div style={{ color: selectedLog.roomId ? '#10b981' : 'var(--text-muted)', fontWeight: 700, fontFamily: 'monospace', fontSize: '0.9rem', marginTop: '0.2rem' }}>
                    {selectedLog.roomId || 'N/A'}
                  </div>
                </div>

                <div style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-default)', borderRadius: '0.75rem', padding: '0.75rem' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>User Email</div>
                  <div style={{ color: 'white', fontWeight: 600, fontSize: '0.85rem', marginTop: '0.2rem' }}>
                    {selectedLog.userEmail || 'Guest / Anonymous'}
                  </div>
                </div>

                <div style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-default)', borderRadius: '0.75rem', padding: '0.75rem' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Client IP & ID</div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontFamily: 'monospace', marginTop: '0.2rem' }}>
                    {selectedLog.ip || 'Unknown IP'} · {selectedLog.clientId ? selectedLog.clientId.substring(0, 16) : 'N/A'}
                  </div>
                </div>
              </div>

              {selectedLog.userAgent && (
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>User Agent</span>
                  <div style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-default)', borderRadius: '0.75rem', padding: '0.75rem', fontSize: '0.8rem', color: 'var(--text-secondary)', fontFamily: 'monospace', marginTop: '0.25rem', wordBreak: 'break-all' }}>
                    {selectedLog.userAgent}
                  </div>
                </div>
              )}

              {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Event Metadata (JSON)</span>
                    <button
                      onClick={() => copyToClipboard(selectedLog.metadata, 'meta')}
                      style={{ background: 'transparent', border: 'none', color: '#f59e0b', fontSize: '0.75rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer' }}
                    >
                      {copiedId === 'meta' ? <Check size={14} /> : <Copy size={14} />} {copiedId === 'meta' ? 'Copied' : 'Copy JSON'}
                    </button>
                  </div>
                  <pre style={{
                    background: '#0a0d18', border: '1px solid var(--border-default)',
                    borderRadius: '0.75rem', padding: '1rem', color: '#34d399',
                    fontFamily: 'monospace', fontSize: '0.8rem', overflowX: 'auto', margin: 0
                  }}>
                    {JSON.stringify(selectedLog.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border-default)', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              {selectedLog.roomId && (
                <button
                  onClick={() => {
                    setRoomFilter(selectedLog.roomId);
                    setSelectedLog(null);
                  }}
                  className="btn btn-primary btn-sm"
                  style={{ background: 'linear-gradient(135deg, #10b981, #059669)', border: 'none' }}
                >
                  Filter by Room {selectedLog.roomId}
                </button>
              )}
              <button
                onClick={() => setSelectedLog(null)}
                className="btn btn-ghost btn-sm"
                style={{ border: '1px solid var(--border-default)' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
