'use client';
import { useState, useEffect, useRef } from 'react';
import { useSignaling } from '@/hooks/useSignaling';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { FileText, FileImage, FileVideo, FileAudio, FileArchive, FileCode, File, Zap, Download, Radio, AlertTriangle, CheckCircle, XCircle, Info, Ban, Hourglass } from 'lucide-react';

// ─── ICE / STUN / TURN servers ────────────────────────────────────────────────
const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443?transport=tcp',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
  ],
};

// ─── Helpers ───────────────────────────────────────────────────────────────────
function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
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

function getFileIcon(fileName) {
  if (!fileName) return <File />;
  const ext = fileName.split('.').pop()?.toLowerCase();
  const map = {
    pdf: <FileText />, doc: <FileText />, docx: <FileText />, txt: <FileText />, xls: <FileText />, xlsx: <FileText />,
    ppt: <FileText />, pptx: <FileText />, zip: <FileArchive />, rar: <FileArchive />, '7z': <FileArchive />, tar: <FileArchive />,
    mp4: <FileVideo />, mov: <FileVideo />, avi: <FileVideo />, mkv: <FileVideo />, mp3: <FileAudio />, wav: <FileAudio />,
    flac: <FileAudio />, jpg: <FileImage />, jpeg: <FileImage />, png: <FileImage />, gif: <FileImage />, svg: <FileImage />,
    webp: <FileImage />, js: <FileCode />, ts: <FileCode />, py: <FileCode />, html: <FileCode />, css: <FileCode />,
  };
  return map[ext] || <File />;
}

// ─── Toast Component ───────────────────────────────────────────────────────────
function Toast({ toasts }) {
  return (
    <div style={{ position: 'fixed', top: '1.5rem', right: '1.5rem', zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '0.5rem', maxWidth: '320px' }}>
      {toasts.map((t) => (
        <div key={t.id} style={{
          background: t.type === 'error' ? 'rgba(239,68,68,0.15)' : t.type === 'success' ? 'rgba(16,185,129,0.15)' : t.type === 'warning' ? 'rgba(245,158,11,0.15)' : 'rgba(99,102,241,0.15)',
          border: `1px solid ${t.type === 'error' ? 'rgba(239,68,68,0.4)' : t.type === 'success' ? 'rgba(16,185,129,0.4)' : t.type === 'warning' ? 'rgba(245,158,11,0.4)' : 'rgba(99,102,241,0.4)'}`,
          borderRadius: '0.75rem', padding: '0.75rem 1rem',
          backdropFilter: 'blur(12px)',
          color: 'white', fontSize: '0.875rem', fontWeight: 500,
          animation: 'slideInRight 0.3s ease',
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
        }}>
          <span>{t.type === 'error' ? <XCircle size={16} /> : t.type === 'success' ? <CheckCircle size={16} /> : t.type === 'warning' ? <AlertTriangle size={16} /> : <Info size={16} />}</span>
          {t.message}
        </div>
      ))}
    </div>
  );
}

