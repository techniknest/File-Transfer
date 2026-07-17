'use client';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { Star, PenLine, X, Send, MessageSquare, ChevronLeft, ChevronRight } from 'lucide-react';
import { showToast } from '../components/Toast';

function StarDisplay({ rating, size = 16, interactive = false, onChange }) {
  const [hovered, setHovered] = useState(0);
  const display = interactive ? (hovered || rating) : rating;
  return (
    <div style={{ display: 'flex', gap: '2px' }}>
      {[1, 2, 3, 4, 5].map(s => (
        <button
          key={s}
          type={interactive ? 'button' : undefined}
          onClick={interactive ? () => onChange?.(s) : undefined}
          onMouseEnter={interactive ? () => setHovered(s) : undefined}
          onMouseLeave={interactive ? () => setHovered(0) : undefined}
          style={{
            background: 'none', border: 'none', padding: 0,
            cursor: interactive ? 'pointer' : 'default',
            transition: 'transform 0.1s ease',
            transform: interactive && hovered === s ? 'scale(1.2)' : 'scale(1)',
          }}
        >
          <Star
            size={size}
            fill={s <= display ? '#f59e0b' : 'none'}
            color={s <= display ? '#f59e0b' : 'rgba(255,255,255,0.2)'}
            strokeWidth={1.5}
          />
        </button>
      ))}
    </div>
  );
}

function ReviewCard({ review }) {
  const initials = review.userName?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U';
  return (
    <div className="card animate-fade-up" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div className="gradient-brand" style={{ width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: '0.9rem', flexShrink: 0 }}>
            {initials}
          </div>
          <div>
            <p style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.9rem' }}>{review.userName}</p>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {new Date(review.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
        </div>
        <StarDisplay rating={review.rating} size={14} />
      </div>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: 1.7, flex: 1 }}>
        &ldquo;{review.comment}&rdquo;
      </p>
    </div>
  );
}

export default function ReviewsPage() {
  const { data: session } = useSession();
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [avgRating, setAvgRating] = useState(0);
  const [ratingCount, setRatingCount] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchReviews = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reviews?page=${page}&limit=12`);
      const data = await res.json();
      if (!data.error) {
        setReviews(data.reviews || []);
        setTotal(data.total || 0);
        setPages(data.pages || 1);
        setAvgRating(data.avgRating || 0);
        setRatingCount(data.ratingCount || 0);
      }
    } catch {
      showToast('Failed to load reviews', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchReviews(); }, [page]);

  const submitReview = async (e) => {
    e.preventDefault();
    if (comment.trim().length < 10) {
      showToast('Comment must be at least 10 characters', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating, comment }),
      });
      const data = await res.json();
      if (data.error) {
        showToast(data.error, 'error');
      } else {
        showToast(data.message, 'success');
        setModalOpen(false);
        setRating(5);
        setComment('');
      }
    } catch {
      showToast('Failed to submit review', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div style={{ minHeight: '100vh', background: 'var(--bg-base)', paddingTop: '80px', paddingBottom: '4rem' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 1.5rem' }}>
          {/* Hero */}
          <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', padding: '0.4rem 1rem', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: '999px' }}>
              <Star size={14} fill="#f59e0b" color="#f59e0b" />
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#fbbf24' }}>User Reviews</span>
            </div>
            <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3rem)', fontWeight: 900, color: 'var(--text-primary)', marginBottom: '1rem', lineHeight: 1.2 }}>
              What People Are
              <span className="gradient-text"> Saying</span>
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem', maxWidth: '540px', margin: '0 auto 2rem' }}>
              Honest reviews from real users who've experienced P2P Transfer.
            </p>

            {/* Stats row */}
            {ratingCount > 0 && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '1.5rem', padding: '1rem 2rem', background: 'var(--bg-glass)', border: '1px solid var(--border-glass)', borderRadius: '1rem', backdropFilter: 'blur(20px)', marginBottom: '2rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontSize: '2.5rem', fontWeight: 900, color: '#f59e0b', lineHeight: 1 }}>{avgRating}</p>
                  <StarDisplay rating={Math.round(avgRating)} size={18} />
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>{ratingCount} reviews</p>
                </div>
              </div>
            )}

            {session ? (
              <button
                onClick={() => setModalOpen(true)}
                className="btn btn-primary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
              >
                <PenLine size={16} /> Write a Review
              </button>
            ) : (
              <Link href="/login" className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                <PenLine size={16} /> Sign in to Review
              </Link>
            )}
          </div>

          {/* Reviews Grid */}
          {loading ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.25rem' }}>
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="skeleton" style={{ height: '180px', borderRadius: '1rem' }} />
              ))}
            </div>
          ) : reviews.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '4rem 2rem' }}>
              <MessageSquare size={48} style={{ color: 'var(--text-muted)', margin: '0 auto 1rem', display: 'block' }} />
              <h3 style={{ color: 'var(--text-primary)', fontWeight: 700, marginBottom: '0.5rem' }}>No reviews yet</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Be the first to share your experience!</p>
            </div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }} className="stagger">
                {reviews.map(r => <ReviewCard key={r._id} review={r} />)}
              </div>

              {/* Pagination */}
              {pages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem' }}>
                  <button
                    disabled={page === 1}
                    onClick={() => setPage(p => p - 1)}
                    className="btn btn-secondary btn-sm"
                    style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                  >
                    <ChevronLeft size={16} /> Previous
                  </button>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                    Page {page} of {pages}
                  </span>
                  <button
                    disabled={page === pages}
                    onClick={() => setPage(p => p + 1)}
                    className="btn btn-secondary btn-sm"
                    style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                  >
                    Next <ChevronRight size={16} />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Write Review Modal */}
      {modalOpen && (
        <div className="modal-overlay">
          <div className="modal-box glass-card" style={{ width: '100%', maxWidth: '520px', padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>Write a Review</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginTop: '0.2rem' }}>Share your experience with P2P Transfer</p>
              </div>
              <button onClick={() => setModalOpen(false)} className="btn btn-ghost btn-icon">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={submitReview} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                  Your Rating
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <StarDisplay rating={rating} size={32} interactive onChange={setRating} />
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                    {rating === 1 ? 'Poor' : rating === 2 ? 'Fair' : rating === 3 ? 'Good' : rating === 4 ? 'Very Good' : 'Excellent'}
                  </span>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                  Your Comment <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({comment.length}/1000)</span>
                </label>
                <textarea
                  className="input"
                  rows={4}
                  placeholder="Tell others about your experience... (min 10 characters)"
                  value={comment}
                  onChange={e => setComment(e.target.value.slice(0, 1000))}
                  required
                  style={{ resize: 'vertical', minHeight: '100px' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setModalOpen(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || comment.trim().length < 10}
                  className="btn btn-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                >
                  {submitting ? (
                    <><span style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid white', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} /> Submitting...</>
                  ) : (
                    <><Send size={15} /> Submit Review</>
                  )}
                </button>
              </div>

              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                Your review will be visible after admin approval.
              </p>
            </form>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
}
