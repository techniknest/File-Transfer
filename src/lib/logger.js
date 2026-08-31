/**
 * Universal Telemetry & System Logging Utility
 * Can be called safely from both client components and server route handlers.
 * On Vercel, client-side calls POST to /api/logs via fetch with keepalive.
 * On the server side, logs are written directly to MongoDB (no HTTP round-trip).
 */

export async function logEvent({
  eventType,
  level = 'info',
  category = 'system',
  message,
  roomId = null,
  userEmail = null,
  clientId = null,
  metadata = {},
}) {
  // ── Browser / Client-Side ──
  if (typeof window !== 'undefined') {
    try {
      const cid = clientId || window.sessionStorage?.getItem('p2p_client_id') || null;
      const payload = {
        eventType,
        level,
        category,
        message,
        roomId: roomId ? roomId.trim().toUpperCase() : null,
        userEmail,
        clientId: cid,
        metadata: {
          ...metadata,
          url: window.location.href,
          path: window.location.pathname,
          screen: `${window.innerWidth}x${window.innerHeight}`,
        },
        userAgent: window.navigator?.userAgent || '',
      };

      const bodyStr = JSON.stringify(payload);

      // sendBeacon for page_unload events (zero chance of cancellation)
      if (window.navigator?.sendBeacon && payload.eventType === 'page_unload') {
        const blob = new Blob([bodyStr], { type: 'application/json' });
        window.navigator.sendBeacon('/api/logs', blob);
      } else {
        // Non-blocking fire-and-forget with keepalive for regular events
        fetch('/api/logs', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache',
          },
          body: bodyStr,
          keepalive: true,
          cache: 'no-store',
        }).catch(() => {});
      }
    } catch (_) {}
    return;
  }

  // ── Server-Side (Next.js route handler / Node.js) ──
  // Write directly to MongoDB — no HTTP round-trip needed.
  try {
    const connectDB = (await import('@/lib/mongodb')).default;
    const SystemLog = (await import('@/models/SystemLog')).default;
    await connectDB();
    await SystemLog.create({
      eventType,
      level,
      category,
      message,
      roomId: roomId ? roomId.trim().toUpperCase() : null,
      userEmail: userEmail ? userEmail.trim().toLowerCase() : null,
      clientId,
      metadata,
    });
  } catch (err) {
    // Never throw — logging must never crash the main flow
    console.error('[Logger Server Error]', err.message);
  }
}
