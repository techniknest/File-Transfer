'use client';
import { useEffect, useState } from 'react';
import LoadingSkeleton from '../../components/LoadingSkeleton';
import EmptyState from '../../components/EmptyState';
import { showToast } from '../../components/Toast';
import { Users, X, Shield, ShieldOff, Ban, CheckCircle, Trash2, Eye } from 'lucide-react';

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(2)} MB`;
  return `${(bytes / 1073741824).toFixed(2)} GB`;
}

function formatDate(date) {
  if (!date) return 'Never';
  return new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState({});
  const [selectedUser, setSelectedUser] = useState(null);
  const [userHistory, setUserHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/users?page=${page}&search=${encodeURIComponent(search)}&status=${statusFilter}&role=${roleFilter}`
      );
      const data = await res.json();
      if (data.error) {
        showToast(data.error, 'error');
      } else {
        setUsers(data.users || []);
        setTotal(data.total || 0);
        setPages(data.pages || 1);
      }
    } catch {
      showToast('Failed to load users', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, [page, statusFilter, roleFilter]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    fetchUsers();
  };

  const performAction = async (userId, action) => {
    setActionLoading(prev => ({ ...prev, [`${userId}-${action}`]: true }));
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (data.error) {
        showToast(data.error, 'error');
      } else {
        showToast(data.message || 'User updated', 'success');
        setUsers(prev => prev.map(u => u._id === userId ? data.user : u));
        if (selectedUser?._id === userId) setSelectedUser(data.user);
      }
    } catch {
      showToast('Action failed', 'error');
    } finally {
      setActionLoading(prev => ({ ...prev, [`${userId}-${action}`]: false }));
    }
  };

  const deleteUser = async (userId) => {
    if (!confirm('Permanently delete this user? This cannot be undone.')) return;
    setActionLoading(prev => ({ ...prev, [`${userId}-delete`]: true }));
    try {
      const res = await fetch(`/api/admin/users/${userId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.error) {
        showToast(data.error, 'error');
      } else {
        showToast('User deleted successfully', 'success');
        setSelectedUser(null);
        fetchUsers();
      }
    } catch {
      showToast('Failed to delete user', 'error');
    } finally {
      setActionLoading(prev => ({ ...prev, [`${userId}-delete`]: false }));
    }
  };

  const viewHistory = async (user) => {
    setSelectedUser(user);
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/transfers?limit=100`);
      const data = await res.json();
      if (data.records) {
        const filtered = data.records.filter(
          r => r.senderEmail?.toLowerCase() === user.email.toLowerCase()
        );
        setUserHistory(filtered);
      }
    } catch {
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
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          Manage user accounts — block/unblock, change roles, or delete accounts. {total > 0 && <strong style={{ color: 'var(--text-primary)' }}>{total} users total</strong>}
        </p>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '0.5rem', flex: 1, maxWidth: '420px' }}>
          <input
            type="text"
            className="input"
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button type="submit" className="btn btn-secondary">Search</button>
        </form>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <select
            value={roleFilter}
            onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
            className="input"
            style={{ width: '130px', padding: '0.5rem' }}
          >
            <option value="">All Roles</option>
            <option value="admin">Admin</option>
            <option value="user">User</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="input"
            style={{ width: '150px', padding: '0.5rem' }}
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="suspended">Blocked</option>
          </select>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <LoadingSkeleton type="table" count={5} />
      ) : users.length === 0 ? (
        <EmptyState
          icon={<Users size={48} />}
          title="No users found"
          description="Try adjusting your search criteria or filters."
          actionText="Reset Filters"
          onAction={() => { setSearch(''); setStatusFilter(''); setRoleFilter(''); setPage(1); fetchUsers(); }}
        />
      ) : (
        <div className="glass-card" style={{ overflowX: 'auto', padding: 0 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Status</th>
                <th>Joined</th>
                <th>Last Login</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const isBlocked = user.status === 'suspended';
                const isAdmin = user.role === 'admin';
                return (
                  <tr key={user._id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div className="gradient-brand" style={{ width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, flexShrink: 0 }}>
                          {user.name?.[0]?.toUpperCase() || 'U'}
                        </div>
                        <div>
                          <p style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{user.name}</p>
                          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${isAdmin ? 'badge-warning' : 'badge-primary'}`}>
                        {user.role}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${isBlocked ? 'badge-danger' : 'badge-success'}`}>
                        {isBlocked ? 'Blocked' : 'Active'}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                      {formatDate(user.createdAt)}
                    </td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                      {user.lastLoginAt ? formatDate(user.lastLoginAt) : 'Never'}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                        {/* View Profile */}
                        <button
                          onClick={() => viewHistory(user)}
                          className="btn btn-secondary btn-sm"
                          title="View Profile"
                          style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                        >
                          <Eye size={13} /> Profile
                        </button>

                        {/* Block / Unblock */}
                        <button
                          onClick={() => performAction(user._id, isBlocked ? 'unblock' : 'block')}
                          disabled={!!actionLoading[`${user._id}-${isBlocked ? 'unblock' : 'block'}`]}
                          className={`btn btn-sm ${isBlocked ? 'btn-success' : 'btn-ghost'}`}
                          style={!isBlocked ? { color: 'var(--warning)', borderColor: 'rgba(245,158,11,0.3)' } : undefined}
                          title={isBlocked ? 'Unblock user' : 'Block user'}
                        >
                          {isBlocked ? <><CheckCircle size={13} /> Unblock</> : <><Ban size={13} /> Block</>}
                        </button>

                        {/* Make Admin / Remove Admin */}
                        <button
                          onClick={() => performAction(user._id, isAdmin ? 'remove-admin' : 'make-admin')}
                          disabled={!!actionLoading[`${user._id}-${isAdmin ? 'remove-admin' : 'make-admin'}`]}
                          className="btn btn-ghost btn-sm"
                          style={{ color: isAdmin ? 'var(--danger)' : '#fbbf24', borderColor: isAdmin ? 'rgba(239,68,68,0.3)' : 'rgba(251,191,36,0.3)' }}
                          title={isAdmin ? 'Remove admin role' : 'Promote to admin'}
                        >
                          {isAdmin ? <><ShieldOff size={13} /> Demote</> : <><Shield size={13} /> Make Admin</>}
                        </button>

                        {/* Delete */}
                        <button
                          onClick={() => deleteUser(user._id)}
                          disabled={!!actionLoading[`${user._id}-delete`]}
                          className="btn btn-ghost btn-sm"
                          style={{ color: 'var(--danger)' }}
                          title="Delete user"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Pagination */}
          {pages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.25rem', borderTop: '1px solid var(--border-default)' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Page {page} of {pages} ({total} total)
              </span>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button disabled={page === 1} onClick={() => setPage(page - 1)} className="btn btn-secondary btn-sm">Previous</button>
                <button disabled={page === pages} onClick={() => setPage(page + 1)} className="btn btn-secondary btn-sm">Next</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* User Profile Modal */}
      {selectedUser && (
        <div className="modal-overlay">
          <div className="modal-box glass-card" style={{ width: '100%', maxWidth: '700px', padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-default)', paddingBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div className="gradient-brand" style={{ width: '48px', height: '48px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 800, fontSize: '1.25rem', flexShrink: 0 }}>
                  {selectedUser.name?.[0]?.toUpperCase()}
                </div>
                <div>
                  <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>{selectedUser.name}</h2>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{selectedUser.email}</p>
                </div>
              </div>
              <button onClick={() => setSelectedUser(null)} className="btn btn-ghost btn-icon">
                <X size={20} />
              </button>
            </div>

            {/* Profile Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
              {[
                { label: 'Role', value: selectedUser.role },
                { label: 'Status', value: selectedUser.status === 'suspended' ? 'Blocked' : 'Active' },
                { label: 'Logins', value: selectedUser.loginCount || 0 },
                { label: 'Joined', value: formatDate(selectedUser.createdAt) },
                { label: 'Last Login', value: formatDate(selectedUser.lastLoginAt) },
                { label: 'Blocked At', value: selectedUser.blockedAt ? formatDate(selectedUser.blockedAt) : '—' },
              ].map(({ label, value }) => (
                <div key={label} style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-default)', padding: '0.75rem 1rem', borderRadius: '0.75rem' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
                  <p style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem', marginTop: '0.2rem' }}>{value}</p>
                </div>
              ))}
            </div>

            {/* Transfer History */}
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.75rem' }}>Transfer History</h3>
            {historyLoading ? (
              <LoadingSkeleton type="list" count={3} />
            ) : userHistory.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', textAlign: 'center', padding: '1.5rem', background: 'var(--bg-glass)', borderRadius: '0.75rem' }}>
                No transfer records found for this user.
              </p>
            ) : (
              <div style={{ maxHeight: '220px', overflowY: 'auto', border: '1px solid var(--border-default)', borderRadius: '0.75rem' }}>
                <table className="data-table" style={{ fontSize: '0.8rem' }}>
                  <thead>
                    <tr>
                      <th>Room ID</th>
                      <th>Total Size</th>
                      <th>Status</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {userHistory.map(record => (
                      <tr key={record._id}>
                        <td><span style={{ fontFamily: 'monospace' }}>{record.roomId}</span></td>
                        <td>{formatBytes(record.totalSize)}</td>
                        <td>
                          <span className={`badge ${record.status === 'completed' ? 'badge-success' : 'badge-danger'}`}>
                            {record.status}
                          </span>
                        </td>
                        <td>{formatDate(record.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1.5rem', flexWrap: 'wrap' }}>
              <button
                onClick={() => performAction(selectedUser._id, selectedUser.status === 'suspended' ? 'unblock' : 'block')}
                className={`btn ${selectedUser.status === 'suspended' ? 'btn-success' : 'btn-secondary'}`}
                style={selectedUser.status !== 'suspended' ? { color: 'var(--warning)' } : undefined}
              >
                {selectedUser.status === 'suspended' ? 'Unblock Account' : 'Block Account'}
              </button>
              <button
                onClick={() => performAction(selectedUser._id, selectedUser.role === 'admin' ? 'remove-admin' : 'make-admin')}
                className="btn btn-secondary"
                style={{ color: selectedUser.role === 'admin' ? 'var(--danger)' : '#fbbf24' }}
              >
                {selectedUser.role === 'admin' ? 'Remove Admin Role' : 'Make Admin'}
              </button>
              <button onClick={() => deleteUser(selectedUser._id)} className="btn btn-danger">
                <Trash2 size={16} /> Delete
              </button>
              <button onClick={() => setSelectedUser(null)} className="btn btn-secondary">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
