'use client';
import { useEffect, useState } from 'react';
import { Star, Check, X, Trash2, RotateCcw, MessageSquare } from 'lucide-react';
import { showToast } from '../../components/Toast';
import EmptyState from '../../components/EmptyState';
import LoadingSkeleton from '../../components/LoadingSkeleton';

function StarDisplay({ rating, size = 14 }) {
  return (
    <div style={{ display: 'flex', gap: '2px' }}>
      {[1, 2, 3, 4, 5].map(s => (
        <Star
          key={s}
          size={size}
          fill={s <= rating ? '#f59e0b' : 'none'}
          color={s <= rating ? '#f59e0b' : 'rgba(255,255,255,0.2)'}
          strokeWidth={1.5}
        />
      ))}
    </div>
  );
}

const STATUS_COLORS = {
  pending: 'badge-warning',
  approved: 'badge-success',
  rejected: 'badge-danger',
};

export default function AdminReviewsPage() {
  const [reviews, setReviews] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState({});

  const fetchReviews = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/reviews?status=${statusFilter}&page=${page}&limit=20`);
      const data = await res.json();
      if (data.error) {
        showToast(data.error, 'error');
      } else {
        setReviews(data.reviews || []);
        setTotal(data.total || 0);
        setPages(data.pages || 1);
      }
    } catch {
      showToast('Failed to load reviews', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchReviews(); }, [statusFilter, page]);

  const updateStatus = async (id, status) => {
    setActionLoading(prev => ({ ...prev, [`${id}-${status}`]: true }));
    try {
      const res = await fetch(`/api/admin/reviews/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (data.error) {
        showToast(data.error, 'error');
      } else {
        showToast(`Review ${status}`, 'success');
        setReviews(prev => prev.map(r => r._id === id ? { ...r, status } : r));
      }
    } catch {
      showToast('Action failed', 'error');
    } finally {
      setActionLoading(prev => ({ ...prev, [`${id}-${status}`]: false }));
    }
  };

  const deleteReview = async (id) => {
    if (!confirm('Permanently delete this review?')) return;
    setActionLoading(prev => ({ ...prev, [`${id}-delete`]: true }));
    try {
      const res = await fetch(`/api/admin/reviews/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.error) {
        showToast(data.error, 'error');
      } else {
        showToast('Review deleted', 'success');
        setReviews(prev => prev.filter(r => r._id !== id));
        setTotal(t => t - 1);
      }
    } catch {
      showToast('Failed to delete review', 'error');
    } finally {
      setActionLoading(prev => ({ ...prev, [`${id}-delete`]: false }));
    }
  };

  const pendingCount = reviews.filter(r => r.status === 'pending').length;

  return (
    <div className="page-enter">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.375rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Star size={26} style={{ color: '#f59e0b' }} /> Review Moderation
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Approve or reject user reviews before they appear publicly.
            {pendingCount > 0 && (
              <span className="badge badge-warning" style={{ marginLeft: '0.75rem' }}>
                {pendingCount} pending
              </span>
            )}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <select
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
            className="input"
            style={{ width: '160px', padding: '0.5rem' }}
          >
            <option value="">All Reviews</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
          <button onClick={fetchReviews} className="btn btn-secondary btn-sm" disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <RotateCcw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          </button>
        </div>
      </div>

      {loading ? (
        <LoadingSkeleton type="table" count={6} />
      ) : reviews.length === 0 ? (
        <EmptyState
          icon={<MessageSquare size={48} />}
          title="No reviews found"
          description={statusFilter ? `No ${statusFilter} reviews to show.` : 'No reviews have been submitted yet.'}
          actionText={statusFilter ? 'Show All' : undefined}
          onAction={statusFilter ? () => setStatusFilter('') : undefined}
        />
      ) : (
        <div className="glass-card" style={{ overflow: 'hidden', padding: 0 }}>
          {reviews.map((review, i) => (
            <div
              key={review._id}
              style={{
                padding: '1.25rem 1.5rem',
                borderBottom: i < reviews.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                display: 'flex', flexDirection: 'column', gap: '0.75rem',
              }}
            >
              {/* Top row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                  <div className="gradient-brand" style={{ width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: '0.85rem', flexShrink: 0 }}>
                    {review.userName?.[0]?.toUpperCase() || 'U'}
                  </div>
                  <div>
                    <p style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.9rem' }}>{review.userName}</p>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{review.userEmail}</p>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <StarDisplay rating={review.rating} />
                  <span className={`badge ${STATUS_COLORS[review.status] || 'badge-muted'}`}>
                    {review.status}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {new Date(review.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                </div>
              </div>

              {/* Comment */}
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: 1.7, paddingLeft: '3.5rem' }}>
                &ldquo;{review.comment}&rdquo;
              </p>

              {/* Actions */}
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                {review.status !== 'approved' && (
                  <button
                    onClick={() => updateStatus(review._id, 'approved')}
                    disabled={!!actionLoading[`${review._id}-approved`]}
                    className="btn btn-success btn-sm"
                    style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                  >
                    <Check size={14} /> Approve
                  </button>
                )}
                {review.status !== 'rejected' && (
                  <button
                    onClick={() => updateStatus(review._id, 'rejected')}
                    disabled={!!actionLoading[`${review._id}-rejected`]}
                    className="btn btn-ghost btn-sm"
                    style={{ color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                  >
                    <X size={14} /> Reject
                  </button>
                )}
                {review.status !== 'pending' && (
                  <button
                    onClick={() => updateStatus(review._id, 'pending')}
                    disabled={!!actionLoading[`${review._id}-pending`]}
                    className="btn btn-ghost btn-sm"
                    style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                  >
                    <RotateCcw size={14} /> Reset
                  </button>
                )}
                <button
                  onClick={() => deleteReview(review._id)}
                  disabled={!!actionLoading[`${review._id}-delete`]}
                  className="btn btn-ghost btn-sm"
                  style={{ color: 'var(--danger)' }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}

          {/* Pagination */}
          {pages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', borderTop: '1px solid var(--border-default)' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Page {page} of {pages} ({total} total)
              </span>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="btn btn-secondary btn-sm">Previous</button>
                <button disabled={page === pages} onClick={() => setPage(p => p + 1)} className="btn btn-secondary btn-sm">Next</button>
              </div>
            </div>
          )}
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
