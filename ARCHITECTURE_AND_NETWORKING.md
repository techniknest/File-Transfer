# 🖥️ Nest Desk — System Architecture & Networking Guide

A comprehensive, technical breakdown of **Nest Desk**: how it works, the technologies used, cross-network P2P/NAT traversal mechanisms, and connection optimizations.

---

## 1. System Overview & Architecture

**Nest Desk** is an enterprise-grade, peer-to-peer (P2P) remote desktop solution that allows a **Controller** (desktop client or web browser) to remotely view and control a **Host** computer (screen, keyboard, mouse) in real-time across any network topology—without port forwarding, static IPs, or VPNs.

```
                          ┌──────────────────────────────────────────────┐
                          │         CENTRAL CLOUD BACKEND                │
                          │   Next.js 16 + MongoDB Atlas + Vercel        │
                          │  • Device Registry & Hardware ID Binding    │
                          │  • Authentication (Bcrypt)                   │
                          │  • WebRTC Signaling (SDP Offer/Answer Relay) │
                          └──────────────────────┬───────────────────────┘
                                                 │
                   HTTP/REST (SDP Signaling & Heartbeats via HTTPS)
                                                 │
                 ┌───────────────────────────────┴───────────────────────────────┐
                 ▼                                                               ▼
  ┌─────────────────────────────┐                                 ┌─────────────────────────────┐
  │      HOST MACHINE           │                                 │     CONTROLLER / VIEWER     │
  │   (desktop-agent/app.py)    │                                 │ (desktop-agent OR browser)  │
  │ • Python Tkinter UI         │                                 │ • Tkinter Desktop Viewer OR │
  │ • MSS (Screen Grabber)      │◄═══════════════════════════════►│ • Next.js Web Viewer        │
  │ • PyAV (H.264 Video Track)  │    Direct P2P WebRTC Tunnel     │ • Live HTML5 Video Canvas   │
  │ • PyAutoGUI (Mouse/Keyboard)│    (STUN P2P or TURN Relay)     │ • Low-latency DataChannel   │
  └─────────────────────────────┘                                 └─────────────────────────────┘
```

### Core Subsystems

| Subsystem | Directory / Key File | Role & Responsibilities |
|---|---|---|
| **Host & Desktop Controller** | `desktop-agent/app.py` | Python desktop application. Captures screen frames at ~12–15 FPS, streams H.264 video via WebRTC, listens on data channels to control mouse/keyboard with PyAutoGUI, and includes a built-in remote viewer. |
| **Central Backend & API** | `backend/src/app/api/` | Next.js REST API & MongoDB Atlas database. Handles hardware-based device ID assignment, password verification, device online/offline statuses, and SDP exchange. |
| **Web Portal & Web Viewer** | `web-portal/src/app/connect/page.tsx` | Next.js web portal allowing users to control remote machines directly from any web browser (desktop, tablet, or mobile phone) without installing software. |
| **Environment Settings** | `desktop-agent/settings.py` | Dynamic URL resolution for switching between local (`localhost:3000`) and live production (`https://nestdeskdashboard.vercel.app`). |

---

## 2. Technology Stack

### 🖥️ Desktop Agent (Python 3.10+)
- **GUI Engine**: `tkinter` & `ttk` with Obsidian Cyber-SaaS dark theme styling.
- **WebRTC Protocol**: `aiortc` (AsyncIO WebRTC & ORTC implementation in Python).
- **Fast Screen Capture**: `mss` (ultra-fast screen capture reading direct OS framebuffers in ~5–15ms).
- **Video Processing & Codecs**: `av` (PyAV / FFmpeg bindings) converting RGB frames to `yuv420p` H.264/VP8 video tracks.
- **Input Emulation**: `pyautogui` for mouse coordinates, clicks, multi-button presses, scrolls, and hotkeys (`pyautogui.PAUSE = 0`).
- **System Integration**: `pystray` (system tray minimization), `uuid` and platform registry queries (`/etc/machine-id` on Linux, `MachineGuid` on Windows) for hardware ID persistence.

### 🌐 Backend & Web Portal (TypeScript / Next.js)
- **Framework**: Next.js 16 (App Router) + React 19 + TypeScript.
- **Database**: MongoDB Atlas via official `mongodb` client driver.
- **Security & Cryptography**: `bcryptjs` for salted password hashing and `crypto.randomUUID()` for unique connection tickets.
- **Cloud Assets**: Cloudinary for binary desktop agent installers.
- **Styling**: Vanilla CSS Modules with rich glassmorphism tokens.

---

## 3. How It Works When Devices Are on Different Networks

When devices are on different networks (e.g. Host is on Home Wi-Fi behind a NAT router and Controller is on Mobile 5G or an Office Network), neither has a direct public IP.

Nest Desk resolves this using **WebRTC + ICE + STUN + TURN**:

```
                       ┌─────────────────────────┐
                       │  Nest Desk Cloud API    │
                       │  (Public Signaling Box) │
                       └─────┬─────────────┬─────┘
                             │             │
              1. Register    │             │ 2. Submit SDP Offer
              & Heartbeat    │             │    & Poll
                             ▼             ▼
                      ┌─────────────┐ ┌─────────────┐
                      │ Host Agent  │ │ Controller  │
                      └──────┬──────┘ └──────┬──────┘
                             │               │
        ┌────────────────────┴───────────────┴────────────────────┐
        │ 3. Query Public STUN Servers (Google / Cloudflare)      │
        │    Host & Controller discover their public IPs & Ports  │
        └────────────────────┬───────────────┬────────────────────┘
                             │               │
      4. Direct P2P Punching │               │
         (Host & Srflx)      ▼               ▼
         ════════════════════► 🟢 Direct P2P Connection ◄════════════
                             │ (Full-speed, zero server relay load)
                             │
      5. Fallback for        │
         Strict/Carrier NAT  ▼
         ───────────────────► 🟡 OpenRelay TURN Server ◄─────────────
                             (Relayed over UDP/TCP Port 443 / 80)
```

