'use client';
import { useEffect, useState } from 'react';
import LoadingSkeleton from '../../components/LoadingSkeleton';
import EmptyState from '../../components/EmptyState';
import { showToast } from '../../components/Toast';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend, PieChart, Pie, Cell
} from 'recharts';
import { BarChart3, ClipboardList, Package, HardDrive, TrendingUp, XCircle, X, File } from 'lucide-react';

const COLORS = ['#10b981', '#ef4444', '#f59e0b', '#6366f1'];

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(2)} MB`;
  return `${(bytes / 1073741824).toFixed(2)} GB`;
}

function formatDuration(seconds) {
  if (!seconds) return '—';
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s`;
}

export default function AdminTransfersPage() {
  const [activeTab, setActiveTab] = useState('analytics'); // analytics | records
  const [records, setRecords] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);

  const fetchAnalytics = async () => {
    try {
      const res = await fetch('/api/transfers/analytics');
      const data = await res.json();
      if (!data.error) {
        setAnalytics(data);
      }
    } catch (e) {
      showToast('Failed to load analytics charts', 'error');
    }
  };

  const fetchRecords = async () => {
    setRecordsLoading(true);
    try {
      const res = await fetch(`/api/admin/transfers?page=${page}&limit=15&status=${statusFilter}&search=${encodeURIComponent(searchQuery)}&startDate=${startDate}&endDate=${endDate}`);
      const data = await res.json();
      if (!data.error) {
        setRecords(data.records || []);
        setTotal(data.total || 0);
        setPages(data.pages || 1);
      }
    } catch (e) {
      showToast('Failed to load transfer records', 'error');
    } finally {
      setRecordsLoading(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([fetchAnalytics(), fetchRecords()]);
      setLoading(false);
    };
    init();
  }, []);

  useEffect(() => {
    if (!loading) {
      fetchRecords();
    }
  }, [page, statusFilter, startDate, endDate]);

  const handleExportCSV = async () => {
    try {
      const res = await fetch(`/api/admin/transfers?limit=1000&status=${statusFilter}&search=${encodeURIComponent(searchQuery)}&startDate=${startDate}&endDate=${endDate}`);
      const data = await res.json();
      if (data.error) {
        showToast(data.error, 'error');
        return;
      }
      
      const headers = ['Room ID', 'Sender Email', 'Receiver Email', 'File Count', 'Total Size (Bytes)', 'Duration (s)', 'Status', 'Date'];
      const csvRows = [headers.join(',')];
      
      data.records.forEach(r => {
        const values = [
          `"${r.roomId}"`,
          `"${r.senderEmail}"`,
          `"${r.receiverEmail || 'anonymous'}"`,
          r.fileCount,
          r.totalSize,
          r.duration || 0,
          `"${r.status}"`,
          `"${new Date(r.createdAt).toLocaleString()}"`
        ];
        csvRows.push(values.join(','));
      });
      
      const csvContent = "data:text/csv;charset=utf-8," + csvRows.join("\n");
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `transfers_export_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast('Transfers exported successfully', 'success');
    } catch (e) {
      showToast('Failed to export CSV', 'error');
    }
  };

  if (loading) {
    return (
      <div>
        <div style={{ marginBottom: '2rem' }}>
          <div className="skeleton" style={{ height: '2rem', width: '200px', marginBottom: '0.5rem' }} />
          <div className="skeleton" style={{ height: '1rem', width: '300px' }} />
        </div>
        <LoadingSkeleton type="card" count={3} />
        <div style={{ marginTop: '2rem' }}>
          <LoadingSkeleton type="table" count={5} />
        </div>
      </div>
    );
  }

  // Pre-process chart data
  const weeklyData = analytics?.charts?.weekly?.map(item => ({
    name: item._id,
    'Transfers Count': item.count,
    'Data Shared (MB)': Math.round((item.bytes || 0) / 1024 / 1024 * 100) / 100
  })) || [];

  const dailyData = analytics?.charts?.daily?.map(item => ({
    hour: `${item._id}:00`,
    'Transfers': item.count,
    'Data Shared (MB)': Math.round((item.bytes || 0) / 1024 / 1024 * 100) / 100
  })) || [];

  const pieData = analytics?.charts?.statusBreakdown?.map(item => ({
    name: item._id,
    value: item.count
  })) || [];

  const summary = analytics?.summary || {
    totalTransfers: 0,
    successTransfers: 0,
    failedTransfers: 0,
    totalBytes: 0,
    successRate: 0
  };

  return (
    <div className="page-enter">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.375rem' }}>
            Transfer Audit & Analytics
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Monitor active sessions, inspect file shares, and analyze data traffic metrics.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`btn ${activeTab === 'analytics' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <BarChart3 size={18} /> Analytics Dashboard
          </button>
          <button
            onClick={() => setActiveTab('records')}
            className={`btn ${activeTab === 'records' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <ClipboardList size={18} /> Transfer Audit Logs
          </button>
        </div>
      </div>

      {/* Analytics Tab */}
      {activeTab === 'analytics' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {/* Overview Stat Widgets */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            {[
              { icon: <Package size={24} className="text-white" />, label: 'Total Transfers', value: summary.totalTransfers },
              { icon: <HardDrive size={24} className="text-white" />, label: 'Total Data Shared', value: formatBytes(summary.totalBytes) },
              { icon: <TrendingUp size={24} className="text-white" />, label: 'Transfer Success Rate', value: `${summary.successRate}%` },
              { icon: <XCircle size={24} className="text-white" />, label: 'Failed Transfers', value: summary.failedTransfers }
            ].map((s, idx) => (
              <div key={idx} className="stat-card" style={{ padding: '1.25rem' }}>
                <span style={{ fontSize: '1.5rem', display: 'block', marginBottom: '0.5rem' }}>{s.icon}</span>
                <p style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>{s.value}</p>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{s.label}</p>
              </div>
            ))}
          </div>

          {/* Charts Row 1 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
            {/* Weekly Activity Chart */}
            <div className="glass-card" style={{ padding: '1.5rem' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1.5rem' }}>
                Weekly File Transfers Count & Volume
              </h3>
              <div style={{ width: '100%', height: 260 }}>
                {weeklyData.length === 0 ? (
                  <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                    No weekly data recorded yet
                  </div>
                ) : (
                  <ResponsiveContainer>
                    <BarChart data={weeklyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" />
                      <XAxis dataKey="name" stroke="var(--text-secondary)" fontSize={11} />
                      <YAxis stroke="var(--text-secondary)" fontSize={11} />
                      <Tooltip contentStyle={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '8px' }} />
                      <Legend verticalAlign="top" height={36} />
                      <Bar dataKey="Transfers Count" fill="#6366f1" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Data Shared (MB)" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Session Status Pie Chart */}
            <div className="glass-card" style={{ padding: '1.5rem', maxWidth: '400px', margin: '0 auto', width: '100%' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1.5rem', textAlign: 'center' }}>
                Transfer Status Breakdown
              </h3>
              <div style={{ width: '100%', height: 200, position: 'relative' }}>
                {pieData.length === 0 ? (
                  <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                    No transfer status data
                  </div>
                ) : (
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '8px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', justifyContent: 'center', marginTop: '1rem' }}>
                {pieData.map((entry, index) => (
                  <div key={entry.name} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8rem' }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: COLORS[index % COLORS.length] }}></span>
                    <span style={{ textTransform: 'capitalize', color: 'var(--text-secondary)' }}>{entry.name}: {entry.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Hourly Traffic Chart */}
          <div className="glass-card" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1.5rem' }}>
              Daily Hourly Sharing Activity (MB)
            </h3>
            <div style={{ width: '100%', height: 250 }}>
              {dailyData.length === 0 ? (
                <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                  No traffic recorded today
                </div>
              ) : (
                <ResponsiveContainer>
                  <AreaChart data={dailyData}>
                    <defs>
                      <linearGradient id="colorBytes" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" />
                    <XAxis dataKey="hour" stroke="var(--text-secondary)" fontSize={11} />
                    <YAxis stroke="var(--text-secondary)" fontSize={11} />
                    <Tooltip contentStyle={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '8px' }} />
                    <Area type="monotone" dataKey="Data Shared (MB)" stroke="#10b981" fillOpacity={1} fill="url(#colorBytes)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Records Tab */}
      {activeTab === 'records' && (
        <div className="page-enter">
          {/* Detailed Filter Bar */}
          <div className="glass-card" style={{ padding: '1.25rem', marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: '0.5rem', flex: 1, minWidth: '280px' }}>
                <input
                  type="text"
                  className="input"
                  placeholder="Search by Room ID, Sender, Receiver..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ flex: 1 }}
                />
                <button onClick={fetchRecords} className="btn btn-secondary">Search</button>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <button
                  onClick={handleExportCSV}
                  className="btn btn-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                >
                  Export to CSV
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Status:</label>
                <select
                  value={statusFilter}
                  onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                  className="input"
                  style={{ width: '140px', padding: '0.5rem' }}
                >
                  <option value="">All Statuses</option>
                  <option value="completed">Completed</option>
                  <option value="failed">Failed</option>
                  <option value="in_progress">In Progress</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>From:</label>
                <input
                  type="date"
                  className="input"
                  value={startDate}
                  onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
                  style={{ padding: '0.4rem', width: '150px' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>To:</label>
                <input
                  type="date"
                  className="input"
                  value={endDate}
                  onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
                  style={{ padding: '0.4rem', width: '150px' }}
                />
              </div>

              <button
                onClick={() => { setSearchQuery(''); setStatusFilter(''); setStartDate(''); setEndDate(''); setPage(1); }}
                className="btn btn-ghost btn-sm"
                style={{ marginLeft: 'auto' }}
              >
                Reset Filters
              </button>
            </div>
          </div>

          <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              Showing {records.length} records of {total} total
            </p>
          </div>

          {recordsLoading ? (
            <LoadingSkeleton type="table" count={6} />
          ) : records.length === 0 ? (
            <EmptyState
              icon={<ClipboardList size={48} className="text-gray-400" />}
              title="No transfers registered"
              description="No transfer records match the current filters."
            />
          ) : (
            <div className="glass-card" style={{ overflowX: 'auto', padding: 0 }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Room ID</th>
                    <th>Sender Email</th>
                    <th>Receiver Email</th>
                    <th>File Count</th>
                    <th>Total Size</th>
                    <th>Date</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r) => (
                    <tr key={r._id}>
                      <td style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {r.roomId}
                      </td>
                      <td style={{ color: 'var(--text-primary)' }}>
                        {r.senderEmail}
                      </td>
                      <td style={{ color: 'var(--text-secondary)' }}>
                        {r.receiverEmail || 'anonymous'}
                      </td>
                      <td style={{ color: 'var(--text-primary)' }}>
                        {r.fileCount}
                      </td>
                      <td style={{ color: 'var(--text-secondary)' }}>
                        {formatBytes(r.totalSize)}
                      </td>
                      <td style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                        {new Date(r.createdAt).toLocaleString()}
                      </td>
                      <td>
                        <span className={`badge ${r.status === 'completed' ? 'badge-success' : r.status === 'failed' ? 'badge-danger' : r.status === 'in_progress' ? 'badge-warning' : 'badge-muted'}`}>
                          {r.status?.replace('_', ' ')}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                          <button onClick={() => setSelectedRecord(r)} className="btn btn-secondary btn-sm">Inspect</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination */}
              {pages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', borderTop: '1px solid var(--border-default)' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    Page {page} of {pages}
                  </span>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button disabled={page === 1} onClick={() => setPage(page - 1)} className="btn btn-secondary btn-sm">Previous</button>
                    <button disabled={page === pages} onClick={() => setPage(page + 1)} className="btn btn-secondary btn-sm">Next</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Record Inspect Modal */}
      {selectedRecord && (
        <div className="modal-overlay">
          <div className="modal-box glass-card" style={{ width: '100%', maxWidth: '600px', padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-default)', paddingBottom: '1rem' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>Transfer Session Inspection</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Link ID: <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{selectedRecord.linkId}</span></p>
              </div>
              <button onClick={() => setSelectedRecord(null)} className="btn btn-ghost btn-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={20} /></button>
            </div>

            {/* Metadata Fields */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
              {[
                { label: 'Sender Name', value: selectedRecord.senderName },
                { label: 'Sender Email', value: selectedRecord.senderEmail },
                { label: 'Receiver Identifier', value: selectedRecord.receiverIdentifier || 'anonymous' },
                { label: 'File Count', value: `${selectedRecord.fileCount} files` },
                { label: 'Total File Size', value: formatBytes(selectedRecord.totalSize) },
                { label: 'Transfer Status', value: selectedRecord.status?.toUpperCase() },
                { label: 'Transfer Duration', value: formatDuration(selectedRecord.duration) },
                { label: 'Start Time', value: new Date(selectedRecord.startTime).toLocaleString() },
                { label: 'End Time', value: selectedRecord.endTime ? new Date(selectedRecord.endTime).toLocaleString() : 'N/A' }
              ].map((f, idx) => (
                <div key={idx} style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-default)', padding: '0.75rem 1rem', borderRadius: '0.75rem' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '0.25rem' }}>{f.label}</span>
                  <p style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.85rem', wordBreak: 'break-all' }}>{f.value}</p>
                </div>
              ))}
            </div>

            {/* Shared File Names */}
            {selectedRecord.fileNames && selectedRecord.fileNames.length > 0 && (
              <div>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Shared Files List</h3>
                <div style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-default)', borderRadius: '0.75rem', padding: '0.75rem', maxHeight: '150px', overflowY: 'auto' }}>
                  {selectedRecord.fileNames.map((name, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)', padding: '0.25rem 0' }}>
                      <File size={16} />
                      <span style={{ wordBreak: 'break-all' }}>{name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
              <button onClick={() => setSelectedRecord(null)} className="btn btn-secondary">Close Audit Inspection</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
