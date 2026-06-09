# ⚡ P2P Large File Transfer System
**By TechniKnest** — Peer-to-peer direct file transfer using WebRTC + Socket.io

---

## 🚀 Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Start the server
node server.js

# 3. Open in browser
# Sender:   http://localhost:3000
# Receiver: http://localhost:3000/?room=<roomId>
```

---

## 📁 Project Structure

```
p2p-file-transfer/
├── public/
│   ├── index.html     ← Frontend UI
│   ├── style.css      ← Dark theme styling
│   └── app.js         ← WebRTC + transfer logic
├── server.js          ← Signaling server (Socket.io)
├── package.json
└── README.md
```

---

## ✅ Features

- ✅ No cloud storage — files transfer directly P2P
- ✅ No file size limit (tested with 1GB+)
- ✅ Chunked transfer (64KB chunks via WebRTC DataChannel)
- ✅ Real-time progress bar (%, MB, speed, ETA)
- ✅ Resumable on connection drop
- ✅ Multi-file queue (bonus feature)
- ✅ Auto file download on receiver side
- ✅ Clean dark UI, mobile responsive
- ✅ Works across different networks (STUN)

---

## 🔧 How It Works

```
Sender ──── Socket.io signaling ──── Receiver
              (offer/answer/ICE)

After handshake:
Sender ════════ WebRTC DataChannel ════════ Receiver
                (direct P2P, no server)
```

1. Sender picks files → unique room ID generated
2. Sender shares link with receiver
3. WebRTC handshake via Socket.io (STUN for NAT traversal)
4. Direct P2P connection established
5. File chunks sent over DataChannel (64KB each)
6. Receiver reconstructs file → auto-downloads

---

## 🌐 Deploy to Production

```bash
# Set PORT env variable
PORT=8080 node server.js

# Or use PM2 for production
npm install -g pm2
pm2 start server.js --name p2p-transfer
```

For cross-network transfers outside LAN, deploy the signaling server to a VPS (Render, Railway, DigitalOcean, etc.) and update the socket connection URL in app.js.

---

## 📦 Dependencies

| Package | Purpose |
|---------|---------|
| express | Static file server |
| socket.io | WebRTC signaling |
| uuid | Unique room IDs |
