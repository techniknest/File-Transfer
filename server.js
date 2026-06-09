const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
  maxHttpBufferSize: 1e8
});

app.use(express.static(path.join(__dirname, 'public')));

// Track rooms: roomId -> [socketId1, socketId2]
const rooms = {};

io.on('connection', (socket) => {
  console.log(`[+] Connected: ${socket.id}`);

  // Receiver joins a room
  socket.on('join-room', (roomId) => {
    if (!rooms[roomId]) {
      rooms[roomId] = [];
    }

    if (rooms[roomId].length >= 2) {
      socket.emit('room-full');
      return;
    }

    rooms[roomId].push(socket.id);
    socket.join(roomId);
    socket.data.roomId = roomId;

    console.log(`[Room ${roomId}] ${socket.id} joined (${rooms[roomId].length}/2)`);

    // If both peers are in the room, notify sender
    if (rooms[roomId].length === 2) {
      const senderId = rooms[roomId][0];
      io.to(senderId).emit('receiver-joined', { roomId });
      socket.emit('joined-as-receiver', { roomId });
    } else {
      // First person in room (sender), just confirm
      socket.emit('joined-as-sender', { roomId });
    }
  });

  // Sender creates room and waits
  socket.on('create-room', (roomId) => {
    rooms[roomId] = [socket.id];
    socket.join(roomId);
    socket.data.roomId = roomId;
    socket.emit('room-created', { roomId });
    console.log(`[Room ${roomId}] Created by sender ${socket.id}`);
  });

  // Forward WebRTC offer from sender to receiver
  socket.on('offer', ({ roomId, offer }) => {
    socket.to(roomId).emit('offer', { offer });
    console.log(`[Room ${roomId}] Offer forwarded`);
  });

  // Forward WebRTC answer from receiver to sender
  socket.on('answer', ({ roomId, answer }) => {
    socket.to(roomId).emit('answer', { answer });
    console.log(`[Room ${roomId}] Answer forwarded`);
  });

  // Forward ICE candidates between peers
  socket.on('ice-candidate', ({ roomId, candidate }) => {
    socket.to(roomId).emit('ice-candidate', { candidate });
  });

  // Handle transfer metadata (filename, size, totalChunks)
  socket.on('transfer-meta', ({ roomId, meta }) => {
    socket.to(roomId).emit('transfer-meta', { meta });
  });

  // Handle chunk acknowledgement (for resumable transfer)
  socket.on('chunk-ack', ({ roomId, chunkIndex }) => {
    socket.to(roomId).emit('chunk-ack', { chunkIndex });
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    const roomId = socket.data.roomId;
    if (roomId && rooms[roomId]) {
      rooms[roomId] = rooms[roomId].filter(id => id !== socket.id);
      socket.to(roomId).emit('peer-disconnected');
      console.log(`[-] Disconnected: ${socket.id} from room ${roomId}`);
      if (rooms[roomId].length === 0) {
        delete rooms[roomId];
        console.log(`[Room ${roomId}] Deleted (empty)`);
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n✅ P2P File Transfer Server running at http://localhost:${PORT}\n`);
});