// ─── Animated Spinner ──────────────────────────────────────────────────────────
function Spinner({ color = '#10b981', size = 48, thickness = 3 }) {
  return (
    <div style={{
      width: size, height: size,
      border: `${thickness}px solid rgba(255,255,255,0.08)`,
      borderTop: `${thickness}px solid ${color}`,
      borderRadius: '50%',
      animation: 'spin 0.9s linear infinite',
      margin: '0 auto',
    }} />
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function ReceivePage() {
  const [status, setStatus] = useState('idle');  // idle | connecting | waiting | receiving | done | invalid | expired | full | error
  const [roomId, setRoomId] = useState('');
  const [manualLink, setManualLink] = useState('');
  const [prefilledRoomId, setPrefilledRoomId] = useState('');
  const [receivedFiles, setReceivedFiles] = useState([]);
  const [toasts, setToasts] = useState([]);
  const signaling = useSignaling();

  // Transfer stats
  const [stats, setStats] = useState({
    progress: 0,
    currentFile: '',
    speed: 0,
    eta: 0,
    totalFiles: 0,
    receivedCount: 0,
    totalBytes: 0,
    receivedBytes: 0,
  });

  // Refs — all mutable state kept out of React for the WebRTC data channel callbacks
  const pcRef = useRef(null);
  const chunksRef = useRef([]);
  const metaRef = useRef(null);
  const roomIdRef = useRef('');
  const trackRef = useRef({ totalBytes: 0, receivedBytes: 0, lastTime: Date.now(), lastBytes: 0 });
  const filesRef = useRef([]);  // accumulates { name, url, size } across session
  const initializedRef = useRef(false);

  // ── Toast helper ─────────────────────────────────────────────────────────────
  const addToast = (message, type = 'info', duration = 3500) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration);
  };

  // ── Core connection logic ─────────────────────────────────────────────────────
  const connect = async (targetRoomId) => {
    if (!targetRoomId) return;
    roomIdRef.current = targetRoomId;
    setRoomId(targetRoomId);
    setStatus('connecting');

    // Reset tracking
    trackRef.current = { totalBytes: 0, receivedBytes: 0, lastTime: Date.now(), lastBytes: 0 };
    filesRef.current = [];
    chunksRef.current = [];
    metaRef.current = null;

    try {
      await signaling.joinRoom(targetRoomId);
      setStatus('waiting');
      addToast('Connected! Waiting for sender to begin...', 'info');
    } catch (err) {
      if (err.code === 'ROOM_NOT_FOUND') {
        setStatus('invalid');
        addToast('Room not found. Check the link or ask the sender to resend.', 'error');
      } else if (err.code === 'ROOM_FULL') {
        setStatus('full');
        addToast('This transfer room already has a receiver.', 'error');
      } else {
        setStatus('error');
        addToast(err.message || 'Could not connect to room. Please try again.', 'error');
      }
      return;
    }

    const pc = new RTCPeerConnection(ICE_SERVERS);
    pcRef.current = pc;

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        signaling.sendSignal('ice-candidate', { candidate: e.candidate });
      }
    };

    pc.onconnectionstatechange = () => {
      console.log('[WebRTC] Connection state:', pc.connectionState);
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        addToast('P2P connection lost. The sender may have disconnected.', 'warning');
      }
    };

    // ── DataChannel handler ────────────────────────────────────────────────
    pc.ondatachannel = (e) => {
      const dc = e.channel;
      dc.binaryType = 'arraybuffer';
      console.log('[WebRTC] DataChannel received:', dc.label);
      setStatus('receiving');
      addToast('Transfer started!', 'success');

      dc.onmessage = (ev) => {
        if (typeof ev.data === 'string') {
          let msg;
          try { msg = JSON.parse(ev.data); } catch { return; }

          if (msg.type === 'session-info') {
            trackRef.current.totalBytes = msg.totalBytes || 0;
            setStats(prev => ({
              ...prev,
              totalFiles: msg.totalFiles || 0,
              totalBytes: msg.totalBytes || 0,
            }));
          }

          if (msg.type === 'meta') {
            metaRef.current = msg;
            chunksRef.current = [];
            setStats(prev => ({ ...prev, currentFile: msg.fileName }));
            console.log('[Receive] Incoming file:', msg.fileName, formatBytes(msg.fileSize));
          }

          if (msg.type === 'file-end') {
            const meta = metaRef.current;
            if (!meta) return;

            const chunksCopy = [...chunksRef.current];
            chunksRef.current = [];

            const blob = new Blob(chunksCopy, {
              type: meta.fileType || 'application/octet-stream',
            });
            const url = URL.createObjectURL(blob);
            const fileEntry = { name: meta.fileName, url, size: blob.size };

            filesRef.current = [...filesRef.current, fileEntry];
            setReceivedFiles([...filesRef.current]);
            setStats(prev => ({ ...prev, receivedCount: prev.receivedCount + 1 }));
            addToast(`Received: ${meta.fileName} — click the download button if it didn't save automatically`, 'success', 4000);

            setTimeout(() => {
              try {
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = url;
                a.download = meta.fileName;
                document.body.appendChild(a);
                a.click();
                setTimeout(() => {
                  document.body.removeChild(a);
                }, 2000);
              } catch (err) {
                console.warn('[Download] Auto-download blocked, user can use the button:', err);
              }
            }, 100);
          }

          if (msg.type === 'session-end') {
            setStatus('done');
            setStats(prev => ({ ...prev, progress: 100 }));
            addToast('All files received! Check your Downloads folder.', 'success', 6000);
          }

        } else {
          chunksRef.current.push(ev.data);
          trackRef.current.receivedBytes += ev.data.byteLength;

          const now = Date.now();
          const elapsed = (now - trackRef.current.lastTime) / 1000;
          if (elapsed >= 0.2) {
            const delta = trackRef.current.receivedBytes - trackRef.current.lastBytes;
            const speed = delta / elapsed;
            const remaining = trackRef.current.totalBytes - trackRef.current.receivedBytes;
            const eta = speed > 0 ? remaining / speed : 0;
            const progress = trackRef.current.totalBytes > 0
              ? Math.min((trackRef.current.receivedBytes / trackRef.current.totalBytes) * 100, 99.9)
              : 0;

            trackRef.current.lastTime = now;
            trackRef.current.lastBytes = trackRef.current.receivedBytes;

            setStats(prev => ({ ...prev, progress, speed, eta }));
          }
        }
      };

      dc.onerror = (err) => {
        console.error('[DataChannel] Error:', err);
        addToast('Data channel error. Transfer may have failed.', 'error');
      };

      dc.onclose = () => {
        console.log('[DataChannel] Closed');
      };
    };

    const pendingCandidates = [];

    signaling.off('offer');
    signaling.off('ice-candidate');

    signaling.on('offer', async (data) => {
      const offer = data?.offer;
      const currentPc = pcRef.current;
      if (!currentPc || !offer) return;

      try {
        await currentPc.setRemoteDescription(new RTCSessionDescription(offer));
        for (const candidate of pendingCandidates) {
          try { await currentPc.addIceCandidate(new RTCIceCandidate(candidate)); } catch (e) { console.warn(e); }
        }
        pendingCandidates.length = 0;

        const answer = await currentPc.createAnswer();
        await currentPc.setLocalDescription(answer);
        await signaling.sendSignal('answer', { answer });
        console.log('[WebRTC] Answer sent');
      } catch (err) {
        console.error('[WebRTC] Error handling offer:', err);
        addToast('WebRTC negotiation failed.', 'error');
      }
    });

    signaling.on('ice-candidate', async (data) => {
      const candidate = data?.candidate;
      const currentPc = pcRef.current;
      if (currentPc && candidate) {
        if (currentPc.remoteDescription) {
          try {
            await currentPc.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (err) {
            console.warn('[WebRTC] ICE candidate error (non-fatal):', err.message);
          }
        } else {
          pendingCandidates.push(candidate);
        }
      }
    });
  };

  // ── Auto-connect when URL has ?room= param ────────────────────────────────────
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    if (roomParam) {
      const roomUpper = roomParam.toUpperCase();
      setPrefilledRoomId(roomUpper);
      setManualLink(window.location.origin + '/receive?room=' + roomUpper);
      connect(roomUpper);
    }

    return () => {
      signaling.stopPolling();
      pcRef.current?.close();
      pcRef.current = null;
      initializedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Block accidental close during transfer ─────────────────────────────────
  useEffect(() => {
    if (status !== 'receiving') return;
    const handler = (e) => {
      e.preventDefault();
      e.returnValue = 'File transfer in progress! Closing will cancel the transfer.';
      return e.returnValue;
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [status]);

  // ── Manual link submit ─────────────────────────────────────────────────────
  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (!manualLink.trim()) return;
    let roomVal = manualLink.trim();
    try {
      const url = new URL(roomVal);
      roomVal = url.searchParams.get('room') || roomVal;
    } catch {
      // raw room code pasted — use as-is (uppercased)
      roomVal = roomVal.toUpperCase();
    }
    // Clean up previous connection if any
    signaling.stopPolling();
    pcRef.current?.close();
    pcRef.current = null;
    initializedRef.current = true; // prevent useEffect re-init
    connect(roomVal);
  };

  // ═══════════════════════════════════════════════════════════════════════════
  //  RENDER
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: 'linear-gradient(135deg, #0a0a1a 0%, #0f1225 50%, #0a0a1a 100%)' }}>
      <Navbar />
      <Toast toasts={toasts} />

      <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '100px 1.5rem 60px' }}>
        <div style={{ width: '100%', maxWidth: '520px' }}>

          {/* ── Card ── */}
          <div style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '1.5rem',
            padding: '2.5rem 2rem',
            backdropFilter: 'blur(24px)',
            boxShadow: '0 32px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08)',
          }}>

            {/* Brand badge */}
            <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
              <div style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: '64px', height: '64px', borderRadius: '20px',
                background: 'linear-gradient(135deg, #10b981, #059669)',
                boxShadow: '0 8px 32px rgba(16,185,129,0.4)',
                marginBottom: '1rem',
              }}>
                <Zap size={32} className="text-white" />
              </div>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'white', margin: '0 0 0.35rem', letterSpacing: '-0.02em' }}>
                P2P File Receive
              </h1>
              <p style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.45)', margin: 0 }}>
                Secure · Direct · No Cloud
              </p>
            </div>

            {/* ──────────── IDLE state ──────────── */}
            {status === 'idle' && (
              <div>
                {prefilledRoomId ? (
                  <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div style={{
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '1rem',
                      padding: '1.25rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.25rem'
                    }}>
                      <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Ready to Connect
                      </span>
                      <span style={{ fontSize: '1.5rem', fontWeight: 800, color: '#10b981', fontFamily: 'monospace' }}>
                        {prefilledRoomId}
                      </span>
                    </div>

                    <button
                      onClick={() => connect(prefilledRoomId)}
                      style={{
                        width: '100%', padding: '1.1rem',
                        background: 'linear-gradient(135deg, #10b981, #059669)',
                        border: 'none', borderRadius: '0.875rem',
                        color: 'white', fontSize: '1.1rem', fontWeight: 800,
                        cursor: 'pointer', transition: 'all 0.2s',
                        boxShadow: '0 8px 32px rgba(16,185,129,0.3)',
                      }}
                      onMouseEnter={e => e.target.style.transform = 'translateY(-1px)'}
                      onMouseLeave={e => e.target.style.transform = 'none'}
                    >
                      <div className="flex items-center justify-center gap-2"><Download size={22} /> Start Receiving</div>
                    </button>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.85rem', color: '#10b981', fontWeight: 600 }}>
                        No login required
                      </span>
                      <button
                        onClick={() => { setPrefilledRoomId(''); setManualLink(''); }}
                        style={{
                          background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)',
                          fontSize: '0.8rem', cursor: 'pointer', textDecoration: 'underline'
                        }}
                      >
                        Enter different room code
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <p style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.55)', textAlign: 'center', marginBottom: '1.5rem' }}>
                      Paste a transfer link or room code below to start receiving files.
                    </p>
                    <form onSubmit={handleManualSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                      <input
                        type="text"
                        placeholder="https://…/receive?room=XXXX or room code"
                        value={manualLink}
                        onChange={(e) => setManualLink(e.target.value)}
                        required
                        style={{
                          width: '100%', boxSizing: 'border-box',
                          background: 'rgba(255,255,255,0.07)',
                          border: '1px solid rgba(255,255,255,0.15)',
                          borderRadius: '0.875rem', padding: '0.875rem 1.125rem',
                          color: 'white', fontSize: '0.9rem',
                          outline: 'none', transition: 'border 0.2s',
                        }}
                        onFocus={e => e.target.style.borderColor = 'rgba(16,185,129,0.6)'}
                        onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.15)'}
                      />
                      <button type="submit" style={{
                        width: '100%', padding: '0.9rem',
                        background: 'linear-gradient(135deg, #10b981, #059669)',
                        border: 'none', borderRadius: '0.875rem',
                        color: 'white', fontSize: '0.95rem', fontWeight: 700,
                        cursor: 'pointer', transition: 'all 0.2s',
                        boxShadow: '0 4px 20px rgba(16,185,129,0.35)',
                      }}
                        onMouseEnter={e => e.target.style.transform = 'translateY(-1px)'}
                        onMouseLeave={e => e.target.style.transform = 'none'}
                      >
                        <div className="flex items-center justify-center gap-2"><Download size={20} /> Start Receiving</div>
                      </button>
                    </form>
                  </div>
                )}
              </div>
            )}

            {/* ──────────── CONNECTING state ──────────── */}
            {status === 'connecting' && (
              <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                <Spinner color="#10b981" size={52} />
                <h2 style={{ color: 'white', fontWeight: 700, fontSize: '1.2rem', marginTop: '1.25rem', marginBottom: '0.4rem' }}>
                  Connecting…
                </h2>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.875rem' }}>
                  Joining room <code style={{ color: '#10b981', fontWeight: 600 }}>{roomId}</code>
                </p>
              </div>
            )}

            {/* ──────────── WAITING state ──────────── */}
            {status === 'waiting' && (
              <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                {/* Pulsing ring animation */}
                <div style={{ position: 'relative', width: 80, height: 80, margin: '0 auto 1.5rem' }}>
                  <div style={{
                    position: 'absolute', inset: 0, borderRadius: '50%',
                    background: 'rgba(16,185,129,0.15)',
                    animation: 'pulse-ring 1.6s ease-out infinite',
                  }} />
                  <div style={{
                    position: 'absolute', inset: 8, borderRadius: '50%',
                    background: 'rgba(16,185,129,0.25)',
                    animation: 'pulse-ring 1.6s ease-out 0.4s infinite',
                  }} />
                  <div style={{
                    position: 'absolute', inset: 0, display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Radio size={48} className="text-emerald-500" />
                  </div>
                </div>
                <h2 style={{ color: 'white', fontWeight: 800, fontSize: '1.25rem', marginBottom: '0.5rem' }}>
                  Ready to Receive
                </h2>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.875rem', marginBottom: '1.75rem' }}>
                  Connected to room <code style={{ color: '#10b981', fontWeight: 600 }}>{roomId}</code>
                  <br />Waiting for the sender to start the transfer…
                </p>

                {/* Room code pill */}
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                  background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)',
                  borderRadius: '999px', padding: '0.4rem 1rem',
                  color: '#10b981', fontSize: '0.8rem', fontWeight: 600, marginBottom: '1.5rem',
                }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', display: 'inline-block', animation: 'blink 1.2s ease infinite' }} />
                  LIVE · Room {roomId}
                </div>

                <br />
                <button
                  onClick={() => { signaling.stopPolling(); pcRef.current?.close(); setStatus('idle'); }}
                  style={{
                    background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                    borderRadius: '0.75rem', padding: '0.5rem 1.25rem',
                    color: '#ef4444', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  Cancel
                </button>
              </div>
            )}

            {/* ──────────── RECEIVING state ──────────── */}
            {status === 'receiving' && (
              <div>
                <h2 style={{ color: 'white', fontWeight: 800, fontSize: '1.2rem', textAlign: 'center', marginBottom: '1.5rem' }}>
                  Receiving Files…
                </h2>

                {/* Stats grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.625rem', marginBottom: '1.25rem' }}>
                  {[
                    { label: 'Speed', value: `${formatBytes(stats.speed)}/s` },
                    { label: 'ETA', value: formatTime(stats.eta) },
                    { label: 'Files', value: `${stats.receivedCount} / ${stats.totalFiles || '?'}` },
                    { label: 'Progress', value: `${Math.round(stats.progress)}%` },
                  ].map((s, i) => (
                    <div key={i} style={{
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: '0.875rem', padding: '0.75rem',
                      textAlign: 'center',
                    }}>
                      <div style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.2rem' }}>{s.label}</div>
                      <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'white' }}>{s.value}</div>
                    </div>
                  ))}
                </div>

                {/* Current file */}
                {stats.currentFile && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '0.75rem',
                    background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)',
                    borderRadius: '0.875rem', padding: '0.75rem 1rem', marginBottom: '1.25rem',
                  }}>
                    <span style={{ fontSize: '1.4rem' }}>{getFileIcon(stats.currentFile)}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Receiving</div>
                      <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#10b981', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {stats.currentFile}
                      </div>
                    </div>
                    <Spinner color="#10b981" size={22} thickness={2} />
                  </div>
                )}

                {/* Progress bar with glow */}
                <div style={{ marginBottom: '1.25rem' }}>
                  <div style={{
                    background: 'rgba(255,255,255,0.07)',
                    borderRadius: '999px', height: '10px', overflow: 'hidden',
                    position: 'relative',
                  }}>
                    <div style={{
                      height: '100%', borderRadius: '999px',
                      background: 'linear-gradient(90deg, #10b981, #059669)',
                      width: `${stats.progress}%`,
                      transition: 'width 0.3s ease',
                      boxShadow: '0 0 12px rgba(16,185,129,0.6)',
                      position: 'relative',
                    }}>
                      {/* Shimmer */}
                      <div style={{
                        position: 'absolute', inset: 0,
                        background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.25) 50%, transparent 100%)',
                        animation: 'shimmer 1.4s ease infinite',
                        backgroundSize: '200% 100%',
                      }} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.4rem' }}>
                    <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)' }}>
                      {formatBytes(stats.receivedBytes)} received
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)' }}>
                      {formatBytes(stats.totalBytes)} total
                    </span>
                  </div>
                </div>

                {/* Do not close warning */}
                <div style={{
                  display: 'flex', alignItems: 'flex-start', gap: '0.625rem',
                  background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)',
                  borderRadius: '0.75rem', padding: '0.75rem 1rem',
                }}>
                  <span><AlertTriangle size={18} /></span>
                  <p style={{ fontSize: '0.78rem', color: '#fbbf24', margin: 0, lineHeight: 1.5 }}>
                    Do not close this window or disconnect your internet while the transfer is in progress.
                  </p>
                </div>
              </div>
            )}

            {/* ──────────── DONE state ──────────── */}
            {status === 'done' && (
              <div style={{ textAlign: 'center' }}>
                {/* Celebration emoji */}
                <div style={{ marginBottom: '0.5rem', animation: 'celebrate 0.5s ease', display: 'flex', justifyContent: 'center' }}><CheckCircle size={64} className="text-emerald-500" /></div>
                <h2 style={{ color: '#10b981', fontWeight: 800, fontSize: '1.4rem', marginBottom: '0.4rem' }}>
                  All Files Received!
                </h2>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.875rem', marginBottom: '1.75rem' }}>
                  {receivedFiles.length} {receivedFiles.length === 1 ? 'file was' : 'files were'} downloaded to your device.
                </p>

                {/* File list */}
                {receivedFiles.length > 0 && (
                  <div style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '1rem', padding: '0.5rem',
                    maxHeight: '220px', overflowY: 'auto',
                    marginBottom: '1.5rem', textAlign: 'left',
                  }}>
                    {receivedFiles.map((file, idx) => (
                      <div key={idx} style={{
                        display: 'flex', alignItems: 'center', gap: '0.75rem',
                        padding: '0.625rem 0.75rem',
                        borderBottom: idx < receivedFiles.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                        borderRadius: '0.625rem',
                        transition: 'background 0.15s',
                      }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <span style={{ fontSize: '1.25rem', flexShrink: 0 }}>{getFileIcon(file.name)}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '0.85rem', color: 'white', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {file.name}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)' }}>
                            {formatBytes(file.size)}
                          </div>
                        </div>
                        <a
                          href={file.url}
                          download={file.name}
                          style={{
                            background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)',
                            borderRadius: '0.5rem', padding: '0.3rem 0.7rem',
                            color: '#10b981', fontSize: '0.75rem', fontWeight: 700,
                            textDecoration: 'none', flexShrink: 0, transition: 'all 0.2s',
                          }}
                        >
                          <div className="flex items-center gap-1"><Download size={14} /> Save</div>
                        </a>
                      </div>
                    ))}
                  </div>
                )}

                <button
                  onClick={() => {
                    setStatus('idle');
                    setReceivedFiles([]);
                    setManualLink('');
                    setStats({ progress: 0, currentFile: '', speed: 0, eta: 0, totalFiles: 0, receivedCount: 0, totalBytes: 0, receivedBytes: 0 });
                    signaling.stopPolling();
                    pcRef.current?.close();
                    pcRef.current = null;
                    initializedRef.current = false;
                  }}
                  style={{
                    width: '100%', padding: '0.875rem',
                    background: 'rgba(255,255,255,0.07)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: '0.875rem', color: 'white',
                    fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => e.target.style.background = 'rgba(255,255,255,0.11)'}
                  onMouseLeave={e => e.target.style.background = 'rgba(255,255,255,0.07)'}
                >
                  <div className="flex items-center justify-center gap-2"><Download size={20} /> Receive More Files</div>
                </button>
              </div>
            )}

            {/* ──────────── ERROR states ──────────── */}
            {(status === 'invalid' || status === 'full' || status === 'error' || status === 'expired') && (
              <div style={{ textAlign: 'center', padding: '0.5rem 0' }}>
                <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'center' }}>
                  {status === 'full' ? <Ban size={64} className="text-red-500" /> : status === 'expired' ? <Hourglass size={64} className="text-yellow-500" /> : <XCircle size={64} className="text-red-500" />}
                </div>
                <h2 style={{ color: 'white', fontWeight: 800, fontSize: '1.25rem', marginBottom: '0.5rem' }}>
                  {status === 'invalid' && 'Room Not Found'}
                  {status === 'full' && 'Room Full'}
                  {status === 'expired' && 'Session Expired'}
                  {status === 'error' && 'Connection Error'}
                </h2>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.875rem', marginBottom: '2rem', lineHeight: 1.6 }}>
                  {status === 'invalid' && 'This transfer session does not exist. The link may be wrong or the room was closed.'}
                  {status === 'full' && 'Another receiver is already connected to this room.'}
                  {status === 'expired' && 'The transfer link has expired. Ask the sender to create a new one.'}
                  {status === 'error' && 'Could not connect to the server. Check your internet and try again.'}
                </p>
                <button
                  onClick={() => { setStatus('idle'); setManualLink(''); initializedRef.current = false; }}
                  style={{
                    width: '100%', padding: '0.875rem',
                    background: 'linear-gradient(135deg, #10b981, #059669)',
                    border: 'none', borderRadius: '0.875rem',
                    color: 'white', fontSize: '0.9rem', fontWeight: 700,
                    cursor: 'pointer', transition: 'all 0.2s',
                  }}
                >
                  Try Again
                </button>
              </div>
            )}

          </div>{/* end card */}

          {/* Footer note */}
          <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.25)', fontSize: '0.75rem', marginTop: '1.5rem' }}>
            No login required · End-to-end P2P transfer · Files never touch our servers
          </p>
        </div>
      </main>

      <Footer />

      {/* Global keyframe animations */}
      <style>{`
        @keyframes spin       { to { transform: rotate(360deg); } }
        @keyframes shimmer    { 0%,100% { background-position: 200% center; } 50% { background-position: -200% center; } }
        @keyframes pulse-ring { 0% { transform: scale(0.8); opacity: 0.8; } 100% { transform: scale(1.5); opacity: 0; } }
        @keyframes blink      { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }
        @keyframes celebrate  { 0% { transform: scale(0.5) rotate(-10deg); } 60% { transform: scale(1.2) rotate(5deg); } 100% { transform: scale(1) rotate(0); } }
        @keyframes slideInRight { from { transform: translateX(120%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
      `}</style>
    </div>
  );
}
