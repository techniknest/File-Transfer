const { io } = require("socket.io-client");
const socket = io("http://localhost:3000", { transports: ['websocket'] });

socket.on('connect', () => {
  console.log('Connected with ID:', socket.id);
  socket.emit('join-room', 'TESTROOM');
});

socket.on('room-not-found', () => {
  console.log('Received: room-not-found');
  process.exit(0);
});

socket.on('joined-as-receiver', () => {
  console.log('Received: joined-as-receiver');
  process.exit(0);
});

socket.on('connect_error', (err) => {
  console.error('Connect error:', err);
  process.exit(1);
});

setTimeout(() => {
  console.log('Timeout waiting for response');
  process.exit(1);
}, 5000);
