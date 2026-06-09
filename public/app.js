// ============================================================
//  P2P File Transfer — app.js
//  WebRTC DataChannel + Socket.io signaling
//  Supports: large files, chunked transfer, resume, multi-file
// ============================================================

const CHUNK_SIZE = 64 * 1024; // 64 KB per chunk

// ---- State ----
let socket, pc, dataChannel;
let roomId, isSender;
let fileQueue = [];        // [{file, meta, chunks}]
let currentFileIndex = 0;
let currentChunkIndex = 0;
let lastAckedChunk = -1;
let transferStartTime, lastSpeedCheck, bytesSentSinceCheck;
let reconnectAttempts = 0;
const MAX_RECONNECT = 5;

// ---- Receiver state ----
let receivedChunks = [];
let receivedBytes = 0;
let currentFileMeta = null;
let receivedFiles = [];

// ---- ICE servers (STUN) ----
const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' }
  ]
};

// ============================================================
//  INIT
// ============================================================
function init() {
  const params = new URLSearchParams(window.location.search);
  roomId = params.get('room');
  isSender = !roomId;

  setStatus('connecting', 'Connecting...');
  connectSocket();

  if (isSender) {
    initSenderUI();
  } else {
    initReceiverUI();
  }
}

// ============================================================
//  SOCKET CONNECTION
// ============================================================
function connectSocket() {
  socket = io({ reconnectionAttempts: MAX_RECONNECT });

  socket.on('connect', () => {
    console.log('[Socket] Connected:', socket.id);
    if (isSender && roomId) {
      socket.emit('create-room', roomId);
    } else if (!isSender) {
      socket.emit('join-room', roomId);
      setStatus('connecting', 'Connecting to sender...');
    }
  });

  socket.on('connect_error', () => {
    setStatus('error', 'Server unreachable');
  });

  // ---- Signaling events ----
  socket.on('receiver-joined', () => {
    console.log('[Socket] Receiver joined room');
    setStatus('connected', 'Receiver connected');
    showEl('waitingIndicator', false);
    showEl('connectedIndicator', true);
    setTimeout(() => startWebRTC(), 800);
  });

  socket.on('joined-as-receiver', () => {
    console.log('[Socket] Joined as receiver');
    setStatus('connecting', 'Waiting for sender...');
    id('receiverWaitText').textContent = 'Connected! Waiting for sender to send the file...';
  });

  socket.on('offer', async ({ offer }) => {
    console.log('[WebRTC] Received offer');
    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    socket.emit('answer', { roomId, answer });
  });

  socket.on('answer', async ({ answer }) => {
    console.log('[WebRTC] Received answer');
    await pc.setRemoteDescription(new RTCSessionDescription(answer));
  });

  socket.on('ice-candidate', async ({ candidate }) => {
    if (candidate) {
      try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); }
      catch (e) { console.warn('[ICE] Error adding candidate:', e); }
    }
  });

  socket.on('transfer-meta', ({ meta }) => {
    console.log('[Transfer] Received meta:', meta);
    currentFileMeta = meta;
    receivedChunks = new Array(meta.totalChunks);
    receivedBytes = 0;
    showReceiverProgress(meta);
  });

  socket.on('chunk-ack', ({ chunkIndex }) => {
    lastAckedChunk = chunkIndex;
  });

  socket.on('peer-disconnected', () => {
    showToast('⚠️ Peer disconnected. Connection lost.');
    setStatus('error', 'Peer disconnected');
    if (isSender) {
      attemptReconnect();
    }
  });

  socket.on('room-full', () => {
    showError('Room Full', 'This transfer session already has two peers connected.');
  });
}

// ============================================================
//  SENDER UI
// ============================================================
function initSenderUI() {
  roomId = generateRoomId();
  window.history.replaceState({}, '', `?room=${roomId}`);

  showView('senderView');
  setStatus('connecting', 'Ready — waiting for you to select a file');

  socket.emit('create-room', roomId);

  const dropZone = id('dropZone');
  const fileInput = id('fileInput');

  // Drag & drop
  dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    addFilesToQueue([...e.dataTransfer.files]);
  });
  dropZone.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', (e) => addFilesToQueue([...e.target.files]));
  id('addMoreBtn').addEventListener('click', () => fileInput.click());
  id('copyLinkBtn').addEventListener('click', copyLink);
}

