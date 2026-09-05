'use client';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useSignaling } from '@/hooks/useSignaling';
import { useWebRTC } from '@/hooks/useWebRTC';
import TransferModal from '../components/TransferModal';
import { showToast } from '../components/Toast';
import {
  Zap, Upload, Download, Folder, ArrowLeft, Plus,
  File, FileText, X, LinkIcon, Shield, CloudOff, History, Clock,
  CheckCircle, Search, ArrowUpRight, ArrowDownLeft, RefreshCw,
  Globe, Laptop, Smartphone, Monitor, Compass, AlertCircle, HardDrive, User
} from 'lucide-react';
import { logEvent } from '@/lib/logger';

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
  const [view, setView] = useState('home'); // home | send | receive | history
  const signaling = useSignaling();
  const { createOfferWithIce, setAnswer, addCandidate, sendFiles, close: closeWebRTC } = useWebRTC();

  // Send state
  const [files, setFiles] = useState([]);
  const [roomId, setRoomId] = useState('');
  const [shareLink, setShareLink] = useState('');
  const [transferStatus, setTransferStatus] = useState('idle'); // idle | waiting | connecting | transferring | done
  const [progress, setProgress] = useState(0);
  const [speed, setSpeed] = useState(0);
  const [eta, setEta] = useState(0);
  const [currentFile, setCurrentFile] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [incomingRequest, setIncomingRequest] = useState(null);
  const [resumePromptOpen, setResumePromptOpen] = useState(false);

  // Receive state
  const [receiveLink, setReceiveLink] = useState('');

  // Transfer History state
  const [historyRecords, setHistoryRecords] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyTab, setHistoryTab] = useState('all'); // all | sent | received
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotalPages, setHistoryTotalPages] = useState(1);
  const [historySearch, setHistorySearch] = useState('');

  // Active/interrupted session persistence state
  const [savedSession, setSavedSession] = useState(null);

  const filesRef = useRef([]);
  const roomIdRef = useRef('');
  const activeDcRef = useRef(null);
  const isCancelledRef = useRef(false);
  const resumeOffsetsRef = useRef({});
  const receiverEmailRef = useRef('anonymous');
  const resumeFileInputRef = useRef(null);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
  }, [status, router]);

  // Check for interrupted/active sender session on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('p2p_active_sender_session');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.roomId && Date.now() - (parsed.timestamp || 0) < 24 * 60 * 60 * 1000) {
          setSavedSession(parsed);
          setRoomId(parsed.roomId);
          roomIdRef.current = parsed.roomId;
          setShareLink(parsed.shareLink || `${window.location.origin}/receive?room=${parsed.roomId}`);
        }
      }
    } catch (_) {}
  }, []);

  // Warn sender before refreshing if transfer is active
  useEffect(() => {
    if (transferStatus === 'transferring' || transferStatus === 'connecting' || transferStatus === 'waiting') {
      const handler = (e) => {
        e.preventDefault();
        e.returnValue = 'Transfer session in progress! Refreshing will disconnect the active transfer.';
        return e.returnValue;
      };
      window.addEventListener('beforeunload', handler);
      return () => window.removeEventListener('beforeunload', handler);
    }
  }, [transferStatus]);

  const fetchHistory = useCallback(async (tab = historyTab, page = historyPage) => {
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/transfers?type=${tab}&page=${page}&limit=10`);
      if (res.ok) {
        const data = await res.json();
        setHistoryRecords(data.records || []);
        setHistoryTotalPages(data.pages || 1);
      }
    } catch (err) {
      console.warn('[History] Failed to fetch user transfer history:', err);
    } finally {
      setHistoryLoading(false);
    }
  }, [historyTab, historyPage]);

  useEffect(() => {
    if (view === 'history' && status === 'authenticated') {
      fetchHistory(historyTab, historyPage);
    }
  }, [view, historyTab, historyPage, status, fetchHistory]);

  const generateRoomId = () =>
    Math.random().toString(36).substring(2, 8).toUpperCase() +
    Math.random().toString(36).substring(2, 6).toUpperCase();

  // ── File Selection ──
  const handleFilesSelected = useCallback((selectedFiles) => {
    if (!selectedFiles || selectedFiles.length === 0) return;
    const newFiles = [...filesRef.current, ...Array.from(selectedFiles)];
    filesRef.current = newFiles;
    setFiles([...newFiles]);

    const totalBytes = newFiles.reduce((a, f) => a + f.size, 0);
    logEvent({
      eventType: 'file_selected',
      level: 'info',
      category: 'file',
      message: `Sender selected ${newFiles.length} file(s) (${formatBytes(totalBytes)})`,
      userEmail: session?.user?.email,
      metadata: {
        fileCount: newFiles.length,
        totalBytes,
        fileNames: newFiles.map((f) => f.name),
      },
    });
  }, [session]);

  // ── Discard saved session ──
  const discardSavedSession = useCallback(async () => {
    if (savedSession?.roomId) {
      try {
        await fetch('/api/transfers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roomId: savedSession.roomId,
            status: 'cancelled',
          }),
        });
      } catch (_) {}
    }
    localStorage.removeItem('p2p_active_sender_session');
    setSavedSession(null);
    showToast('Previous session cleared', 'info');
  }, [savedSession]);

  // ── STEP 2: Generate Transfer Link & Start Handshake ──
  const handleGenerateLink = useCallback(async (existingRoomId = null, existingFiles = null) => {
    const activeFiles = existingFiles || filesRef.current;
    if (activeFiles.length === 0) return;

    const id = existingRoomId || roomIdRef.current || (savedSession?.roomId) || generateRoomId();
    isCancelledRef.current = false;
    const totalBytes = activeFiles.reduce((a, f) => a + f.size, 0);
    const link = `${window.location.origin}/receive?room=${id}`;

    // Persist session to local storage for recovery across refreshes
    try {
      localStorage.setItem('p2p_active_sender_session', JSON.stringify({
        roomId: id,
        fileMeta: activeFiles.map(f => ({ name: f.name, size: f.size, type: f.type })),
        totalSize: totalBytes,
        shareLink: link,
        timestamp: Date.now(),
      }));
    } catch (_) {}

    // Immediately log in-progress transfer to MongoDB so history shows it
    try {
      await fetch('/api/transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: id,
          senderEmail: session?.user?.email || 'anonymous',
          receiverEmail: receiverEmailRef.current || 'anonymous',
          files: activeFiles.map((f) => ({
            fileName: f.name,
            fileSize: f.size,
            fileType: f.type,
          })),
          totalSize: totalBytes,
          progress: 0,
          status: 'in-progress',
        }),
      });
    } catch (_) {}

    logEvent({
      eventType: 'room_created',
      level: 'info',
      category: 'room',
      roomId: id,
      message: `Transfer room created: ${id} with ${activeFiles.length} file(s) (${formatBytes(totalBytes)})`,
      userEmail: session?.user?.email,
      metadata: {
        fileCount: activeFiles.length,
        totalBytes,
        fileNames: activeFiles.map((f) => f.name),
      },
    });

    signaling.off('receiver-joined');
    signaling.off('transfer-request');
    signaling.off('transfer-resume');
    signaling.off('answer');
    signaling.off('ice-candidate');

    let offerCreated = false;

    const startOfferGeneration = async () => {
      if (offerCreated) {
        console.log('[Sender] Offer already generated for room, ignoring duplicate initiation');
        return;
      }
      offerCreated = true;
      console.log('[Sender] Permission granted — generating SDP Offer');
      setTransferStatus('connecting');

      logEvent({
        eventType: 'receiver_joined_detected',
        level: 'info',
        category: 'webrtc',
        roomId: id,
        message: `Sender generating SDP offer for room ${id}...`,
        userEmail: session?.user?.email,
      });

      try {
        const { offer, dc } = await createOfferWithIce({
          onConnectionStateChange: (state) => {
            console.log('[Sender] WebRTC Connection State:', state);
            logEvent({
              eventType: 'webrtc_sender_state_change',
              level: state === 'connected' ? 'success' : state === 'failed' ? 'error' : 'info',
              category: 'webrtc',
              roomId: id,
              message: `Sender WebRTC connection state changed to: ${state}`,
              userEmail: session?.user?.email,
              metadata: { state },
            });
            if (state === 'connected') {
              console.log('[Sender] Direct P2P tunnel established!');
            } else if (state === 'disconnected' || state === 'failed') {
              // Update MongoDB record status to interrupted
              fetch('/api/transfers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ roomId: id, status: 'interrupted' }),
              }).catch(() => {});
            }
          },
          onIceCandidate: async (candidate) => {
            try {
              await signaling.sendSignal('ice-candidate', { candidate, from: 'sender' });
            } catch (_) {}
          },
        });

        signaling.on('ice-candidate', async (data) => {
          if (data?.from !== 'receiver') return;
          await addCandidate(data.candidate);
        });

        activeDcRef.current = dc;

        dc.onerror = (error) => {
          console.error('[DATA] Error on Sender DataChannel:', error);
        };

        dc.onclose = () => {
          console.log('[DATA] Channel closed on Sender');
        };

        dc.onopen = async () => {
          console.log('[DATA] Channel Open — stopping signaling polling and commencing transfer');
          signaling.stopPolling();
          setTransferStatus('transferring');

          logEvent({
            eventType: 'transfer_started',
            level: 'success',
            category: 'transfer',
            roomId: id,
            message: `DataChannel open. Starting P2P file transmission for room ${id}`,
            userEmail: session?.user?.email,
            metadata: { fileCount: filesRef.current.length, totalBytes },
          });

          await sendFiles(filesRef.current, dc, {
            onFileStart: (fileName, isResume) => {
              setCurrentFile(fileName);
              if (isResume) showToast(`Resuming ${fileName}...`, 'info');
            },
            onProgress: (p) => {
              setProgress(p);
            },
            onSpeed: (spd, etaVal) => {
              setSpeed(spd);
              setEta(etaVal);
            },
            resumeOffsets: resumeOffsetsRef.current || {},
            onComplete: async () => {
              setTransferStatus('done');
              setProgress(100);
              signaling.stopPolling();
              localStorage.removeItem('p2p_active_sender_session');
              setSavedSession(null);

              logEvent({
                eventType: 'transfer_completed',
                level: 'success',
                category: 'transfer',
                roomId: id,
                message: `P2P transfer completed successfully for room ${id} (${formatBytes(totalBytes)})`,
                userEmail: session?.user?.email,
                metadata: { totalBytes, fileCount: filesRef.current.length },
              });

              try {
                await fetch('/api/transfers', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    roomId: id,
                    senderEmail: session?.user?.email,
                    receiverEmail: receiverEmailRef.current || 'anonymous',
                    files: filesRef.current.map((f) => ({
                      fileName: f.name,
                      fileSize: f.size,
                      fileType: f.type,
                    })),
                    totalSize: totalBytes,
                    progress: 100,
                    status: 'completed',
                  }),
                });
              } catch (_) {}
            },
            isCancelled: () => isCancelledRef.current,
          });
        };

        await signaling.sendSignal('offer', { offer });
        console.log('[Sender] SDP Offer sent');
      } catch (err) {
        console.error('[Sender] Failed to create offer:', err);
        setTransferStatus('waiting');
      }
    };

    signaling.on('transfer-resume', (resumeData) => {
      console.log('[Sender] Received transfer resume request:', resumeData);
      if (resumeData?.resumeOffsets) {
        resumeOffsetsRef.current = resumeData.resumeOffsets;
        showToast('Receiver requested partial resume', 'info');
      }
    });

    signaling.on('transfer-request', (reqData) => {
      console.log('[Sender] Incoming transfer request received:', reqData);
      if (reqData?.receiverEmail) {
        receiverEmailRef.current = reqData.receiverEmail;
      }
      if (reqData?.resumeOffsets) {
        resumeOffsetsRef.current = reqData.resumeOffsets;
      }
      const clientDetails = reqData?.clientDetails || {
        ip: reqData?.ip || '127.0.0.1',
        deviceType: reqData?.deviceType || 'Laptop / Desktop',
        browser: reqData?.browser || 'Web Browser',
        os: reqData?.os || 'Unknown OS',
        userAgent: reqData?.device || '',
        formattedTime: reqData?.formattedTime || new Date().toLocaleTimeString(),
      };

      setIncomingRequest({
        roomId: id,
        clientInfo: {
          ...reqData,
          ...clientDetails,
          receiverEmail: reqData?.receiverEmail || 'anonymous',
        },
        onAllow: async () => {
          setIncomingRequest(null);
          await signaling.sendSignal('transfer-allow', { approved: true, roomId: id });
          try {
            await fetch('/api/transfers', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                roomId: id,
                receiverEmail: reqData?.receiverEmail || 'anonymous',
                receiverDetails: clientDetails,
              }),
            });
          } catch (_) {}
          startOfferGeneration();
        },
        onDecline: async () => {
          setIncomingRequest(null);
          await signaling.sendSignal('transfer-decline', { approved: false, roomId: id, reason: 'Sender declined the request' });
          showToast('Transfer request declined', 'info');
        },
      });
    });

    signaling.on('receiver-joined', (joinData) => {
      const clientDetails = joinData?.clientDetails || {
        ip: joinData?.ip || '127.0.0.1',
        deviceType: joinData?.deviceType || 'Laptop / Desktop',
        browser: joinData?.browser || 'Web Browser',
        os: joinData?.os || 'Unknown OS',
        userAgent: joinData?.device || '',
        formattedTime: joinData?.formattedTime || new Date().toLocaleTimeString(),
      };

      setIncomingRequest((prev) => {
        if (prev) return prev;
        return {
          roomId: id,
          clientInfo: {
            ...joinData,
            ...clientDetails,
            receiverEmail: joinData?.receiverEmail || 'anonymous',
          },
          onAllow: async () => {
            setIncomingRequest(null);
            await signaling.sendSignal('transfer-allow', { approved: true, roomId: id });
            try {
              await fetch('/api/transfers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  roomId: id,
                  receiverEmail: joinData?.receiverEmail || 'anonymous',
                  receiverDetails: clientDetails,
                }),
              });
            } catch (_) {}
            startOfferGeneration();
          },
          onDecline: async () => {
            setIncomingRequest(null);
            await signaling.sendSignal('transfer-decline', { approved: false, roomId: id, reason: 'Sender declined the request' });
            showToast('Transfer request declined', 'info');
          },
        };
      });
    });

    signaling.on('answer', async (data) => {
      const answer = data?.answer;
      if (!answer) return;
      console.log('[Sender] Answer received — applying remote description');
      try {
        await setAnswer(answer);
      } catch (err) {
        console.error('[Sender] setAnswer failed:', err);
      }
    });

    try {
      await signaling.createRoom(id, {
        files: activeFiles.map((f) => ({
          fileName: f.name,
          fileSize: f.size,
          fileType: f.type || 'application/octet-stream',
        })),
        totalSize: totalBytes,
        fileCount: activeFiles.length,
      });
      signaling.startPolling(id, true);
      // Announce sender ready so receiver can immediately reconnect and resume
      await signaling.sendSignal('sender-ready', { roomId: id, fileCount: activeFiles.length, totalBytes });
    } catch (err) {
      console.error('[Sender] Failed to create room:', err);
      signaling.off('receiver-joined');
      signaling.off('answer');
      alert(`Could not create transfer session: ${err.message}`);
      return;
    }

    setRoomId(id);
    roomIdRef.current = id;
    setShareLink(link);
    setTransferStatus('waiting');
    setModalOpen(true);
  }, [signaling, createOfferWithIce, setAnswer, addCandidate, sendFiles, session]);

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
    isCancelledRef.current = true;
    setModalOpen(false);
    setTransferStatus('idle');
    setFiles([]);
    setRoomId('');
    setProgress(0);
    setShareLink('');
    setCurrentFile('');
    filesRef.current = [];
    roomIdRef.current = '';
    closeWebRTC();
    signaling.stopPolling();
  }, [signaling, closeWebRTC]);

  const handleGoBack = useCallback(() => {
    if (transferStatus === 'transferring') return;
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

  const handleResumeWithFiles = useCallback((candidateFiles) => {
    if (!savedSession || !candidateFiles || candidateFiles.length === 0) return;

    const expected = savedSession.fileMeta || [];
    if (expected.length === 0) {
      setResumePromptOpen(false);
      filesRef.current = candidateFiles;
      setFiles(candidateFiles);
      handleGenerateLink(savedSession.roomId, candidateFiles);
      return;
    }

    // Match candidate files to original session's file index order
    const ordered = [];
    const missing = [];

    for (let i = 0; i < expected.length; i++) {
      const exp = expected[i];
      const match = candidateFiles.find(
        (f) => f.name === exp.name && (exp.size === 0 || Math.abs(f.size - exp.size) < 1024 * 1024)
      );
      if (match) {
        ordered.push(match);
      } else {
        missing.push(exp.name);
      }
    }

    if (missing.length > 0) {
      showToast(`Missing original file(s): ${missing.join(', ')}. Please re-select the original files.`, 'error', 6000);
      return;
    }

    setResumePromptOpen(false);
    filesRef.current = ordered;
    setFiles(ordered);
    showToast(`Files verified! Resuming transfer for room ${savedSession.roomId}...`, 'success', 4000);
    handleGenerateLink(savedSession.roomId, ordered);
  }, [savedSession, handleGenerateLink]);

  const filteredHistory = historyRecords.filter((r) => {
    if (!historySearch.trim()) return true;
    const q = historySearch.toLowerCase();
    return (
      r.roomId?.toLowerCase().includes(q) ||
      r.senderEmail?.toLowerCase().includes(q) ||
      r.receiverEmail?.toLowerCase().includes(q) ||
      r.fileNames?.some((f) => f.toLowerCase().includes(q))
    );
  });

  if (status === 'loading' || status === 'unauthenticated') {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-base)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: '48px', height: '48px', border: '3px solid rgba(99,102,241,0.2)', borderTop: '3px solid #6366f1', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Loading dashboard…</span>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

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
        zIndex: 40,
      }}>
        <div style={{ maxWidth: '1050px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
            <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', textDecoration: 'none' }}>
              <div className="gradient-brand" style={{ width: '36px', height: '36px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Zap className="text-white" size={18} />
              </div>
              <span style={{ fontWeight: 800, fontSize: '1.25rem', color: 'var(--text-primary)' }}>P2P Transfer</span>
            </Link>

            <button
              onClick={() => setView('history')}
              style={{
                background: view === 'history' ? 'rgba(99,102,241,0.15)' : 'transparent',
                border: view === 'history' ? '1px solid rgba(99,102,241,0.3)' : 'none',
                color: view === 'history' ? '#818cf8' : 'var(--text-secondary)',
                borderRadius: '0.5rem',
                padding: '0.35rem 0.75rem',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              <History size={16} /> Transfer History
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
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

      <main style={{ flex: 1, maxWidth: '1050px', margin: '0 auto', width: '100%', padding: '2rem 1.5rem' }} className="page-enter">
        {/* ── HOME ── */}
        {view === 'home' && (
          <div>
            {/* ── INTERRUPTED / ACTIVE SESSION RECOVERY CARD ── */}
            {savedSession && (
              <div style={{
                background: 'linear-gradient(135deg, rgba(245,158,11,0.12), rgba(99,102,241,0.12))',
                border: '1px solid rgba(245,158,11,0.4)',
                borderRadius: '1.25rem',
                padding: '1.5rem 1.75rem',
                marginBottom: '2.5rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '1rem',
                boxShadow: '0 8px 32px rgba(245,158,11,0.15)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1, minWidth: '280px' }}>
                  <div style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '12px',
                    background: 'rgba(245,158,11,0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#f59e0b',
                    flexShrink: 0,
                  }}>
                    <RefreshCw size={24} />
                  </div>
                  <div>
                    <h4 style={{ color: 'white', fontWeight: 800, fontSize: '1.1rem', margin: '0 0 0.25rem' }}>
                      Active Transfer Session Found (Room: <span style={{ color: '#f59e0b', fontFamily: 'monospace' }}>{savedSession.roomId}</span>)
                    </h4>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0 }}>
                      Files: {savedSession.fileMeta?.map(f => f.name).join(', ') || 'Selected files'} ({formatBytes(savedSession.totalSize)})
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <button
                    onClick={discardSavedSession}
                    className="btn btn-ghost btn-sm"
                    style={{ color: 'var(--text-muted)', border: '1px solid var(--border-default)', padding: '0.5rem 1rem', borderRadius: '0.5rem', fontSize: '0.85rem', fontWeight: 600 }}
                  >
                    Discard
                  </button>
                  <button
                    onClick={() => {
                      if (filesRef.current && filesRef.current.length > 0) {
                        handleGenerateLink(savedSession.roomId, filesRef.current);
                      } else {
                        setResumePromptOpen(true);
                      }
                    }}
                    className="btn btn-primary btn-sm"
                    style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', border: 'none', padding: '0.5rem 1.25rem', borderRadius: '0.5rem', fontSize: '0.85rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                  >
                    <RefreshCw size={16} /> Resume Session
                  </button>
                </div>
              </div>
            )}

            <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
              <h1 style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: '0.75rem', background: 'linear-gradient(135deg, #60a5fa, #a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                Transfer Files
              </h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem' }}>P2P encrypted transfers. Stream gigabytes with zero cloud storage.</p>
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
                  {['No size limit', 'Stream to disk', 'Instant P2P'].map((t) => (
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
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.5, marginBottom: '1.5rem' }}>Paste a transfer link to receive files directly with live progress tracking.</p>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {['Auto-download', 'Resume support', 'P2P direct'].map((t) => (
                    <span key={t} className="badge" style={{ background: 'rgba(16,185,129,0.1)', color: '#34d399', border: '1px solid rgba(16,185,129,0.2)' }}>{t}</span>
                  ))}
                </div>
              </button>

              <button
                onClick={() => setView('history')}
                className="card card-hover"
                style={{ textAlign: 'left', padding: '2rem', background: 'var(--bg-glass)', border: '1px solid var(--border-default)', display: 'block', width: '100%', cursor: 'pointer' }}
              >
                <div style={{ width: '56px', height: '56px', borderRadius: '14px', background: 'linear-gradient(135deg, #f59e0b, #d97706)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem' }}>
                  <History className="text-white" size={28} />
                </div>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Transfer History</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.5, marginBottom: '1.5rem' }}>View logs of sent and received files, recipients, file sizes, and dates.</p>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {['Sent & Received', 'Account records', 'Full stats'].map((t) => (
                    <span key={t} className="badge" style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.2)' }}>{t}</span>
                  ))}
                </div>
              </button>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', justifyContent: 'center', marginTop: '3rem' }}>
              {[
                { icon: <Shield size={14} />, label: 'End-to-End Encrypted' },
                { icon: <CloudOff size={14} />, label: 'No Cloud Storage' },
                { icon: <Zap size={14} />, label: 'Full Speed Streaming' },
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
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
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
                  marginBottom: '2rem',
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
                  onChange={(e) => { if (e.target.files?.length) handleFilesSelected([...e.target.files]); e.target.value = ''; }}
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
                      onChange={(e) => { if (e.target.files?.length) handleFilesSelected([...e.target.files]); e.target.value = ''; }}
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
                    onClick={() => handleGenerateLink()}
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
                    onChange={(e) => setReceiveLink(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && receiveLink.trim()) startReceiver(); }}
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
              </div>
            </div>
          </div>
        )}

        {/* ── TRANSFER HISTORY ── */}
        {view === 'history' && (
          <div className="animate-fade-up">
            <button
              onClick={() => setView('home')}
              className="btn btn-ghost btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-secondary)', marginBottom: '1.5rem', padding: 0 }}
            >
              <ArrowLeft size={16} /> <span style={{ fontWeight: 600 }}>Back to Dashboard</span>
            </button>

            <div className="glass-card" style={{ padding: '2rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <History size={24} color="#f59e0b" /> Transfer History
                  </h2>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.25rem', margin: 0 }}>
                    Detailed log of all your sent and received file transfers.
                  </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ position: 'relative', minWidth: '220px' }}>
                    <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input
                      type="text"
                      placeholder="Search files or room..."
                      value={historySearch}
                      onChange={(e) => setHistorySearch(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.45rem 0.75rem 0.45rem 2.2rem',
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid var(--border-default)',
                        borderRadius: '0.5rem',
                        color: 'white',
                        fontSize: '0.85rem',
                        outline: 'none',
                      }}
                    />
                  </div>

                  <button
                    onClick={() => fetchHistory(historyTab, historyPage)}
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid var(--border-default)',
                      borderRadius: '0.5rem',
                      padding: '0.5rem',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                    }}
                    title="Refresh records"
                  >
                    <RefreshCw size={16} className={historyLoading ? 'animate-spin' : ''} />
                  </button>
                </div>
              </div>

              {/* Sub tabs */}
              <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border-default)', paddingBottom: '0.75rem', marginBottom: '1.5rem' }}>
                {[
                  { id: 'all', label: 'All Transfers' },
                  { id: 'sent', label: 'Sent by Me' },
                  { id: 'received', label: 'Received by Me' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => { setHistoryTab(tab.id); setHistoryPage(1); }}
                    style={{
                      background: historyTab === tab.id ? 'rgba(99,102,241,0.15)' : 'transparent',
                      border: historyTab === tab.id ? '1px solid rgba(99,102,241,0.3)' : '1px solid transparent',
                      color: historyTab === tab.id ? '#818cf8' : 'var(--text-secondary)',
                      borderRadius: '0.5rem',
                      padding: '0.4rem 1rem',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Records Table */}
              {historyLoading ? (
                <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-secondary)' }}>
                  <div style={{ width: '36px', height: '36px', border: '3px solid rgba(99,102,241,0.2)', borderTop: '3px solid #6366f1', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 1rem' }} />
                  Loading your transfer history…
                </div>
              ) : filteredHistory.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-secondary)' }}>
                  <History size={48} style={{ opacity: 0.3, margin: '0 auto 1rem' }} />
                  <p style={{ fontWeight: 600, margin: 0 }}>No transfers found</p>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                    {historyTab === 'sent' ? 'You have not sent any files yet.' : historyTab === 'received' ? 'You have not received any files yet.' : 'Start a file transfer to see your history here.'}
                  </p>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-default)', color: 'var(--text-muted)' }}>
                        <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Type</th>
                        <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Room Code</th>
                        <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Files</th>
                        <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Size</th>
                        <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Counterparty</th>
                        <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Date</th>
                        <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredHistory.map((rec, idx) => {
                        const isSent = rec.senderEmail?.toLowerCase() === session?.user?.email?.toLowerCase();
                        const statusColor = rec.status === 'completed'
                          ? '#10b981'
                          : rec.status === 'in-progress'
                          ? '#60a5fa'
                          : rec.status === 'interrupted'
                          ? '#f59e0b'
                          : '#ef4444';

                        const statusLabel = rec.status === 'completed'
                          ? 'Completed'
                          : rec.status === 'in-progress'
                          ? `In Progress (${rec.progress || 0}%)`
                          : rec.status === 'interrupted'
                          ? 'Interrupted'
                          : 'Cancelled';

                        return (
                          <tr key={rec._id || idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.2s' }}>
                            <td style={{ padding: '0.9rem 1rem' }}>
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.3rem',
                                padding: '0.25rem 0.6rem',
                                borderRadius: '999px',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                background: isSent ? 'rgba(99,102,241,0.12)' : 'rgba(16,185,129,0.12)',
                                color: isSent ? '#818cf8' : '#34d399',
                                border: `1px solid ${isSent ? 'rgba(99,102,241,0.25)' : 'rgba(16,185,129,0.25)'}`,
                              }}>
                                {isSent ? <ArrowUpRight size={12} /> : <ArrowDownLeft size={12} />}
                                {isSent ? 'Sent' : 'Received'}
                              </span>
                            </td>
                            <td style={{ padding: '0.9rem 1rem', fontFamily: 'monospace', fontWeight: 700, color: 'white' }}>
                              {rec.roomId}
                            </td>
                            <td style={{ padding: '0.9rem 1rem', maxWidth: '240px' }}>
                              <div style={{ fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {rec.fileNames?.[0] || 'File transfer'}
                              </div>
                              {rec.fileCount > 1 && (
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                  +{rec.fileCount - 1} other file(s)
                                </div>
                              )}
                            </td>
                            <td style={{ padding: '0.9rem 1rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                              {formatBytes(rec.totalSize)}
                            </td>
                            <td style={{ padding: '0.9rem 1rem', color: 'var(--text-secondary)' }}>
                              {isSent ? (rec.receiverEmail && rec.receiverEmail !== 'anonymous' ? rec.receiverEmail : 'Anonymous Peer') : rec.senderEmail}
                            </td>
                            <td style={{ padding: '0.9rem 1rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                              {rec.createdAt ? new Date(rec.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                            </td>
                            <td style={{ padding: '0.9rem 1rem' }}>
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.3rem',
                                color: statusColor,
                                fontSize: '0.75rem',
                                fontWeight: 600,
                              }}>
                                {rec.status === 'completed' ? <CheckCircle size={14} /> : <Clock size={14} />}
                                {statusLabel}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  {/* Pagination */}
                  {historyTotalPages > 1 && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.5rem' }}>
                      <button
                        onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                        disabled={historyPage === 1}
                        style={{ padding: '0.4rem 0.8rem', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-default)', borderRadius: '0.5rem', color: 'white', cursor: historyPage === 1 ? 'not-allowed' : 'pointer', opacity: historyPage === 1 ? 0.4 : 1 }}
                      >
                        Prev
                      </button>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', display: 'flex', alignItems: 'center' }}>
                        Page {historyPage} of {historyTotalPages}
                      </span>
                      <button
                        onClick={() => setHistoryPage((p) => Math.min(historyTotalPages, p + 1))}
                        disabled={historyPage >= historyTotalPages}
                        style={{ padding: '0.4rem 0.8rem', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-default)', borderRadius: '0.5rem', color: 'white', cursor: historyPage >= historyTotalPages ? 'not-allowed' : 'pointer', opacity: historyPage >= historyTotalPages ? 0.4 : 1 }}
                      >
                        Next
                      </button>
                    </div>
                  )}
                </div>
              )}
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
        isResumed={Object.keys(resumeOffsetsRef.current || {}).length > 0}
      />

      {/* ── HIDDEN RESUME FILE INPUT ── */}
      <input
        type="file"
        ref={resumeFileInputRef}
        multiple
        style={{ display: 'none' }}
        onChange={(e) => {
          const selected = Array.from(e.target.files || []);
          if (selected.length === 0) return;
          handleResumeWithFiles(selected);
        }}
      />

      {/* ── RESUME TRANSFER SESSION PROMPT MODAL ── */}
      {resumePromptOpen && savedSession && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 99999,
          background: 'rgba(0,0,0,0.8)',
          backdropFilter: 'blur(12px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.5rem',
          animation: 'fadeIn 0.2s ease',
        }}>
          <div style={{
            background: 'var(--bg-elevated)',
            border: '1px solid rgba(245,158,11,0.5)',
            borderRadius: '1.5rem',
            width: '100%',
            maxWidth: '520px',
            padding: '2rem',
            boxShadow: '0 25px 80px rgba(0,0,0,0.8), 0 0 50px rgba(245,158,11,0.2)',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1.25rem',
          }}>
            <div style={{
              width: '60px',
              height: '60px',
              borderRadius: '50%',
              background: 'rgba(245,158,11,0.15)',
              border: '2px solid rgba(245,158,11,0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#f59e0b',
            }}>
              <RefreshCw size={28} />
            </div>

            <div>
              <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'white', marginBottom: '0.4rem' }}>
                Resume Transfer Session
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.5, margin: 0 }}>
                Room: <strong style={{ color: '#f59e0b', fontFamily: 'monospace' }}>{savedSession.roomId}</strong>
              </p>
            </div>

            <div style={{
              width: '100%',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid var(--border-default)',
              borderRadius: '1rem',
              padding: '1rem',
              textAlign: 'left',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
            }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                Expected original file(s):
              </div>
              <div style={{ color: 'white', fontWeight: 700, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <FileText size={16} color="#60a5fa" />
                {savedSession.fileMeta?.map(f => f.name).join(', ') || 'Original Transfer Files'}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Total Size: {formatBytes(savedSession.totalSize)}
              </div>
            </div>

            <div
              onClick={() => resumeFileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const dropped = Array.from(e.dataTransfer.files || []);
                if (dropped.length > 0) {
                  handleResumeWithFiles(dropped);
                }
              }}
              style={{
                width: '100%',
                border: '2px dashed rgba(245,158,11,0.5)',
                borderRadius: '1rem',
                padding: '1.5rem',
                cursor: 'pointer',
                background: 'rgba(245,158,11,0.05)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.5rem',
                transition: 'all 0.2s',
              }}
            >
              <Upload size={28} color="#f59e0b" />
              <div style={{ color: 'white', fontWeight: 700, fontSize: '0.95rem' }}>
                Click or Drop Files to Re-attach & Resume
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                Transfers will resume from the exact byte where paused.
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', width: '100%' }}>
              <button
                onClick={() => setResumePromptOpen(false)}
                className="btn btn-ghost"
                style={{ flex: 1, padding: '0.75rem', color: 'var(--text-muted)', border: '1px solid var(--border-default)', borderRadius: '0.75rem' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── INCOMING TRANSFER REQUEST / PERMISSION MODAL WITH IP & DEVICE INSPECTION ── */}
      {incomingRequest && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 99999,
          background: 'rgba(0,0,0,0.8)',
          backdropFilter: 'blur(12px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.5rem',
          animation: 'fadeIn 0.2s ease',
        }}>
          <div style={{
            background: 'var(--bg-elevated)',
            border: '1px solid rgba(16,185,129,0.5)',
            borderRadius: '1.5rem',
            width: '100%',
            maxWidth: '540px',
            padding: '2rem',
            boxShadow: '0 25px 80px rgba(0,0,0,0.8), 0 0 50px rgba(16,185,129,0.2)',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1.25rem',
          }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'rgba(16,185,129,0.15)',
              border: '2px solid rgba(16,185,129,0.6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#10b981',
              animation: 'pulse 2s infinite',
            }}>
              <Shield size={32} />
            </div>

            <div>
              <h3 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'white', marginBottom: '0.4rem' }}>
                Receiver Transfer Request
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', lineHeight: 1.5, margin: 0 }}>
                A peer is requesting permission to download files in room <strong style={{ color: '#10b981', fontFamily: 'monospace' }}>{incomingRequest.roomId}</strong>.
              </p>
            </div>

            {/* Receiver Device & Network Identity Inspector */}
            <div style={{
              width: '100%',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid var(--border-default)',
              borderRadius: '1rem',
              padding: '1.25rem',
              textAlign: 'left',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '0.6rem' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Globe size={15} color="#60a5fa" /> IP Address:
                </span>
                <span style={{
                  color: '#60a5fa',
                  fontWeight: 800,
                  fontFamily: 'monospace',
                  fontSize: '0.9rem',
                  background: 'rgba(96,165,250,0.12)',
                  padding: '0.2rem 0.6rem',
                  borderRadius: '0.4rem',
                  border: '1px solid rgba(96,165,250,0.3)',
                }}>
                  {incomingRequest.clientInfo?.ip || incomingRequest.clientInfo?.clientDetails?.ip || '127.0.0.1'}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '0.6rem' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  {incomingRequest.clientInfo?.deviceCategory === 'mobile' ? <Smartphone size={15} color="#a78bfa" /> : <Laptop size={15} color="#a78bfa" />} Device & OS:
                </span>
                <span style={{ color: 'white', fontWeight: 600, fontSize: '0.85rem' }}>
                  {incomingRequest.clientInfo?.deviceType || 'Laptop / Desktop'} ({incomingRequest.clientInfo?.os || 'Unknown OS'})
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '0.6rem' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Compass size={15} color="#34d399" /> Browser:
                </span>
                <span style={{ color: 'white', fontWeight: 600, fontSize: '0.85rem' }}>
                  {incomingRequest.clientInfo?.browser || 'Web Browser'}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '0.6rem' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Clock size={15} color="#f59e0b" /> Request Time:
                </span>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                  {incomingRequest.clientInfo?.formattedTime || new Date().toLocaleTimeString()}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <User size={15} color="#ec4899" /> Identity / Account:
                </span>
                <span style={{ color: '#818cf8', fontWeight: 600, fontSize: '0.85rem', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {incomingRequest.clientInfo?.receiverEmail && incomingRequest.clientInfo.receiverEmail !== 'anonymous'
                    ? incomingRequest.clientInfo.receiverEmail
                    : 'Guest Web Peer'}
                </span>
              </div>
            </div>

            {/* Transfer Summary */}
            <div style={{
              width: '100%',
              background: 'rgba(16,185,129,0.06)',
              border: '1px solid rgba(16,185,129,0.2)',
              borderRadius: '0.75rem',
              padding: '0.75rem 1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.85rem',
            }}>
              <span style={{ color: 'var(--text-secondary)' }}>Files to Send:</span>
              <span style={{ color: 'white', fontWeight: 700 }}>
                {files.length} file(s) ({formatBytes(files.reduce((a, f) => a + f.size, 0))})
              </span>
            </div>

            <div style={{ display: 'flex', gap: '1rem', width: '100%', marginTop: '0.25rem' }}>
              <button
                onClick={incomingRequest.onDecline}
                className="btn btn-ghost"
                style={{
                  flex: 1,
                  padding: '0.9rem',
                  color: '#ef4444',
                  border: '1px solid rgba(239,68,68,0.3)',
                  borderRadius: '0.75rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                ❌ Decline
              </button>
              <button
                onClick={incomingRequest.onAllow}
                className="btn btn-primary"
                style={{
                  flex: 1.4,
                  padding: '0.9rem',
                  background: 'linear-gradient(135deg, #10b981, #059669)',
                  border: 'none',
                  borderRadius: '0.75rem',
                  fontWeight: 800,
                  fontSize: '0.95rem',
                  cursor: 'pointer',
                  boxShadow: '0 8px 24px rgba(16,185,129,0.3)',
                }}
              >
                ✅ Allow & Send
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}