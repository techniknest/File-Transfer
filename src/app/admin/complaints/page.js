'use client';
import { useEffect, useState } from 'react';
import { MessageSquare, CheckCircle, AlertCircle, Clock, Trash2 } from 'lucide-react';
import { showToast } from '../../components/Toast';

export default function ComplaintsPage() {
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  const fetchComplaints = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/complaints${filter ? `?status=${filter}` : ''}`);
      const data = await res.json();
      if (!data.error) {
        setComplaints(data.complaints || []);
      }
    } catch (err) {
      showToast('Failed to load complaints', 'error');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchComplaints();
  }, [filter]);

  const updateStatus = async (id, newStatus) => {
    try {
      const res = await fetch(`/api/admin/complaints/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error, 'error');
      } else {
        showToast(`Complaint marked as ${newStatus}`, 'success');
        setComplaints(complaints.map(c => c._id === id ? { ...c, status: newStatus } : c));
      }
    } catch (err) {
      showToast('Error updating status', 'error');
    }
  };

  return (
    <div className="page-enter">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.375rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <MessageSquare size={28} className="text-primary" /> User Complaints
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Manage and resolve contact submissions</p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', background: 'var(--bg-glass)', padding: '0.25rem', borderRadius: '0.75rem', border: '1px solid var(--border-subtle)' }}>
          <button onClick={() => setFilter('')} className={`btn btn-sm ${filter === '' ? 'btn-primary' : 'btn-ghost'}`}>All</button>
          <button onClick={() => setFilter('pending')} className={`btn btn-sm ${filter === 'pending' ? 'btn-primary' : 'btn-ghost'}`}>Pending</button>
          <button onClick={() => setFilter('resolved')} className={`btn btn-sm ${filter === 'resolved' ? 'btn-primary' : 'btn-ghost'}`}>Resolved</button>
        </div>
      </div>

      <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '800px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-default)', background: 'rgba(255,255,255,0.02)' }}>
                <th style={{ padding: '1.25rem 1.5rem', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>Status</th>
                <th style={{ padding: '1.25rem 1.5rem', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>User Info</th>
                <th style={{ padding: '1.25rem 1.5rem', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>Subject & Message</th>
                <th style={{ padding: '1.25rem 1.5rem', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>Date</th>
                <th style={{ padding: '1.25rem 1.5rem', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td colSpan={5} style={{ padding: '1.25rem 1.5rem' }}>
                      <div className="skeleton" style={{ height: '30px', width: '100%', borderRadius: '4px' }} />
                    </td>
                  </tr>
                ))
              ) : complaints.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '4rem 2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    <MessageSquare size={32} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
                    <p>No complaints found</p>
                  </td>
                </tr>
              ) : (
                complaints.map(c => (
                  <tr key={c._id} style={{ borderBottom: '1px solid var(--border-subtle)', background: c.status === 'pending' ? 'rgba(239,68,68,0.03)' : 'transparent' }}>
                    <td style={{ padding: '1.25rem 1.5rem', verticalAlign: 'top' }}>
                      <span className={`badge ${c.status === 'resolved' ? 'badge-success' : 'badge-danger'}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                        {c.status === 'resolved' ? <CheckCircle size={12} /> : <AlertCircle size={12} />}
                        {c.status}
                      </span>
                    </td>
                    <td style={{ padding: '1.25rem 1.5rem', verticalAlign: 'top' }}>
                      <p style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem' }}>{c.name}</p>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{c.email}</p>
                    </td>
                    <td style={{ padding: '1.25rem 1.5rem', verticalAlign: 'top', maxWidth: '400px' }}>
                      <p style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.9rem', marginBottom: '0.25rem' }}>{c.subject}</p>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.5 }}>{c.message}</p>
                    </td>
                    <td style={{ padding: '1.25rem 1.5rem', verticalAlign: 'top' }}>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <Clock size={14} />
                        {new Date(c.createdAt).toLocaleDateString()}
                      </p>
                    </td>
                    <td style={{ padding: '1.25rem 1.5rem', verticalAlign: 'top', textAlign: 'right' }}>
                      {c.status === 'pending' ? (
                        <button onClick={() => updateStatus(c._id, 'resolved')} className="btn btn-secondary btn-sm">
                          Mark Resolved
                        </button>
                      ) : (
                        <button onClick={() => updateStatus(c._id, 'pending')} className="btn btn-ghost btn-sm">
                          Mark Pending
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