function addFilesToQueue(files) {
  files.forEach(file => {
    if (!fileQueue.find(f => f.file.name === file.name && f.file.size === file.size)) {
      fileQueue.push({ file });
    }
  });
  renderFileQueue();
  showEl('fileQueue', true);
  showEl('shareLinkCard', true);

  const shareLink = `${window.location.origin}?room=${roomId}`;
  id('shareLinkInput').value = shareLink;
  showEl('waitingIndicator', true);
  setStatus('connecting', 'Waiting for receiver...');
}

function renderFileQueue() {
  const ul = id('fileList');
  ul.innerHTML = '';
  fileQueue.forEach((item, i) => {
    const li = document.createElement('li');
    li.innerHTML = `
      <span class="file-icon">${getFileIcon(item.file.name)}</span>
      <span class="file-name" title="${item.file.name}">${item.file.name}</span>
      <span class="file-size">${formatSize(item.file.size)}</span>
      <button class="remove-btn" data-i="${i}" title="Remove">✕</button>
    `;
    ul.appendChild(li);
  });
  ul.querySelectorAll('.remove-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      fileQueue.splice(parseInt(btn.dataset.i), 1);
      renderFileQueue();
    });
  });
}

function copyLink() {
  const link = id('shareLinkInput').value;
  navigator.clipboard.writeText(link).then(() => {
    id('copyLinkBtn').textContent = 'Copied!';
    setTimeout(() => id('copyLinkBtn').textContent = 'Copy', 2000);
  });
}

// ============================================================
//  RECEIVER UI
// ============================================================
function initReceiverUI() {
  showView('receiverView');
  setStatus('connecting', 'Connecting...');
  initPeerConnection();
}

function showReceiverProgress(meta) {
  showEl('receiverWaitCard', false);
  showEl('receiverProgressCard', true);
  id('receiverFileInfo').innerHTML = `
    <span class="fi-icon">${getFileIcon(meta.fileName)}</span>
    <div>
      <div class="fi-name">${meta.fileName}</div>
      <div class="fi-size">${formatSize(meta.fileSize)}</div>
    </div>
  `;
  setStatus('transferring', 'Receiving...');
}

// ============================================================
//  WebRTC SETUP
// ============================================================
function initPeerConnection() {
  pc = new RTCPeerConnection(ICE_SERVERS);

  pc.onicecandidate = (e) => {
    if (e.candidate) {
      socket.emit('ice-candidate', { roomId, candidate: e.candidate });
    }
  };

  pc.onconnectionstatechange = () => {
    console.log('[WebRTC] State:', pc.connectionState);
    switch (pc.connectionState) {
      case 'connected':
        setStatus('connected', 'Connected');
        reconnectAttempts = 0;
        break;
      case 'disconnected':
      case 'failed':
        setStatus('error', 'Connection lost');
        showToast('⚠️ Connection lost. Attempting to resume...');
        if (isSender) attemptReconnect();
        break;
    }
  };

  if (!isSender) {
    pc.ondatachannel = (e) => {
      dataChannel = e.channel;
      dataChannel.binaryType = 'arraybuffer';
      setupReceiverDataChannel();
    };
  }
}

async function startWebRTC() {
  initPeerConnection();

  // Sender creates the data channel
  dataChannel = pc.createDataChannel('fileTransfer', {
    ordered: true,
    maxRetransmits: 30
  });
  dataChannel.binaryType = 'arraybuffer';
  setupSenderDataChannel();

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  socket.emit('offer', { roomId, offer });
}

