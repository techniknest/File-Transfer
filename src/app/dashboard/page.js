'use client';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import io from 'socket.io-client';
import TransferModal from '../components/TransferModal';
import { showToast } from '../components/Toast';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' }
  ]
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

  // Receive state
  const [receiveLink, setReceiveLink] = useState('');
  const [receiveStatus, setReceiveStatus] = useState('idle');
  const [receivedFiles, setReceivedFiles] = useState([]);

  const socketRef = useRef(null);
  const pcRef = useRef(null);
  const filesRef = useRef([]);
  const roomIdRef = useRef('');
  const chunksRef = useRef([]);
  const metaRef = useRef(null);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
  }, [status, router]);

  const getSocket = useCallback(() => {
    if (!socketRef.current) {
      socketRef.current = io();
    }
    return socketRef.current;
  }, []);

  const generateRoomId = () =>
    Math.random().toString(36).substring(2, 8).toUpperCase() +
    Math.random().toString(36).substring(2, 6).toUpperCase();

  const readChunk = (file, start, end) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsArrayBuffer(file.slice(start, end));
  });

  const handleFilesSelected = useCallback((selectedFiles) => {
    if (!selectedFiles || selectedFiles.length === 0) return;

    const newFiles = [...filesRef.current, ...selectedFiles];
    setFiles(newFiles);
    filesRef.current = newFiles;

    if (!roomIdRef.current) {
      const id = generateRoomId();
      setRoomId(id);
      roomIdRef.current = id;

      const link = `${window.location.origin}/receive?room=${id}`;
      setShareLink(link);
      setTransferStatus('waiting');
      setModalOpen(true);

      const socket = getSocket();
      socket.emit('create-room', id);

      socket.on('receiver-joined', async () => {
        setTransferStatus('connecting');

        const pc = new RTCPeerConnection(ICE_SERVERS);
        pcRef.current = pc;

        const dc = pc.createDataChannel('fileTransfer', { ordered: true });

        pc.onicecandidate = (e) => {
          if (e.candidate) {
            socket.emit('ice-candidate', { roomId: id, candidate: e.candidate });
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
            totalBytes
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
              totalFiles: filesRef.current.length
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

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('offer', { roomId: id, offer });
      });

      socket.on('answer', async ({ answer }) => {
        if (pcRef.current) {
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(answer));
        }
      });

      socket.on('ice-candidate', async ({ candidate }) => {
        if (pcRef.current && candidate) {
          try { await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate)); } catch (_) {}
        }
      });
    } else {
      setFiles(newFiles);
    }
  }, [getSocket, session]);

  const handleAddMoreFiles = useCallback((moreFiles) => {
    const newFiles = [...filesRef.current, ...moreFiles];
    setFiles(newFiles);
    filesRef.current = newFiles;
  }, []);

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
  }, []);

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

  if (status === 'loading') return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-blue-500"></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Navbar */}
      <nav className="bg-gray-900 border-b border-gray-800 px-6 py-4 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="font-bold text-sm">⚡</span>
            </div>
            <span className="font-bold text-xl">P2P Transfer</span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-gray-400 text-sm">
              Welcome, <span className="text-white font-medium">{session?.user?.name}</span>
            </span>
            {session?.user?.role === 'admin' && (
              <Link href="/admin" className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded-lg text-sm transition-all">
                Admin
              </Link>
            )}
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded-lg text-sm transition-all"
            >
              Sign Out
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-12">
        {/* HOME */}
        {view === 'home' && (
          <div>
            <div className="text-center mb-12">
              <h1 className="text-4xl font-bold mb-3 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                Transfer Files
              </h1>
              <p className="text-gray-400 text-lg">P2P encrypted transfers. No cloud, no size limits.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <button
                onClick={() => setView('send')}
                className="bg-gray-900 border border-gray-800 hover:border-blue-500 rounded-2xl p-8 text-left transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-blue-500/10 group"
              >
                <div className="w-14 h-14 bg-blue-600 rounded-xl flex items-center justify-center mb-4 text-2xl shadow-lg shadow-blue-600/30">
                  📤
                </div>
                <h2 className="text-xl font-bold mb-2">Send Files</h2>
                <p className="text-gray-400 text-sm leading-relaxed">Select files and generate a secure transfer link. Share with anyone.</p>
                <div className="flex gap-2 mt-4 flex-wrap">
                  {['No size limit', 'Encrypted', 'Instant'].map(t => (
                    <span key={t} className="bg-blue-600/20 text-blue-400 px-2 py-1 rounded-full text-xs font-medium">{t}</span>
                  ))}
                </div>
              </button>

              <button
                onClick={() => setView('receive')}
                className="bg-gray-900 border border-gray-800 hover:border-green-500 rounded-2xl p-8 text-left transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-green-500/10 group"
              >
                <div className="w-14 h-14 bg-green-600 rounded-xl flex items-center justify-center mb-4 text-2xl shadow-lg shadow-green-600/30">
                  📥
                </div>
                <h2 className="text-xl font-bold mb-2">Receive Files</h2>
                <p className="text-gray-400 text-sm leading-relaxed">Paste a transfer link to receive files with live progress tracking.</p>
                <div className="flex gap-2 mt-4 flex-wrap">
                  {['Auto-download', 'Live progress', 'P2P direct'].map(t => (
                    <span key={t} className="bg-green-600/20 text-green-400 px-2 py-1 rounded-full text-xs font-medium">{t}</span>
                  ))}
                </div>
              </button>
            </div>
          </div>
        )}

        {/* SEND */}
        {view === 'send' && (
          <div>
            <button onClick={() => { setView('home'); handleModalClose(); }} className="text-gray-400 hover:text-white mb-6 flex items-center gap-2 transition-all text-sm">
              ← Back
            </button>
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8">
              <h2 className="text-2xl font-bold mb-2">Send Files</h2>
              <p className="text-gray-400 mb-8">Select files to generate a secure P2P transfer link.</p>

              <div
                onClick={() => document.getElementById('dashFileInput').click()}
                onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = '#6366f1'; }}
                onDragLeave={e => { e.currentTarget.style.borderColor = ''; }}
                onDrop={e => {
                  e.preventDefault();
                  e.currentTarget.style.borderColor = '';
                  const dropped = [...e.dataTransfer.files];
                  if (dropped.length) handleFilesSelected(dropped);
                }}
                className="border-2 border-dashed border-gray-700 rounded-xl p-16 text-center hover:border-blue-500 transition-all cursor-pointer hover:bg-blue-500/5"
              >
                <span className="text-6xl mb-4 block">📁</span>
                <p className="text-white font-bold text-xl mb-2">Click to select or drag & drop files</p>
                <p className="text-gray-400">Any file type • No size limit</p>
                <input
                  id="dashFileInput"
                  type="file"
                  multiple
                  className="hidden"
                  onChange={e => { if (e.target.files?.length) handleFilesSelected([...e.target.files]); e.target.value = ''; }}
                />
              </div>

              {files.length > 0 && !modalOpen && (
                <button onClick={() => setModalOpen(true)} className="w-full mt-6 bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl transition-all text-lg">
                  View Transfer Link
                </button>
              )}
            </div>
          </div>
        )}

        {/* RECEIVE */}
        {view === 'receive' && (
          <div>
            <button onClick={() => setView('home')} className="text-gray-400 hover:text-white mb-6 flex items-center gap-2 transition-all text-sm">
              ← Back
            </button>
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8">
              <h2 className="text-2xl font-bold mb-2">Receive Files</h2>
              <p className="text-gray-400 mb-8">Paste a transfer link to receive files directly.</p>

              <div className="space-y-4">
                <div>
                  <label className="text-gray-300 font-medium text-sm mb-2 block">Transfer Link</label>
                  <input
                    type="text"
                    placeholder="https://...?room=XXXXXX"
                    value={receiveLink}
                    onChange={e => setReceiveLink(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && receiveLink.trim()) startReceiver(); }}
                    className="w-full bg-gray-800 text-white rounded-xl px-5 py-4 border border-gray-700 focus:outline-none focus:border-green-500 text-lg transition-all"
                  />
                </div>
                <button
                  onClick={startReceiver}
                  disabled={!receiveLink.trim()}
                  className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-bold py-4 rounded-xl transition-all text-lg hover:-translate-y-0.5"
                >
                  📥 Start Receiving
                </button>
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