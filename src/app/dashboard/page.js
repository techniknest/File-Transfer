'use client';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useSignaling } from '@/hooks/useSignaling';
import TransferModal from '../components/TransferModal';
import { showToast } from '../components/Toast';
import {
  Zap, Upload, Download, Folder, ArrowLeft, Plus,
  File, X, LinkIcon, Shield, CloudOff
} from 'lucide-react';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' },
  ],
};

const CHUNK_SIZE = 64 * 1024;

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(2)} MB`;
  return `${(bytes / 1073741824).toFixed(2)} GB`;
}

export default function Dashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [view, setView] = useState('home');
  const signaling = useSignaling();

  // Send state
  const [files, setFiles] = useState([]);
  const [roomId, setRoomId] = useState('');
  const [shareLink, setShareLink] = useState('');
  const [transferStatus, setTransferStatus] = useState('idle');
  const [progress, setProgress] = useState(0);
  const [speed, setSpeed] = useState(0);
  const [eta, setEta] = useState(0);
  const [currentFile, setCurrentFile] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Receive state
  const [receiveLink, setReceiveLink] = useState('');

  const pcRef = useRef(null);
  const filesRef = useRef([]);
  const roomIdRef = useRef('');

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
  }, [status, router]);

  const generateRoomId = () =>
    Math.random().toString(36).substring(2, 8).toUpperCase() +
    Math.random().toString(36).substring(2, 6).toUpperCase();

  const readChunk = (file, start, end) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsArrayBuffer(file.slice(start, end));
  });

  // ── STEP 1: User selects files — just update state, no link yet ──
  const handleFilesSelected = useCallback((selectedFiles) => {
    if (!selectedFiles || selectedFiles.length === 0) return;
    const newFiles = [...filesRef.current, ...Array.from(selectedFiles)];
    filesRef.current = newFiles;
    setFiles([...newFiles]);
  }, []);

  // ── STEP 2: User clicks "Generate Transfer Link" ──
  const handleGenerateLink = useCallback(async () => {
    if (filesRef.current.length === 0) return;
    if (roomIdRef.current) {
      // Already have a room — just open the modal again
      setModalOpen(true);
      return;
    }

    const id = generateRoomId();

    // ── Create the room in MongoDB FIRST — if this fails we abort ──
    signaling.off('receiver-joined');
    signaling.off('answer');
    signaling.off('ice-candidate');

    try {
      await signaling.createRoom(id);
    } catch (err) {
      console.error('Failed to create room:', err);
      // Show a user-visible error rather than a broken link
      alert(`Could not create transfer session: ${err.message}\n\nCheck that the server is running and try again.`);
      return;
    }

    // Only after the room is confirmed in DB, show the link
    setRoomId(id);
    roomIdRef.current = id;

    const link = `${window.location.origin}/receive?room=${id}`;
    setShareLink(link);
    setTransferStatus('waiting');
    setModalOpen(true);

    const pendingCandidates = [];

    signaling.on('receiver-joined', async () => {
      setTransferStatus('connecting');

      const pc = new RTCPeerConnection(ICE_SERVERS);
      pcRef.current = pc;
      const dc = pc.createDataChannel('fileTransfer', { ordered: true });

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          signaling.sendSignal('ice-candidate', { candidate: e.candidate });
        }
      };

      dc.onopen = async () => {
        setTransferStatus('transferring');

        const totalBytes = filesRef.current.reduce((a, f) => a + f.size, 0);
        let sentBytes = 0;
        let lastTime = Date.now();
        let lastBytes = 0;

        dc.send(JSON.stringify({
          type: 'session-info',
          totalFiles: filesRef.current.length,
          totalBytes,
        }));

        for (let f = 0; f < filesRef.current.length; f++) {
          const file = filesRef.current[f];
          const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
          setCurrentFile(file.name);

          dc.send(JSON.stringify({
            type: 'meta',
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type || 'application/octet-stream',
            totalChunks,
            fileIndex: f,
            totalFiles: filesRef.current.length,
          }));

          for (let i = 0; i < totalChunks; i++) {
            const start = i * CHUNK_SIZE;
            const end = Math.min(start + CHUNK_SIZE, file.size);
            const chunk = await readChunk(file, start, end);

            while (dc.bufferedAmount > 1024 * 1024) {
              await new Promise(r => setTimeout(r, 50));
            }

            dc.send(chunk);
            sentBytes += (end - start);

            const now = Date.now();
            const elapsed = (now - lastTime) / 1000;
            if (elapsed >= 0.25) {
              const delta = sentBytes - lastBytes;
              const spd = delta / elapsed;
              const remaining = totalBytes - sentBytes;
              const etaVal = spd > 0 ? remaining / spd : 0;
              lastTime = now;
              lastBytes = sentBytes;
              setProgress(Math.round((sentBytes / totalBytes) * 100));
              setSpeed(spd);
              setEta(etaVal);
            }
          }

          dc.send(JSON.stringify({ type: 'file-end', fileIndex: f }));
        }

        dc.send(JSON.stringify({ type: 'session-end' }));
        setTransferStatus('done');
        setProgress(100);

        try {
          await fetch('/api/transfers/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              roomId: id,
              senderEmail: session?.user?.email,
              files: filesRef.current.map(f => ({ fileName: f.name, fileSize: f.size, fileType: f.type })),
              totalSize: totalBytes,
            }),
          });
        } catch (_) {}
      };

      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await signaling.sendSignal('offer', { offer });
      } catch (err) {
        console.error('Error creating offer', err);
      }
    });

    signaling.on('answer', async (data) => {
      const answer = data?.answer;
      if (pcRef.current && answer) {
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(answer));
        for (const candidate of pendingCandidates) {
          try { await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate)); } catch (_) {}
        }
        pendingCandidates.length = 0;
      }
    });

    signaling.on('ice-candidate', async (data) => {
      const candidate = data?.candidate;
      if (pcRef.current && candidate) {
        if (pcRef.current.remoteDescription) {
          try { await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate)); } catch (_) {}
        } else {
          pendingCandidates.push(candidate);
        }
      }
    });
  }, [signaling, session]);

  const handleAddMoreFiles = useCallback((moreFiles) => {
    const newFiles = [...filesRef.current, ...Array.from(moreFiles)];
    filesRef.current = newFiles;
    setFiles([...newFiles]);
    if (showToast) showToast(`${moreFiles.length} file${moreFiles.length > 1 ? 's' : ''} added to transfer`, 'success');
  }, []);

  const removeFile = useCallback((idx) => {
    if (transferStatus !== 'idle') return;
    const updated = filesRef.current.filter((_, i) => i !== idx);
    filesRef.current = updated;
    setFiles([...updated]);
  }, [transferStatus]);

  const handleModalClose = useCallback(() => {
    setModalOpen(false);
    setTransferStatus('idle');
    setFiles([]);
    setRoomId('');
    setProgress(0);
    setShareLink('');
    setCurrentFile('');
    filesRef.current = [];
    roomIdRef.current = '';
    if (pcRef.current) { pcRef.current.close(); pcRef.current = null; }
    signaling.stopPolling();
  }, [signaling]);

  const handleGoBack = useCallback(() => {
    if (transferStatus === 'transferring') return; // block during transfer
    setView('home');
    if (transferStatus === 'idle') {
      setFiles([]);
      filesRef.current = [];
    }
  }, [transferStatus]);

  const startReceiver = useCallback(() => {
    let id;
    try {
      const url = new URL(receiveLink.trim());
      id = url.searchParams.get('room');
    } catch (_) {
      id = receiveLink.trim().toUpperCase();
    }
    if (!id) return;
    router.push(`/receive?room=${id}`);
  }, [receiveLink, router]);

  if (status === 'loading' || status === 'unauthenticated') return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
        <div style={{ width: '48px', height: '48px', border: '3px solid rgba(99,102,241,0.2)', borderTop: '3px solid #6366f1', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Loading dashboard…</span>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );


  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', display: 'flex', flexDirection: 'column' }}>
      {/* Navbar */}
      <nav style={{
        background: 'var(--bg-glass)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border-default)',
        padding: '1rem 1.5rem',
        position: 'sticky',
        top: 0,
        zIndex: 40
      }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', textDecoration: 'none' }}>
            <div className="gradient-brand" style={{ width: '36px', height: '36px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Zap className="text-white" size={18} />
            </div>
            <span style={{ fontWeight: 800, fontSize: '1.25rem', color: 'var(--text-primary)' }}>P2P Transfer</span>
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', display: 'none', '@media (minWidth: 600px)': { display: 'block' } }}>
              Welcome, <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{session?.user?.name}</span>
            </span>
            {session?.user?.role === 'admin' && (
              <Link href="/admin" className="btn btn-primary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}>
                Admin
              </Link>
            )}
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="btn btn-secondary"
              style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
            >
              Sign Out
            </button>
          </div>
        </div>
      </nav>

      <main style={{ flex: 1, maxWidth: '1000px', margin: '0 auto', width: '100%', padding: '2rem 1.5rem' }} className="page-enter">
        {/* ── HOME ── */}
        {view === 'home' && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
              <h1 style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: '0.75rem', background: 'linear-gradient(135deg, #60a5fa, #a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                Transfer Files
              </h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem' }}>P2P encrypted transfers. No cloud, no size limits.</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
              <button
                onClick={() => setView('send')}
                className="card card-hover"
                style={{ textAlign: 'left', padding: '2rem', background: 'var(--bg-glass)', border: '1px solid var(--border-default)', display: 'block', width: '100%', cursor: 'pointer' }}
              >
                <div className="gradient-brand" style={{ width: '56px', height: '56px', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem' }}>
                  <Upload className="text-white" size={28} />
                </div>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Send Files</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.5, marginBottom: '1.5rem' }}>Select your files, generate a secure transfer link, and share it with anyone.</p>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {['No size limit', 'Encrypted', 'Instant'].map(t => (
                    <span key={t} className="badge" style={{ background: 'rgba(99,102,241,0.1)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.2)' }}>{t}</span>
                  ))}
                </div>
              </button>

              <button
                onClick={() => setView('receive')}
                className="card card-hover"
                style={{ textAlign: 'left', padding: '2rem', background: 'var(--bg-glass)', border: '1px solid var(--border-default)', display: 'block', width: '100%', cursor: 'pointer' }}
              >
                <div style={{ width: '56px', height: '56px', borderRadius: '14px', background: 'linear-gradient(135deg, #10b981, #059669)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem' }}>
                  <Download className="text-white" size={28} />
                </div>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Receive Files</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.5, marginBottom: '1.5rem' }}>Paste a transfer link to receive files with live progress tracking.</p>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {['Auto-download', 'Live progress', 'P2P direct'].map(t => (
                    <span key={t} className="badge" style={{ background: 'rgba(16,185,129,0.1)', color: '#34d399', border: '1px solid rgba(16,185,129,0.2)' }}>{t}</span>
                  ))}
                </div>
              </button>
            </div>

            {/* Quick feature badges */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', justifyContent: 'center', marginTop: '3rem' }}>
              {[
                { icon: <Shield size={14} />, label: 'End-to-End Encrypted' },
                { icon: <CloudOff size={14} />, label: 'No Cloud Storage' },
                { icon: <Zap size={14} />, label: 'Full Speed Transfer' },
              ].map((b, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'var(--bg-glass)', border: '1px solid var(--border-default)', padding: '0.4rem 1rem', borderRadius: '999px', fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                  {b.icon} {b.label}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── SEND ── */}
        {view === 'send' && (
          <div className="animate-fade-up">
            <button
              onClick={handleGoBack}
              className="btn btn-ghost btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-secondary)', marginBottom: '1.5rem', padding: 0 }}
            >
              <ArrowLeft size={16} /> <span style={{ fontWeight: 600 }}>Back</span>
            </button>

            <div className="glass-card" style={{ padding: '2rem' }}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Send Files</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginBottom: '2rem' }}>
                Select all your files first, then generate a transfer link to share.
              </p>

              {/* Drop zone */}
              <div
                onClick={() => document.getElementById('dashFileInput').click()}
                onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={e => {
                  e.preventDefault();
                  setIsDragging(false);
                  const dropped = [...e.dataTransfer.files];
                  if (dropped.length) handleFilesSelected(dropped);
                }}
                style={{
                  border: isDragging ? '2px dashed #818cf8' : '2px dashed var(--border-default)',
                  background: isDragging ? 'rgba(99,102,241,0.05)' : 'var(--bg-glass)',
                  borderRadius: '1rem',
                  padding: '3rem 1.5rem',
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  marginBottom: '2rem'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
                  <Folder size={48} style={{ color: '#818cf8' }} />
                </div>
                <p style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '1.1rem', marginBottom: '0.5rem' }}>
                  {isDragging ? 'Drop files here' : 'Click to select or drag & drop'}
                </p>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Any file type · No size limit · Select multiple</p>
                <input
                  id="dashFileInput"
                  type="file"
                  multiple
                  style={{ display: 'none' }}
                  onChange={e => { if (e.target.files?.length) handleFilesSelected([...e.target.files]); e.target.value = ''; }}
                />
              </div>

              {/* File list */}
              {files.length > 0 && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.05em' }}>
                      {files.length} FILE{files.length !== 1 ? 'S' : ''} SELECTED — {formatBytes(files.reduce((a, f) => a + f.size, 0))}
                    </p>
                    <button
                      onClick={() => document.getElementById('dashAddMoreInput').click()}
                      style={{ background: 'transparent', border: 'none', color: '#818cf8', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer' }}
                    >
                      <Plus size={14} /> Add More
                    </button>
                    <input
                      id="dashAddMoreInput"
                      type="file"
                      multiple
                      style={{ display: 'none' }}
                      onChange={e => { if (e.target.files?.length) handleFilesSelected([...e.target.files]); e.target.value = ''; }}
                    />
                  </div>
                  
                  <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '2rem' }}>
                    {files.map((f, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'var(--bg-glass)', padding: '0.75rem 1rem', borderRadius: '0.75rem', border: '1px solid var(--border-default)' }}>
                        <File size={18} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                        <span style={{ color: 'var(--text-primary)', fontSize: '0.9rem', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', flexShrink: 0 }}>{formatBytes(f.size)}</span>
                        {transferStatus === 'idle' && !roomIdRef.current && (
                          <button onClick={() => removeFile(i)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', flexShrink: 0 }}>
                            <X size={16} className="hover-danger" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={handleGenerateLink}
                    className="btn btn-primary"
                    style={{ width: '100%', padding: '1rem', fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                  >
                    <LinkIcon size={20} />
                    {roomIdRef.current ? 'View Transfer Link' : 'Generate Transfer Link'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── RECEIVE ── */}
        {view === 'receive' && (
          <div className="animate-fade-up">
            <button
              onClick={() => setView('home')}
              className="btn btn-ghost btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-secondary)', marginBottom: '1.5rem', padding: 0 }}
            >
              <ArrowLeft size={16} /> <span style={{ fontWeight: 600 }}>Back</span>
            </button>
            <div className="glass-card" style={{ padding: '2rem' }}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Receive Files</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginBottom: '2rem' }}>Paste a transfer link to receive files directly from the sender.</p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.6rem' }}>Transfer Link</label>
                  <input
                    type="text"
                    placeholder="https://…/receive?room=XXXXXX or room code"
                    value={receiveLink}
                    onChange={e => setReceiveLink(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && receiveLink.trim()) startReceiver(); }}
                    className="input"
                    style={{ width: '100%', padding: '1rem', fontSize: '1rem' }}
                  />
                </div>
                <button
                  onClick={startReceiver}
                  disabled={!receiveLink.trim()}
                  className="btn btn-primary"
                  style={{ width: '100%', padding: '1rem', fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', background: !receiveLink.trim() ? 'var(--border-default)' : 'linear-gradient(135deg, #10b981, #059669)', border: 'none' }}
                >
                  <Download size={20} /> Start Receiving
                </button>
                <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>No login required to receive files</p>
              </div>
            </div>
          </div>
        )}
      </main>

      <TransferModal
        isOpen={modalOpen}
        onClose={handleModalClose}
        files={files}
        shareLink={shareLink}
        roomId={roomId}
        status={transferStatus}
        progress={progress}
        speed={speed}
        eta={eta}
        currentFile={currentFile}
        onAddFiles={handleAddMoreFiles}
      />
    </div>
  );
}