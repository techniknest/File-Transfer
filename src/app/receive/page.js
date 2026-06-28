'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useSocket } from '@/hooks/useSocket';
import { useWebRTC } from '@/hooks/useWebRTC';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import FileIcon from '../components/FileIcon';
import { showToast } from '../components/Toast';

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(2)} MB`;
  return `${(bytes / 1073741824).toFixed(2)} GB`;
}

function formatTime(seconds) {
  if (!isFinite(seconds) || seconds <= 0) return '—';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

export default function ReceivePage() {
  const [receiveLink, setReceiveLink] = useState('');
  const [status, setStatus] = useState('idle'); // idle | connecting | waiting | receiving | done | invalid | expired | full
  const [roomId, setRoomId] = useState('');
  const [receivedFiles, setReceivedFiles] = useState([]);
  
  // Real-time transfer stats
  const [stats, setStats] = useState({
    progress: 0,
    currentFile: '',
    speed: 0,
    eta: 0,
    totalFiles: 0,
    receivedCount: 0,
  });

  const socketRef = useSocket();
  const roomIdRef = useRef('');
  const chunksRef = useRef([]);
  const metaRef = useRef(null);

  // Speed and ETA calculation trackers
  const trackingRef = useRef({
    totalBytes: 0,
    receivedBytes: 0,
    lastTime: Date.now(),
    lastBytes: 0,
  });

  const handleIceCandidateEmission = useCallback((candidate) => {
    if (socketRef.current && roomIdRef.current) {
      socketRef.current.emit('ice-candidate', { roomId: roomIdRef.current, candidate });
    }
  }, [socketRef]);

  const handleDataChannel = useCallback((e) => {
    const dc = e.channel;
    dc.binaryType = 'arraybuffer';
    setStatus('receiving');

    const filesArr = [];

    dc.onmessage = (ev) => {
      if (typeof ev.data === 'string') {
        const msg = JSON.parse(ev.data);

        if (msg.type === 'session-info') {
          trackingRef.current.totalBytes = msg.totalBytes;
          setStats(prev => ({ ...prev, totalFiles: msg.totalFiles }));
          showToast('Transfer started!', 'info');
        }

        if (msg.type === 'meta') {
          metaRef.current = msg;
          chunksRef.current = [];
          setStats(prev => ({ ...prev, currentFile: msg.fileName }));
        }

        if (msg.type === 'file-end') {
          const blob = new Blob(chunksRef.current, { type: metaRef.current.fileType || 'application/octet-stream' });
          const url = URL.createObjectURL(blob);
          
          filesArr.push({ name: metaRef.current.fileName, url, size: metaRef.current.fileSize });
          setReceivedFiles([...filesArr]);
          
          setStats(prev => ({ ...prev, receivedCount: prev.receivedCount + 1 }));
          showToast(`Successfully received ${metaRef.current.fileName}`, 'success', 2000);

          // Auto-trigger file download for a direct native experience
          const a = document.createElement('a');
          a.href = url;
          a.download = metaRef.current.fileName;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        }

        if (msg.type === 'session-end') {
          setStatus('done');
          showToast('All files downloaded successfully!', 'success');
        }
      } else {
        // Raw binary buffer chunks
        chunksRef.current.push(ev.data);
        trackingRef.current.receivedBytes += ev.data.byteLength;

        // Throttle progress and speed calculations
        const now = Date.now();
        const elapsed = (now - trackingRef.current.lastTime) / 1000;
        if (elapsed >= 0.25) {
          const bytesDelta = trackingRef.current.receivedBytes - trackingRef.current.lastBytes;
          const speed = bytesDelta / elapsed;
          const remaining = trackingRef.current.totalBytes - trackingRef.current.receivedBytes;
          const eta = speed > 0 ? remaining / speed : 0;
          const progress = trackingRef.current.totalBytes > 0
            ? (trackingRef.current.receivedBytes / trackingRef.current.totalBytes) * 100
            : 0;

          trackingRef.current.lastTime = now;
          trackingRef.current.lastBytes = trackingRef.current.receivedBytes;

          setStats(prev => ({
            ...prev,
            progress: Math.min(progress, 100),
            speed,
            eta,
          }));
        }
      }
    };

    dc.onerror = (err) => {
      console.error('[WebRTC DataChannel Error]:', err);
      showToast('Connection interrupted. Please try rejoining.', 'error');
      setStatus('idle');
    };
  }, []);

  const { initPC, handleOffer, handleIceCandidate, close } = useWebRTC(handleIceCandidateEmission, handleDataChannel);

  const startReceiving = useCallback((targetRoomId) => {
    if (!targetRoomId) return;

    setStatus('connecting');
    setRoomId(targetRoomId);
    roomIdRef.current = targetRoomId;

    const socket = socketRef.current;
    if (!socket.connected) {
      socket.connect();
    }
    
    socket.emit('join-room', targetRoomId);

    // Reset metrics
    trackingRef.current = {
      totalBytes: 0,
      receivedBytes: 0,
      lastTime: Date.now(),
      lastBytes: 0,
    };
    setReceivedFiles([]);

    socket.on('joined-as-receiver', () => {
      setStatus('waiting');
      initPC();
      showToast('Joined room. Waiting for sender to launch stream.', 'info');
    });

    socket.on('offer', async ({ offer }) => {
      const answer = await handleOffer(offer);
      socket.emit('answer', { roomId: targetRoomId, answer });
    });

    socket.on('ice-candidate', async ({ candidate }) => {
      await handleIceCandidate(candidate);
    });

    socket.on('room-not-found', () => {
      setStatus('invalid');
      showToast('Room not found. Check link or re-enter.', 'error');
    });

    socket.on('room-expired', () => {
      setStatus('expired');
      showToast('This transfer room session has expired.', 'error');
    });

    socket.on('room-full', () => {
      setStatus('full');
      showToast('This room is full.', 'error');
    });

    socket.on('peer-disconnected', () => {
      showToast('Sender closed the link connection.', 'warning');
      setStatus('idle');
    });
  }, [socketRef, initPC, handleOffer, handleIceCandidate]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!receiveLink) return;
    try {
      const url = new URL(receiveLink.trim());
      const roomVal = url.searchParams.get('room');
      if (roomVal) {
        startReceiving(roomVal);
      } else {
        showToast('Invalid transfer URL. Could not parse roomId.', 'error');
      }
    } catch (_) {
      // Allow pasting just raw room code
      startReceiving(receiveLink.trim().toUpperCase());
    }
  };

  // Support direct loading via URL room param
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    if (roomParam) {
      setReceiveLink(window.location.href);
      startReceiving(roomParam);
    }
    return () => {
      close();
    };
  }, [startReceiving, close]);

  // Block window closing while transfer is active
  useEffect(() => {
    if (status === 'receiving') {
      const handler = (e) => {
        e.preventDefault();
        e.returnValue = 'Transfer is in progress! If you exit, the transfer will fail.';
        return e.returnValue;
      };
      window.addEventListener('beforeunload', handler);
      return () => window.removeEventListener('beforeunload', handler);
    }
  }, [status]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Navbar />

      <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 1.5rem 40px' }} className="animate-fade-in">
        <div className="glass-card" style={{ width: '100%', maxWidth: '500px', padding: '2.5rem', border: '1px solid var(--border-default)' }}>
          {/* Brand icon */}
          <div className="gradient-success" style={{ width: '56px', height: '56px', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem', boxShadow: '0 4px 16px rgba(16,185,129,0.3)' }}>
            <span style={{ fontSize: '1.5rem', color: 'white' }}>⚡</span>
          </div>

          {/* IDLE state: Ask for Link */}
          {status === 'idle' && (
            <div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', textAlign: 'center', marginBottom: '0.5rem' }}>
                Paste Transfer Link
              </h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textAlign: 'center', marginBottom: '1.75rem' }}>
                Paste the unique transfer link or enters the room code below.
              </p>

              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <input
                  type="text"
                  className="input"
                  placeholder="https://p2ptransfer.com/receive?room=..."
                  value={receiveLink}
                  onChange={(e) => setReceiveLink(e.target.value)}
                  required
                />
                <button type="submit" className="btn btn-success btn-lg" style={{ width: '100%' }}>
                  Start Downloading
                </button>
              </form>
            </div>
          )}

          {/* CONNECTING state */}
          {status === 'connecting' && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: '48px', height: '48px', border: '3px solid rgba(16,185,129,0.15)', borderTop: '3px solid #10b981', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 1.5rem' }} />
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>Connecting</h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Connecting to signaling lobby room {roomId}...</p>
            </div>
          )}

          {/* WAITING state */}
          {status === 'waiting' && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: '48px', height: '48px', border: '3px solid rgba(16,185,129,0.15)', borderTop: '3px solid #10b981', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 1.5rem' }} />
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>Ready to Stream</h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>Waiting for the sender to launch the transfer...</p>
              <button onClick={() => setStatus('idle')} className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }}>Cancel</button>
            </div>
          )}

          {/* RECEIVING state */}
          {status === 'receiving' && (
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', textAlign: 'center', marginBottom: '1.5rem' }}>
                Transfer in Progress...
              </h2>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
                {[
                  { label: 'Speed', value: `${formatBytes(stats.speed)}/s` },
                  { label: 'ETA', value: formatTime(stats.eta) },
                  { label: 'Files Done', value: `${stats.receivedCount} of ${stats.totalFiles}` },
                  { label: 'Progress', value: `${Math.round(stats.progress)}%` },
                ].map((s, idx) => (
                  <div key={idx} style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-default)', borderRadius: '0.75rem', padding: '0.75rem 0.5rem', textAlign: 'center' }}>
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '0.15rem' }}>{s.label}</span>
                    <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>{s.value}</span>
                  </div>
                ))}
              </div>

              {stats.currentFile && (
                <div style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '0.75rem', padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
                  <span>📥</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Receiving File</p>
                    <p style={{ fontSize: '0.85rem', fontWeight: 600, color: '#10b981', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {stats.currentFile}
                    </p>
                  </div>
                </div>
              )}

              <div className="progress-track" style={{ height: '8px', marginBottom: '1.5rem' }}>
                <div className="progress-fill progress-fill-success" style={{ width: `${stats.progress}%` }} />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '0.625rem', padding: '0.75rem 1rem' }}>
                <span>⚠️</span>
                <p style={{ fontSize: '0.75rem', color: '#fbbf24', lineHeight: 1.4 }}>
                  Please do not close this window, refresh the page, or disconnect your internet connection while files are being transferred.
                </p>
              </div>
            </div>
          )}

          {/* DONE state */}
          {status === 'done' && (
            <div style={{ textAlign: 'center' }}>
              <span style={{ fontSize: '3rem', display: 'block', marginBottom: '1rem' }}>🎉</span>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>All Files Received!</h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>Download triggered natively onto your device.</p>
              
              {receivedFiles.length > 0 && (
                <div style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-default)', borderRadius: '0.75rem', padding: '0.75rem', maxHeight: '180px', overflowY: 'auto', textAlign: 'left', marginBottom: '1.5rem' }}>
                  {receivedFiles.map((file, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', justify: 'space-between', padding: '0.35rem 0', borderBottom: idx < receivedFiles.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>
                        📄 {file.name}
                      </span>
                      <a href={file.url} download={file.name} style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 600 }}>Download Again</a>
                    </div>
                  ))}
                </div>
              )}

              <button onClick={() => setStatus('idle')} className="btn btn-secondary" style={{ width: '100%' }}>
                Receive More Files
              </button>
            </div>
          )}

          {/* INVALID state */}
          {status === 'invalid' && (
            <div style={{ textAlign: 'center' }}>
              <span style={{ fontSize: '3rem', display: 'block', marginBottom: '1rem' }}>❌</span>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>Room Not Found</h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>The transfer session may have expired or is invalid.</p>
              <button onClick={() => setStatus('idle')} className="btn btn-secondary" style={{ width: '100%' }}>Back to Start</button>
            </div>
          )}

          {/* EXPIRED state */}
          {status === 'expired' && (
            <div style={{ textAlign: 'center' }}>
              <span style={{ fontSize: '3rem', display: 'block', marginBottom: '1rem' }}>⌛</span>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>Session Expired</h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>The transfer link has expired (24 hours limit).</p>
              <button onClick={() => setStatus('idle')} className="btn btn-secondary" style={{ width: '100%' }}>Back to Start</button>
            </div>
          )}

          {/* FULL state */}
          {status === 'full' && (
            <div style={{ textAlign: 'center' }}>
              <span style={{ fontSize: '3rem', display: 'block', marginBottom: '1rem' }}>🚫</span>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>Room Full</h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>This transfer channel already has a receiver connected.</p>
              <button onClick={() => setStatus('idle')} className="btn btn-secondary" style={{ width: '100%' }}>Back to Start</button>
            </div>
          )}
        </div>
      </main>

      <Footer />
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