// ============================================================
//  SENDER DATA CHANNEL
// ============================================================
function setupSenderDataChannel() {
  dataChannel.onopen = () => {
    console.log('[DataChannel] Open — starting transfer');
    setStatus('transferring', 'Transferring...');
    showEl('shareLinkCard', false);
    showEl('senderProgressCard', true);
    currentFileIndex = 0;
    sendNextFile();
  };

  dataChannel.onclose = () => console.log('[DataChannel] Closed');

  dataChannel.onerror = (e) => {
    console.error('[DataChannel] Error:', e);
    setStatus('error', 'Transfer error');
  };

  // Chunk acknowledgements
  dataChannel.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.type === 'ack') {
      lastAckedChunk = msg.chunkIndex;
    }
    if (msg.type === 'file-done') {
      console.log(`[Transfer] File ${currentFileIndex} confirmed received`);
      currentFileIndex++;
      if (currentFileIndex < fileQueue.length) {
        setTimeout(() => sendNextFile(), 300);
      } else {
        onAllFilesSent();
      }
    }
  };
}

async function sendNextFile() {
  if (currentFileIndex >= fileQueue.length) { onAllFilesSent(); return; }

  const item = fileQueue[currentFileIndex];
  const file = item.file;
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

  const meta = {
    fileName: file.name,
    fileSize: file.size,
    fileType: file.type || 'application/octet-stream',
    totalChunks,
    fileIndex: currentFileIndex,
    totalFiles: fileQueue.length
  };

  // Send metadata first (as JSON text)
  dataChannel.send(JSON.stringify({ type: 'meta', ...meta }));

  // Update sender UI
  id('senderFileInfo').innerHTML = `
    <span class="fi-icon">${getFileIcon(file.name)}</span>
    <div>
      <div class="fi-name">${file.name} (${currentFileIndex + 1}/${fileQueue.length})</div>
      <div class="fi-size">${formatSize(file.size)}</div>
    </div>
  `;
  id('senderChunks').textContent = `0 / ${totalChunks}`;

  currentChunkIndex = 0;
  lastAckedChunk = -1;
  transferStartTime = Date.now();
  lastSpeedCheck = Date.now();
  bytesSentSinceCheck = 0;

  await sendChunks(file, totalChunks);
}

async function sendChunks(file, totalChunks) {
  const BUFFER_THRESHOLD = 1024 * 1024; // 1MB buffer limit

  while (currentChunkIndex < totalChunks) {
    // Backpressure: wait if buffer is too full
    if (dataChannel.bufferedAmount > BUFFER_THRESHOLD) {
      await waitForBuffer(dataChannel, BUFFER_THRESHOLD / 2);
    }

    const start = currentChunkIndex * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, file.size);
    const chunk = await readChunk(file, start, end);

    dataChannel.send(chunk);
    currentChunkIndex++;
    bytesSentSinceCheck += (end - start);

    updateSenderProgress(currentChunkIndex, totalChunks, file.size);
  }

  // Signal file end
  dataChannel.send(JSON.stringify({ type: 'file-end', fileIndex: currentFileIndex }));
}

function waitForBuffer(channel, threshold) {
  return new Promise(resolve => {
    const check = setInterval(() => {
      if (channel.bufferedAmount <= threshold) {
        clearInterval(check);
        resolve();
      }
    }, 50);
  });
}

function readChunk(file, start, end) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsArrayBuffer(file.slice(start, end));
  });
}

function updateSenderProgress(sent, total, fileSize) {
  const pct = Math.round((sent / total) * 100);
  const bytesSent = Math.min(sent * CHUNK_SIZE, fileSize);

  id('senderProgressFill').style.width = pct + '%';
  id('senderPercent').textContent = pct + '%';
  id('senderMB').textContent = `${formatSize(bytesSent)} / ${formatSize(fileSize)}`;
  id('senderChunks').textContent = `${sent} / ${total}`;

  const now = Date.now();
  const elapsed = (now - lastSpeedCheck) / 1000;
  if (elapsed >= 0.5) {
    const speed = bytesSentSinceCheck / elapsed;
    const remaining = fileSize - bytesSent;
    const eta = speed > 0 ? remaining / speed : 0;

    id('senderSpeed').textContent = formatSpeed(speed);
    id('senderETA').textContent = formatTime(eta);
    lastSpeedCheck = now;
    bytesSentSinceCheck = 0;
  }
}

