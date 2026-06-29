const { createServer } = require('http');
const next = require('next');
const { Server } = require('socket.io');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

const rooms = {};
const activeConnections = { count: 0 };

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    handle(req, res);
  });

  const io = new Server(httpServer, {
    cors: { origin: '*' },
    maxHttpBufferSize: 1e8
  });

  io.on('connection', (socket) => {
    activeConnections.count++;
    console.log(`[+] Connected: ${socket.id} | Total: ${activeConnections.count}`);

    socket.on('create-room', (roomId) => {
      if (rooms[roomId] && rooms[roomId].sender === socket.id) {
        socket.emit('room-created', { roomId });
        return;
      }
      rooms[roomId] = { sender: socket.id, receiver: null, createdAt: Date.now() };
      socket.join(roomId);
      socket.data.roomId = roomId;
      socket.emit('room-created', { roomId });
      console.log(`[Room ${roomId}] Created by sender ${socket.id}`);
    });

    socket.on('join-room', (roomId) => {
      const room = rooms[roomId];

      if (!room) {
        socket.emit('room-not-found');
        return;
      }

      if (room.receiver === socket.id) {
        socket.emit('joined-as-receiver', { roomId });
        return;
      }

      if (room.receiver && room.receiver !== socket.id) {
        socket.emit('room-full');
        return;
      }

      room.receiver = socket.id;
      socket.join(roomId);
      socket.data.roomId = roomId;

      socket.emit('joined-as-receiver', { roomId });
      io.to(room.sender).emit('receiver-joined', { roomId });
      console.log(`[Room ${roomId}] Receiver joined: ${socket.id}`);
    });

    socket.on('offer', ({ roomId, offer }) => {
      socket.to(roomId).emit('offer', { offer });
    });

    socket.on('answer', ({ roomId, answer }) => {
      socket.to(roomId).emit('answer', { answer });
    });

    socket.on('ice-candidate', ({ roomId, candidate }) => {
      socket.to(roomId).emit('ice-candidate', { candidate });
    });

    socket.on('transfer-complete', async ({ roomId, senderEmail, files, totalSize }) => {
      try {
        await fetch(`http://localhost:${process.env.PORT || 3000}/api/transfers/save`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roomId, senderEmail, files, totalSize })
        });
      } catch (e) {
        console.log('Transfer record save failed:', e.message);
      }
    });

    socket.on('get-active-connections', () => {
      socket.emit('active-connections', activeConnections.count);
    });

    socket.on('disconnect', () => {
      activeConnections.count--;
      const roomId = socket.data.roomId;
      if (roomId && rooms[roomId]) {
        socket.to(roomId).emit('peer-disconnected');
        if (rooms[roomId].sender === socket.id) {
          delete rooms[roomId];
        } else if (rooms[roomId].receiver === socket.id) {
          rooms[roomId].receiver = null;
        }
      }
      console.log(`[-] Disconnected: ${socket.id} | Total: ${activeConnections.count}`);
    });
  });

  global.io = io;
  global.activeConnections = activeConnections;

  const PORT = process.env.PORT || 3000;
  httpServer.listen(PORT, () => {
    console.log(`\n✅ Server running at http://localhost:${PORT}\n`);
  });
});