### Connection Lifecycle

1. **Hardware Binding & Registration**:
   - On boot, the Host obtains its hardware-bound ID (`NDK-XXXX-XXXX`) from `POST /api/devices/assign-id`.
   - The Host sends a heartbeat every 1 second to `POST /api/devices/register`.

2. **Signaling Exchange (Handshake via Cloud Server)**:
   - The Controller enters the Device ID and password, initializes an `RTCPeerConnection`, and creates an **SDP Offer**.
   - The Controller posts this offer to `POST /api/devices/connect`.
   - On the Host's next 1-second heartbeat, the backend delivers the `pendingConnection` containing the Controller's offer.
   - The Host sets the remote SDP, generates an **SDP Answer**, and posts it back via `POST /api/devices/register`.
   - The Controller polls `POST /api/devices/connect` to retrieve the answer and completes the handshake.

3. **STUN (Session Traversal Utilities for NAT)**:
   - Configured in `desktop-agent/app.py` and `web-portal/src/lib/api.ts`:
     - `stun:stun.l.google.com:19302`
     - `stun:stun.cloudflare.com:3478`
     - `stun:openrelay.metered.ca:80`
   - Both devices query the STUN servers: *"What is my public IP address and port as seen from the internet?"*
   - Once discovered, the peers exchange these candidates and attempt direct UDP hole punching. If successful, **traffic flows directly peer-to-peer with minimal latency and zero relay overhead**.

4. **TURN Fallback (Traversal Using Relays around NAT)**:
   - If one or both devices are behind **Symmetric NAT**, **CGNAT (Carrier-Grade Mobile NAT)**, or **Strict Corporate Firewalls**, direct UDP hole punching fails.
   - Nest Desk includes TURN relay servers (`turn:openrelay.metered.ca:80` and `turn:openrelay.metered.ca:443?transport=tcp`).
   - In strict network scenarios, WebRTC routes encrypted video and control data packets through the TURN relay over standard HTTPS ports (443 / 80), ensuring connections always establish.

---

## 4. Performance Optimizations (How Connection Works Best)

### 1. Low-Latency Video Pipeline
- **Fast Frame Capture**: `ScreenCaptureTrack` grabs the monitor framebuffer using `mss` in a dedicated background thread without blocking the GUI.
- **Resolution Capping (1280px)**: The capture stream dynamically downscales displays wider than 1280px. This prevents frame buffer bloat and mobile browser decoder crashes.
- **H.264 Hardware Acceleration & Codec Ordering**: The host explicitly prefers H.264 via `transceiver.setCodecPreferences(prefs)`, ensuring smooth hardware decoding on Safari, iOS, and Android mobile devices.
- **Bitrate Throttling (1.2 Mbps)**: Outbound bitrate is capped via `RTCRtpEncodingParameters(maxBitrate=1_200_000)`, preventing packet loss and buffer congestion over mobile data.

### 2. High-Performance Input Control
- **Ordered RTCDataChannel**: Control signals (mouse movements, clicks, keyboard events) bypass HTTP and flow directly through an ordered WebRTC data channel (`control`).
- **Normalized Coordinates**: Mouse movements transmit normalized floats `x: 0.0 - 1.0, y: 0.0 - 1.0`, allowing controllers with different screen resolutions to map precisely onto the host screen.
- **Zero-Delay Dispatch**: `pyautogui.PAUSE = 0` and `pyautogui.FAILSAFE = False` ensure input events execute with zero artificial sleep delays.

### 3. Fast Handshake & Network Resilience
- **1-Second Polling Loop**: The host agent polls for pending offers every 1 second (reduced from legacy 3s), initiating remote sessions in ~1–2 seconds.
- **Extended ICE Gathering Window (12s)**: Gives STUN and TURN TCP relays enough time to resolve candidates on slow mobile carrier links.
- **6-Second Grace Window**: The host tolerates brief network flaps (`iceConnectionState == 'failed'`) for up to 6 seconds before disconnecting, allowing TURN relays to recover if a mobile device switches towers or toggles Wi-Fi.

---

## 5. Summary Flow Table

| Action | Transport | Protocol | Latency |
|---|---|---|---|
| **Device Discovery & ID Assignment** | HTTPS | REST (`/api/devices/assign-id`) | ~100–300ms |
| **Authentication & Heartbeat** | HTTPS | REST (`/api/devices/register`) | 1s interval |
| **SDP Offer / Answer Signaling** | HTTPS | REST (`/api/devices/connect`) | ~1–2s initial |
| **NAT Discovery** | UDP | STUN (Google / Cloudflare) | ~20–50ms |
| **Screen Video Stream** | P2P UDP (or TURN Relay) | WebRTC MediaStream (H.264/VP8) | ~30–80ms |
| **Mouse / Keyboard Commands** | P2P UDP (or TURN Relay) | WebRTC DataChannel (JSON) | ~10–30ms |