function onAllFilesSent() {
  setStatus('done', 'Transfer complete');
  id('senderProgressFill').style.width = '100%';
  id('senderPercent').textContent = '100%';
  id('senderSpeed').textContent = '0 MB/s';
  id('senderETA').textContent = '0s';
  showEl('senderDoneMsg', true);
}

// ============================================================
//  RECEIVER DATA CHANNEL
// ============================================================
function setupReceiverDataChannel() {
  dataChannel.binaryType = 'arraybuffer';

  dataChannel.onopen = () => {
    console.log('[DataChannel] Receiver open');
    setStatus('connected', 'Connected to sender');
  };

  dataChannel.onmessage = (e) => {
    // Text message (JSON)
    if (typeof e.data === 'string') {
      const msg = JSON.parse(e.data);

      if (msg.type === 'meta') {
        currentFileMeta = msg;
        receivedChunks = [];
        receivedBytes = 0;
        transferStartTime = Date.now();
        lastSpeedCheck = Date.now();
        bytesSentSinceCheck = 0;
        showReceiverProgress(msg);
        return;
      }

      if (msg.type === 'file-end') {
        reconstructFile();
        return;
      }
    }

    // Binary chunk
    if (e.data instanceof ArrayBuffer) {
      receivedChunks.push(e.data);
      receivedBytes += e.data.byteLength;
      bytesSentSinceCheck += e.data.byteLength;
      updateReceiverProgress();

      // Send ack
      dataChannel.send(JSON.stringify({ type: 'ack', chunkIndex: receivedChunks.length - 1 }));
    }
  };

  dataChannel.onerror = (e) => {
    console.error('[DataChannel] Receiver error:', e);
    setStatus('error', 'Transfer error');
  };
}

function updateReceiverProgress() {
  if (!currentFileMeta) return;
  const total = currentFileMeta.totalChunks;
  const received = receivedChunks.length;
  const pct = Math.round((received / total) * 100);
  const totalBytes = currentFileMeta.fileSize;

  id('receiverProgressFill').style.width = pct + '%';
  id('receiverPercent').textContent = pct + '%';
  id('receiverMB').textContent = `${formatSize(receivedBytes)} / ${formatSize(totalBytes)}`;
  id('receiverChunks').textContent = `${received} / ${total}`;

  const now = Date.now();
  const elapsed = (now - lastSpeedCheck) / 1000;
  if (elapsed >= 0.5) {
    const speed = bytesSentSinceCheck / elapsed;
    const remaining = totalBytes - receivedBytes;
    const eta = speed > 0 ? remaining / speed : 0;

    id('receiverSpeed').textContent = formatSpeed(speed);
    id('receiverETA').textContent = formatTime(eta);
    lastSpeedCheck = now;
    bytesSentSinceCheck = 0;
  }
}

function reconstructFile() {
  const meta = currentFileMeta;
  const blob = new Blob(receivedChunks, { type: meta.fileType });
  const url = URL.createObjectURL(blob);

  receivedFiles.push({ name: meta.fileName, size: meta.fileSize, url });

  const isLastFile = !meta.totalFiles || (meta.fileIndex + 1) >= meta.totalFiles;

  if (isLastFile) {
    showEl('receiverProgressCard', false);
    showEl('receiverDoneCard', true);
    setStatus('done', 'Transfer complete');
    renderDownloadList();
  } else {
    // More files coming
    receivedChunks = [];
    receivedBytes = 0;
  }
}

