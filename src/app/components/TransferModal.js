'use client';
import { useState } from 'react';
import { Upload, X, File, Link as LinkIcon, Check, Copy, Zap, Timer, AlertTriangle, Plus, Star } from 'lucide-react';
import { showToast } from './Toast';

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(2)} MB`;
  return `${(bytes / 1073741824).toFixed(2)} GB`;
}

function formatTime(s) {
  if (!s || !isFinite(s) || s <= 0) return '--';
  if (s < 60) return `${Math.round(s)}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
}

function formatSpeed(bps) {
  if (!bps) return '0 B/s';
  if (bps < 1024) return `${bps.toFixed(0)} B/s`;
  if (bps < 1048576) return `${(bps / 1024).toFixed(1)} KB/s`;
  return `${(bps / 1048576).toFixed(2)} MB/s`;
}

export default function TransferModal({ isOpen, onClose, files, shareLink, roomId, status, progress, speed, eta, currentFile, onAddFiles, isResumed = false }) {
  const [copied, setCopied] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [reviewSubmitted, setReviewSubmitted] = useState(false);
  const [submittingReview, setSubmittingReview] = useState(false);

  if (!isOpen) return null;

  const copyLink = () => {
    navigator.clipboard.writeText(shareLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const submitReview = async (e) => {
    e.preventDefault();
    if (comment.trim().length < 10) {
      showToast('Comment must be at least 10 characters', 'error');
      return;
    }
    setSubmittingReview(true);
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating, comment, roomId }),
      });
      const data = await res.json();
      if (data.error) {
        showToast(data.error, 'error');
      } else {
        showToast('Review submitted successfully!', 'success');
        setReviewSubmitted(true);
      }
    } catch {
      showToast('Failed to submit review', 'error');
    } finally {
      setSubmittingReview(false);
    }
  };

  const totalSize = files?.reduce((a, f) => a + f.size, 0) || 0;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
    }}>
      <div style={{
        background: 'var(--bg-surface, #1a1a2e)',
        border: '1px solid rgba(99,102,241,0.3)',
        borderRadius: '1.5rem', padding: '2rem',
        width: '100%', maxWidth: '560px',
        boxShadow: '0 25px 50px rgba(0,0,0,0.5)'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
          <h2 style={{ color: 'white', fontWeight: 800, fontSize: '1.4rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Upload size={24} /> Transfer Session
          </h2>
          {status !== 'transferring' && (
            <button onClick={onClose} style={{
              background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white',
              width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}><X size={20} /></button>
          )}
        </div>

        {/* Files list */}
        <div style={{ marginBottom: '1.5rem' }}>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem', marginBottom: '0.75rem', fontWeight: 600 }}>
            FILES ({files?.length || 0}) — {formatBytes(totalSize)}
          </p>
          <div style={{ maxHeight: '150px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {files?.map((f, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: '0.75rem',
                background: 'rgba(255,255,255,0.05)', borderRadius: '0.75rem', padding: '0.6rem 0.875rem'
              }}>
                <File size={20} className="text-gray-400" />
                <span style={{ color: 'white', fontSize: '0.875rem', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem', flexShrink: 0 }}>{formatBytes(f.size)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Share Link */}
        {shareLink && (
          <div style={{ marginBottom: '1.5rem' }}>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem', marginBottom: '0.5rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <LinkIcon size={16} /> SHARE THIS LINK
            </p>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                readOnly value={shareLink}
                style={{
                  flex: 1, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: '0.75rem', padding: '0.75rem 1rem', color: 'white', fontSize: '0.875rem',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                }}
              />
              <button onClick={copyLink} style={{
                background: copied ? '#10b981' : '#6366f1', border: 'none', color: 'white',
                borderRadius: '0.75rem', padding: '0.75rem 1rem', cursor: 'pointer', fontWeight: 700,
                fontSize: '0.875rem', flexShrink: 0, transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '0.4rem'
              }}>
                {copied ? <><Check size={16} /> Copied!</> : <><Copy size={16} /> Copy</>}
              </button>
            </div>
          </div>
        )}

        {/* Status */}
        {status === 'waiting' && (
          <div style={{ textAlign: 'center', padding: '1rem 0' }}>
            <div style={{ display: 'inline-block', width: '40px', height: '40px', border: '3px solid rgba(99,102,241,0.2)', borderTop: '3px solid #6366f1', borderRadius: '50%', animation: 'spin 0.8s linear infinite', marginBottom: '0.75rem' }} />
            <p style={{ color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>Waiting for receiver to join...</p>
          </div>
        )}

        {status === 'connecting' && (
          <div style={{ textAlign: 'center', padding: '1rem 0' }}>
            <p style={{ color: '#6366f1', fontWeight: 700, fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}><LinkIcon size={20} /> Establishing P2P connection...</p>
          </div>
        )}

        {status === 'transferring' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0, flex: 1 }}>
                <span style={{
                  color: 'rgba(255,255,255,0.7)', fontSize: '0.875rem',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {currentFile ? `Sending: ${currentFile}` : 'Transferring...'}
                </span>
                {isResumed && (
                  <span style={{
                    fontSize: '0.68rem', fontWeight: 700, color: '#f59e0b',
                    background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.4)',
                    padding: '0.15rem 0.5rem', borderRadius: '999px', flexShrink: 0
                  }}>
                    Resumed
                  </span>
                )}
              </div>
              <span style={{ color: 'white', fontWeight: 700, flexShrink: 0 }}>{Math.round(progress)}%</span>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: '999px', height: '8px', marginBottom: '0.75rem' }}>
              <div style={{ background: 'linear-gradient(90deg, #6366f1, #8b5cf6)', height: '100%', borderRadius: '999px', width: `${progress}%`, transition: 'width 0.3s' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}><Zap size={14} /> {formatSpeed(speed)}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}><Timer size={14} /> ETA: {formatTime(eta)}</span>
            </div>
          </div>
        )}

        {status === 'done' && (
          <div style={{ padding: '1rem 0' }}>
            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              <div className="flex justify-center mb-2"><Check size={48} className="text-emerald-500" /></div>
              <p style={{ color: '#10b981', fontWeight: 800, fontSize: '1.2rem' }}>Transfer Complete!</p>
            </div>
            
            {!reviewSubmitted ? (
              <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '1rem', padding: '1.25rem', marginTop: '1rem' }}>
                <p style={{ color: 'white', fontWeight: 700, fontSize: '1rem', marginBottom: '0.5rem', textAlign: 'center' }}>Rate your experience</p>
                <form onSubmit={submitReview} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '0.25rem' }}>
                    {[1, 2, 3, 4, 5].map(s => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setRating(s)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.2rem' }}
                      >
                        <Star size={24} fill={s <= rating ? '#f59e0b' : 'none'} color={s <= rating ? '#f59e0b' : 'rgba(255,255,255,0.2)'} />
                      </button>
                    ))}
                  </div>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value.slice(0, 1000))}
                    placeholder="Tell us what you think... (min 10 chars)"
                    rows={3}
                    style={{
                      background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '0.5rem', padding: '0.75rem', color: 'white', fontSize: '0.875rem',
                      resize: 'none'
                    }}
                  />
                  <button
                    type="submit"
                    disabled={submittingReview || comment.trim().length < 10}
                    style={{
                      background: '#6366f1', color: 'white', border: 'none', borderRadius: '0.5rem',
                      padding: '0.75rem', fontWeight: 700, cursor: 'pointer', opacity: (submittingReview || comment.trim().length < 10) ? 0.5 : 1
                    }}
                  >
                    {submittingReview ? 'Submitting...' : 'Submit Review'}
                  </button>
                </form>
              </div>
            ) : (
              <div style={{ textAlign: 'center', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '1rem', padding: '1rem', marginTop: '1rem' }}>
                <p style={{ color: '#10b981', fontWeight: 600, fontSize: '0.95rem' }}>Thank you for your feedback!</p>
              </div>
            )}
          </div>
        )}

        {/* Warning */}
        {(status === 'waiting' || status === 'transferring' || status === 'connecting') && (
          <div style={{
            marginTop: '1.25rem', background: 'rgba(245,158,11,0.1)',
            border: '1px solid rgba(245,158,11,0.3)', borderRadius: '0.75rem', padding: '0.875rem 1rem'
          }}>
            <p style={{ color: '#f59e0b', fontWeight: 700, fontSize: '0.875rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <AlertTriangle size={18} /> Do not close this window until transfer is complete!
            </p>
          </div>
        )}

        {/* Add more files button */}
        {status === 'waiting' && onAddFiles && (
          <button
            onClick={() => document.getElementById('addMoreFilesInput').click()}
            style={{
              marginTop: '1rem', width: '100%', background: 'rgba(255,255,255,0.08)',
              border: '1px dashed rgba(255,255,255,0.2)', borderRadius: '0.75rem',
              padding: '0.75rem', color: 'rgba(255,255,255,0.7)', cursor: 'pointer',
              fontWeight: 600, fontSize: '0.875rem', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem'
            }}
          >
            <Plus size={16} /> Add More Files
          </button>
        )}
        <input id="addMoreFilesInput" type="file" multiple style={{ display: 'none' }}
          onChange={e => { if (e.target.files?.length && onAddFiles) { onAddFiles([...e.target.files]); e.target.value = ''; } }} />
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}