const rooms = {};           // roomId -> [socketId, ...]
const sessionMeta = {};     // roomId -> session metadata

const SESSION_TTL = 24 * 60 * 60 * 1000; // 24 hours
const rateLimitMap = {};    // ip -> { count, windowStart }
const RATE_LIMIT = 10;      // max room creations per minute per IP
const RATE_WINDOW = 60000;

// Expose rooms reference for admin health API
function getRooms() { return rooms; }
function getSessionMeta() { return sessionMeta; }

function checkRateLimit(ip) {
  const now = Date.now();
  if (!rateLimitMap[ip] || now - rateLimitMap[ip].windowStart > RATE_WINDOW) {
    rateLimitMap[ip] = { count: 1, windowStart: now };
    return true;
  }
  rateLimitMap[ip].count++;
  return rateLimitMap[ip].count <= RATE_LIMIT;
}

function validateRoomId(roomId) {
  return typeof roomId === 'string' && /^[A-Z0-9]{8,14}$/.test(roomId);
}

function cleanExpiredSessions() {
  const now = Date.now();
  for (const [roomId, meta] of Object.entries(sessionMeta)) {
    if (now - meta.createdAt > SESSION_TTL) {
      delete sessionMeta[roomId];
      delete rooms[roomId];
    }
  }
}

// Periodic cleanup every 30 minutes
setInterval(cleanExpiredSessions, 30 * 60 * 1000);

function initSocketHandlers(io) {
  // Store io reference globally for admin API
  if (typeof global !== 'undefined') {
    global._p2pIO = io;
    global._p2pRooms = getRooms;
    global._p2pSessions = getSessionMeta;
  }

  // In-memory log buffer for admin panel
  const LOG_MAX = 200;
  if (!global._p2pLogs) global._p2pLogs = [];

  function addLog(level, message, data = {}) {
    global._p2pLogs.unshift({
      level,
      message,
      data,
      timestamp: new Date().toISOString(),
    });
    if (global._p2pLogs.length > LOG_MAX) global._p2pLogs.pop();
  }

  io.on('connection', (socket) => {
    const clientIp = socket.handshake.headers['x-forwarded-for'] || socket.handshake.address || 'unknown';
    addLog('info', `Client connected: ${socket.id}`, { ip: clientIp });

    // ─── CREATE ROOM (Sender) ─────────────────────────────
    socket.on('create-room', (roomId) => {
      if (!validateRoomId(roomId)) {
        socket.emit('error', { message: 'Invalid room ID format' });
        return;
      }
      if (!checkRateLimit(clientIp)) {
        socket.emit('error', { message: 'Rate limit exceeded. Please wait before creating another room.' });
        addLog('warning', `Rate limit hit for IP: ${clientIp}`);
        return;
      }

      rooms[roomId] = [socket.id];
      socket.join(roomId);
      socket.data.roomId = roomId;
      socket.data.role = 'sender';

      sessionMeta[roomId] = {
        createdAt: Date.now(),
        senderSocketId: socket.id,
        status: 'waiting',
        fileCount: 0,
        totalBytes: 0,
        startTime: null,
        endTime: null,
      };

      socket.emit('room-created', { roomId });
      addLog('info', `Room created: ${roomId}`, { sender: socket.id });
    });

    // ─── JOIN ROOM (Receiver) ─────────────────────────────
    socket.on('join-room', (roomId) => {
      if (!validateRoomId(roomId)) {
        socket.emit('error', { message: 'Invalid room ID' });
        return;
      }

      // Check session expiry
      if (sessionMeta[roomId]) {
        const age = Date.now() - sessionMeta[roomId].createdAt;
        if (age > SESSION_TTL) {
          socket.emit('room-expired');
          delete rooms[roomId];
          delete sessionMeta[roomId];
          return;
        }
      }

      if (!rooms[roomId]) {
        socket.emit('room-not-found');
        return;
      }
      if (rooms[roomId].length >= 2) {
        socket.emit('room-full');
        return;
      }

      rooms[roomId].push(socket.id);
      socket.join(roomId);
      socket.data.roomId = roomId;
      socket.data.role = 'receiver';

      if (sessionMeta[roomId]) {
        sessionMeta[roomId].status = 'connecting';
        sessionMeta[roomId].startTime = Date.now();
        sessionMeta[roomId].receiverSocketId = socket.id;
      }

      // Notify sender
      io.to(rooms[roomId][0]).emit('receiver-joined', { roomId });
      socket.emit('joined-as-receiver', { roomId });

      addLog('info', `Receiver joined room: ${roomId}`, { receiver: socket.id });
    });

    // ─── SIGNALING ────────────────────────────────────────
    socket.on('offer', ({ roomId, offer }) => {
      if (!validateRoomId(roomId)) return;
      if (!offer || typeof offer !== 'object') return;
      socket.to(roomId).emit('offer', { offer });
    });

    socket.on('answer', ({ roomId, answer }) => {
      if (!validateRoomId(roomId)) return;
      if (!answer || typeof answer !== 'object') return;
      socket.to(roomId).emit('answer', { answer });
      if (sessionMeta[roomId]) sessionMeta[roomId].status = 'transferring';
    });

    socket.on('ice-candidate', ({ roomId, candidate }) => {
      if (!validateRoomId(roomId)) return;
      socket.to(roomId).emit('ice-candidate', { candidate });
    });

    // ─── TRANSFER METADATA ────────────────────────────────
    socket.on('transfer-complete', ({ roomId, fileCount, totalBytes }) => {
      if (sessionMeta[roomId]) {
        sessionMeta[roomId].status = 'completed';
        sessionMeta[roomId].endTime = Date.now();
        sessionMeta[roomId].fileCount = fileCount;
        sessionMeta[roomId].totalBytes = totalBytes;
      }
      addLog('info', `Transfer complete in room: ${roomId}`, { fileCount, totalBytes });
    });

    socket.on('session-end', ({ roomId }) => {
      if (!validateRoomId(roomId)) return;
      socket.to(roomId).emit('session-ended');
      if (sessionMeta[roomId]) {
        sessionMeta[roomId].status = 'ended';
        sessionMeta[roomId].endTime = Date.now();
      }
      addLog('info', `Session ended: ${roomId}`);
    });

    // ─── DISCONNECT ───────────────────────────────────────
    socket.on('disconnect', (reason) => {
      const roomId = socket.data.roomId;
      addLog('info', `Client disconnected: ${socket.id}`, { reason, roomId });

      if (roomId && rooms[roomId]) {
        rooms[roomId] = rooms[roomId].filter(id => id !== socket.id);
        socket.to(roomId).emit('peer-disconnected', { reason });

        if (rooms[roomId].length === 0) {
          if (sessionMeta[roomId] && sessionMeta[roomId].status !== 'ended') {
            sessionMeta[roomId].status = 'failed';
            sessionMeta[roomId].endTime = Date.now();
          }
          delete rooms[roomId];
          addLog('info', `Room cleaned up: ${roomId}`);
        }
      }
    });
  });
}

module.exports = { initSocketHandlers, getRooms, getSessionMeta };