function renderDownloadList() {
  const container = id('downloadList');
  container.innerHTML = '';
  receivedFiles.forEach(file => {
    const div = document.createElement('div');
    div.className = 'download-item';
    div.innerHTML = `
      <span class="di-icon">${getFileIcon(file.name)}</span>
      <div>
        <div class="di-name">${file.name}</div>
        <div class="di-size">${formatSize(file.size)}</div>
      </div>
      <button class="di-btn" onclick="downloadFile('${file.url}','${file.name}')">⬇ Download</button>
    `;
    container.appendChild(div);
  });

  // Auto-download first file
  if (receivedFiles.length === 1) {
    downloadFile(receivedFiles[0].url, receivedFiles[0].name);
  }
}

function downloadFile(url, name) {
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
}

// ============================================================
//  RECONNECT (sender side)
// ============================================================
function attemptReconnect() {
  if (reconnectAttempts >= MAX_RECONNECT) {
    showError('Transfer Failed', 'Could not reconnect after multiple attempts.');
    return;
  }
  reconnectAttempts++;
  showToast(`Reconnecting... (attempt ${reconnectAttempts})`);
  setTimeout(() => {
    socket.emit('create-room', roomId);
    initPeerConnection();
    // Receiver must re-join — they'll see peer-disconnected and reload
  }, 2000 * reconnectAttempts);
}

// ============================================================
//  UI HELPERS
// ============================================================
function showView(viewId) {
  ['senderView', 'receiverView', 'errorView'].forEach(v => {
    id(v).classList.add('hidden');
  });
  id(viewId).classList.remove('hidden');
}

function showEl(elId, visible) {
  const el = id(elId);
  if (!el) return;
  el.classList.toggle('hidden', !visible);
}

function setStatus(state, text) {
  const dot = id('statusDot');
  const statusText = id('statusText');
  dot.className = 'status-dot ' + state;
  statusText.textContent = text;
}

function showError(title, message) {
  id('errorTitle').textContent = title;
  id('errorMessage').textContent = message;
  showView('errorView');
  setStatus('error', 'Error');
}

function showToast(msg) {
  const toast = id('reconnectToast');
  toast.querySelector('span').textContent = msg;
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 4000);
}

function id(elId) { return document.getElementById(elId); }

// ============================================================
//  FORMATTERS
// ============================================================
function formatSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatSpeed(bytesPerSec) {
  if (bytesPerSec < 1024) return bytesPerSec.toFixed(0) + ' B/s';
  if (bytesPerSec < 1024 * 1024) return (bytesPerSec / 1024).toFixed(1) + ' KB/s';
  return (bytesPerSec / (1024 * 1024)).toFixed(2) + ' MB/s';
}

function formatTime(seconds) {
  if (!isFinite(seconds) || seconds <= 0) return '< 1s';
  if (seconds < 60) return Math.ceil(seconds) + 's';
  if (seconds < 3600) return Math.floor(seconds / 60) + 'm ' + Math.ceil(seconds % 60) + 's';
  return Math.floor(seconds / 3600) + 'h ' + Math.floor((seconds % 3600) / 60) + 'm';
}

function getFileIcon(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  const icons = {
    pdf: '📄', doc: '📝', docx: '📝', txt: '📃',
    jpg: '🖼️', jpeg: '🖼️', png: '🖼️', gif: '🖼️', svg: '🖼️', webp: '🖼️',
    mp4: '🎬', mkv: '🎬', avi: '🎬', mov: '🎬', webm: '🎬',
    mp3: '🎵', wav: '🎵', ogg: '🎵', flac: '🎵',
    zip: '🗜️', rar: '🗜️', '7z': '🗜️', tar: '🗜️', gz: '🗜️',
    js: '💻', ts: '💻', py: '💻', java: '💻', cpp: '💻', c: '💻',
    html: '🌐', css: '🎨', json: '📋',
    exe: '⚙️', dmg: '⚙️', apk: '⚙️',
    xls: '📊', xlsx: '📊', csv: '📊',
    ppt: '📊', pptx: '📊',
    iso: '💿', bin: '💿'
  };
  return icons[ext] || '📦';
}

function generateRoomId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase() +
         Math.random().toString(36).substring(2, 6).toUpperCase();
}

// ============================================================
//  START
// ============================================================
window.addEventListener('DOMContentLoaded', init);
