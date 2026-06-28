'use client';
import { useEffect, useState } from 'react';
import LoadingSkeleton from '../../components/LoadingSkeleton';
import EmptyState from '../../components/EmptyState';
import { showToast } from '../../components/Toast';

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(2)} MB`;
  return `${(bytes / 1073741824).toFixed(2)} GB`;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userHistory, setUserHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users?page=${page}&search=${encodeURIComponent(search)}&status=${statusFilter}`);
      const data = await res.json();
      if (data.error) {
        showToast(data.error, 'error');
      } else {
        setUsers(data.users || []);
        setTotal(data.total || 0);
        setPages(data.pages || 1);
      }
    } catch (err) {
      showToast('Failed to load users', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [page, statusFilter]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    fetchUsers();
  };

  const toggleUserStatus = async (user) => {
    const action = user.status === 'suspended' ? 'activate' : 'suspend';
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user._id, action }),
      });
      const data = await res.json();
      if (data.error) {
        showToast(data.error, 'error');
      } else {
        showToast(`User status updated to ${data.user.status}`, 'success');
        setUsers(users.map(u => u._id === user._id ? data.user : u));
        if (selectedUser?._id === user._id) {
          setSelectedUser(data.user);
        }
      }
    } catch (err) {
      showToast('Failed to update user status', 'error');
    }
  };

  const deleteUser = async (userId) => {
    if (!confirm('Are you sure you want to permanently delete this user? This action cannot be undone.')) return;
    try {
      const res = await fetch(`/api/admin/users?userId=${userId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.error) {
        showToast(data.error, 'error');
      } else {
        showToast('User deleted successfully', 'success');
        setSelectedUser(null);
        fetchUsers();
      }
    } catch (err) {
      showToast('Failed to delete user', 'error');
    }
  };

  const viewHistory = async (user) => {
    setSelectedUser(user);
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/transfers?limit=50`); // Note: API filters by user's email if not admin, but for admin query, we will fetch user-specific or list all.
      // Wait, let's see how our transfers API filters. Our /api/transfers route:
      // const filter = session.user.role === 'admin' ? {} : { senderEmail: session.user.email };
      // Ah! If the requester is admin, it returns all transfers. Let's filter client-side or we can add senderEmail query param to /api/transfers!
      const histRes = await fetch(`/api/transfers?limit=100`);
      const histData = await histRes.json();
      if (histData.records) {
        const filtered = histData.records.filter(r => r.senderEmail.toLowerCase() === user.email.toLowerCase());
        setUserHistory(filtered);
      }
    } catch (err) {
      showToast('Failed to load transfer history', 'error');
    } finally {
      setHistoryLoading(false);
    }
  };

  return (
    <div className="page-enter">
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.375rem' }}>
          User Management
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>View profile information, suspend, reactivate, or delete user accounts.</p>
      </div>

      {/* Filters & Actions */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '0.5rem', flex: 1, maxWidth: '400px' }}>
          <input
            type="text"
            className="input"
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button type="submit" className="btn btn-secondary">Search</button>
        </form>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Status:</label>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="input"
            style={{ width: '140px', padding: '0.5rem' }}
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>
      </div>

      {/* Main Table */}
      {loading ? (
        <LoadingSkeleton type="table" count={5} />
      ) : users.length === 0 ? (
        <EmptyState
          icon="👥"
          title="No users found"
          description="Try adjusting your search criteria or filters."
          actionText="Reset Filters"
          onAction={() => { setSearch(''); setStatusFilter(''); setPage(1); fetchUsers(); }}
        />
      ) : (
        <div className="glass-card" style={{ overflowX: 'auto', padding: 0 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>User Details</th>
                <th>Role</th>
                <th>Status</th>
                <th>Logins</th>
                <th>Last Login</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user._id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div className="gradient-brand" style={{ width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700 }}>
                        {user.name?.[0]?.toUpperCase() || 'U'}
                      </div>
                      <div>
                        <p style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{user.name}</p>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className={`badge ${user.role === 'admin' ? 'badge-warning' : 'badge-primary'}`}>
                      {user.role}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${user.status === 'suspended' ? 'badge-danger' : 'badge-success'}`}>
                      {user.status || 'active'}
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-secondary)' }}>{user.loginCount || 0}</td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                    {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : 'Never'}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                      <button onClick={() => viewHistory(user)} className="btn btn-secondary btn-sm">Profile & History</button>
                      <button
                        onClick={() => toggleUserStatus(user)}
                        className={`btn btn-sm ${user.status === 'suspended' ? 'btn-success' : 'btn-ghost'}`}
                        style={user.status !== 'suspended' ? { color: 'var(--warning)' } : undefined}
                      >
                        {user.status === 'suspended' ? 'Reactivate' : 'Suspend'}
                      </button>
                      <button onClick={() => deleteUser(user._id)} className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }}>Delete</button>
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
                Page {page} of {pages} ({total} users total)
              </span>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button disabled={page === 1} onClick={() => setPage(page - 1)} className="btn btn-secondary btn-sm">Previous</button>
                <button disabled={page === pages} onClick={() => setPage(page + 1)} className="btn btn-secondary btn-sm">Next</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* User details & history modal */}
      {selectedUser && (
        <div className="modal-overlay">
          <div className="modal-box glass-card" style={{ width: '100%', maxWidth: '700px', padding: '2rem' }}>
            <div style={{ display: 'flex', justify: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-default)', paddingBottom: '1rem' }}>
              <div>
                <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-primary)' }}>User Profile Details</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{selectedUser.name}</p>
              </div>
              <button onClick={() => setSelectedUser(null)} className="btn btn-ghost btn-icon">✕</button>
            </div>

            {/* Profile Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
              <div style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-default)', padding: '0.75rem 1rem', borderRadius: '0.75rem' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Email Address</span>
                <p style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem' }}>{selectedUser.email}</p>
              </div>
              <div style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-default)', padding: '0.75rem 1rem', borderRadius: '0.75rem' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Account Role</span>
                <p style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem' }}>{selectedUser.role}</p>
              </div>
              <div style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-default)', padding: '0.75rem 1rem', borderRadius: '0.75rem' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Account Status</span>
                <p style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem' }}>{selectedUser.status}</p>
              </div>
              <div style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-default)', padding: '0.75rem 1rem', borderRadius: '0.75rem' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Created Date</span>
                <p style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem' }}>{new Date(selectedUser.createdAt).toLocaleDateString()}</p>
              </div>
            </div>

            {/* Transfer History */}
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.75rem' }}>User Transfer History</h3>
            
            {historyLoading ? (
              <LoadingSkeleton type="list" count={3} />
            ) : userHistory.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', textAlign: 'center', padding: '2rem' }}>
                No file transfer records found for this user.
              </p>
            ) : (
              <div style={{ maxHeight: '250px', overflowY: 'auto', border: '1px solid var(--border-default)', borderRadius: '0.75rem' }}>
                <table className="data-table" style={{ fontSize: '0.8rem' }}>
                  <thead>
                    <tr>
                      <th>Link ID</th>
                      <th>Files</th>
                      <th>Total Size</th>
                      <th>Status</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {userHistory.map(record => (
                      <tr key={record._id}>
                        <td><span style={{ fontFamily: 'monospace' }}>{record.linkId}</span></td>
                        <td>{record.fileCount}</td>
                        <td>{formatBytes(record.totalSize)}</td>
                        <td>
                          <span className={`badge ${record.status === 'completed' ? 'badge-success' : 'badge-danger'}`}>
                            {record.status}
                          </span>
                        </td>
                        <td>{new Date(record.createdAt).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
              <button
                onClick={() => { toggleUserStatus(selectedUser); }}
                className="btn btn-secondary"
              >
                {selectedUser.status === 'suspended' ? 'Reactivate' : 'Suspend Account'}
              </button>
              <button
                onClick={() => { deleteUser(selectedUser._id); }}
                className="btn btn-danger"
              >
                Delete Account
              </button>
              <button onClick={() => setSelectedUser(null)} className="btn btn-secondary">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
