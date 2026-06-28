'use client';
import { useEffect, useState } from 'react';
import LoadingSkeleton from '../../components/LoadingSkeleton';
import { showToast } from '../../components/Toast';

export default function AdminHealthPage() {
  const [health, setHealth] = useState(null);
  const [logs, setLogs] = useState([]);
  const [logLevel, setLogLevel] = useState('all');
  const [loading, setLoading] = useState(true);
  const [logsLoading, setLogsLoading] = useState(false);

  const fetchHealth = async () => {
    try {
      const res = await fetch('/api/admin/health');
      const data = await res.json();
      if (!data.error) {
        setHealth(data);
      }
    } catch (e) {
      showToast('Failed to load system health metrics', 'error');
    }
  };

  const fetchLogs = async () => {
    setLogsLoading(true);
    try {
      const res = await fetch(`/api/admin/logs?level=${logLevel}`);
      const data = await res.json();
      if (!data.error) {
        setLogs(data.logs || []);
      }
    } catch (e) {
      showToast('Failed to load activity logs', 'error');
    } finally {
      setLogsLoading(false);
    }
  };

  const clearLogs = async () => {
    if (!confirm('Are you sure you want to clear the in-memory system log buffer?')) return;
    try {
      const res = await fetch('/api/admin/logs', { method: 'DELETE' });
      const data = await res.json();
      if (!data.error) {
        showToast('System logs cleared', 'success');
        setLogs([]);
      }
    } catch (e) {
      showToast('Failed to clear logs', 'error');
    }
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([fetchHealth(), fetchLogs()]);
      setLoading(false);
    };
    init();

    // Auto refresh status every 10s
    const statusInterval = setInterval(fetchHealth, 10000);
    return () => clearInterval(statusInterval);
  }, []);

  useEffect(() => {
    if (!loading) {
      fetchLogs();
    }
  }, [logLevel]);

  if (loading && !health) {
    return (
      <div>
        <div style={{ marginBottom: '2rem' }}>
          <div className="skeleton" style={{ height: '2rem', width: '200px', marginBottom: '0.5rem' }} />
          <div className="skeleton" style={{ height: '1rem', width: '300px' }} />
        </div>
        <LoadingSkeleton type="card" count={3} />
        <div style={{ marginTop: '2.5rem' }}>
          <div className="skeleton" style={{ height: '300px', borderRadius: '1rem' }} />
        </div>
      </div>
    );
  }

  const { server = {}, database = {}, transfers = {} } = health || {};

  return (
    <div className="page-enter">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.375rem' }}>
            System Health & Monitoring
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Real-time server metrics, database response metrics, active WebRTC room allocations, and system events logs.</p>
        </div>
        <button onClick={fetchHealth} className="btn btn-secondary btn-sm">
          ↻ Refresh Metrics
        </button>
      </div>

      {/* Grid of server indicators */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        {/* Server Node Status */}
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>Application Server</h3>
            <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
              <span className="status-dot online" style={{ width: 6, height: 6 }} />
              {server.status?.toUpperCase() || 'ONLINE'}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Uptime:</span>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{server.uptimeFormatted || '—'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Node Environment:</span>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{process.env.NODE_ENV || 'development'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Node Version:</span>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{server.nodeVersion || '—'}</span>
            </div>
          </div>
        </div>

        {/* Memory Load */}
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>Memory Load (RAM)</h3>
            <span className="badge badge-primary">{server.memory?.usagePercent || 0}% Used</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <div className="progress-track" style={{ height: '6px' }}>
              <div className="progress-fill" style={{ width: `${server.memory?.usagePercent || 0}%` }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              <span>Heap Used: {server.memory?.used || 0} MB</span>
              <span>Total Heap: {server.memory?.total || 0} MB</span>
            </div>
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            RSS Memory Allocation: <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{server.memory?.rss || 0} MB</span>
          </p>
        </div>

        {/* Database MongoDB Status */}
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>MongoDB Instance</h3>
            <span className={`badge ${database.status === 'online' ? 'badge-success' : 'badge-danger'}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
              {database.status === 'online' && <span className="status-dot online" style={{ width: 6, height: 6 }} />}
              {database.status?.toUpperCase() || 'OFFLINE'}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Connection State:</span>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)', textTransform: 'capitalize' }}>{database.connectionState || '—'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Query Response:</span>
              <span style={{ fontWeight: 600, color: '#10b981' }}>{database.responseTime ? `${database.responseTime} ms` : '—'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Driver Version:</span>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{database.mongoVersion || '—'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Transfer Services State */}
      <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
        <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1.25rem' }}>
          Transfer Signaling & Signaling Queue Status
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          <div style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-default)', padding: '1rem', borderRadius: '0.75rem' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Active Peer Connection Rooms</span>
            <p style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-accent)', marginTop: '0.25rem' }}>
              {transfers.activeSessions || 0}
            </p>
          </div>
          <div style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-default)', padding: '1rem', borderRadius: '0.75rem' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Waiting for Receiver</span>
            <p style={{ fontSize: '1.75rem', fontWeight: 800, color: '#f59e0b', marginTop: '0.25rem' }}>
              {transfers.sessionsByStatus?.waiting || 0}
            </p>
          </div>
          <div style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-default)', padding: '1rem', borderRadius: '0.75rem' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Active Connections</span>
            <p style={{ fontSize: '1.75rem', fontWeight: 800, color: '#3b82f6', marginTop: '0.25rem' }}>
              {transfers.activeConnections || 0}
            </p>
          </div>
          <div style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-default)', padding: '1rem', borderRadius: '0.75rem' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Active Live WebRTC Streams</span>
            <p style={{ fontSize: '1.75rem', fontWeight: 800, color: '#10b981', marginTop: '0.25rem' }}>
              {transfers.sessionsByStatus?.transferring || 0}
            </p>
          </div>
        </div>
      </div>

      {/* System Activity rolling log */}
      <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', height: '400px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>System Events Logger</h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Live in-memory activity logs since server startup</p>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <select
              value={logLevel}
              onChange={(e) => setLogLevel(e.target.value)}
              className="input"
              style={{ width: '120px', padding: '0.375rem 0.75rem', fontSize: '0.8rem' }}
            >
              <option value="all">All Levels</option>
              <option value="info">Info</option>
              <option value="warning">Warning</option>
              <option value="error">Error</option>
            </select>
            <button onClick={fetchLogs} className="btn btn-secondary btn-sm" disabled={logsLoading}>
              {logsLoading ? 'Loading...' : '⟳ Refresh'}
            </button>
            <button onClick={clearLogs} className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }}>
              Clear Log Buffer
            </button>
          </div>
        </div>

        {/* Terminal Window */}
        <div style={{
          flex: 1,
          background: '#040411',
          border: '1px solid var(--border-default)',
          borderRadius: '0.75rem',
          padding: '1rem',
          fontFamily: 'monospace',
          fontSize: '0.8rem',
          overflowY: 'auto',
          color: '#a5b4fc',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.35rem'
        }}>
          {logs.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', margin: 'auto' }}>
              No logged events in the current buffer.
            </p>
          ) : (
            logs.map((log, idx) => {
              let color = '#a5b4fc';
              let badge = 'INFO';
              if (log.level === 'error') { color = '#f87171'; badge = 'ERR'; }
              else if (log.level === 'warning') { color = '#fbbf24'; badge = 'WRN'; }
              
              return (
                <div key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)', paddingBottom: '0.25rem' }}>
                  <span style={{ color: 'var(--text-muted)', marginRight: '0.5rem' }}>[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                  <span style={{ color, fontWeight: 700, marginRight: '0.5rem' }}>[{badge}]</span>
                  <span style={{ color: 'var(--text-primary)' }}>{log.message}</span>
                  {log.data && Object.keys(log.data).length > 0 && (
                    <span style={{ color: 'var(--text-secondary)', marginLeft: '0.5rem', fontSize: '0.75rem' }}>
                      {JSON.stringify(log.data)}
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
