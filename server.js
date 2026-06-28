const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');
const { initSocketHandlers } = require('./src/socket/socketHandler');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  const io = new Server(httpServer, {
    cors: { origin: '*' },
    maxHttpBufferSize: 1e8
  });

  initSocketHandlers(io);

  httpServer.listen(3000, () => {
    console.log('> Ready on http://localhost:3000');
  });
});