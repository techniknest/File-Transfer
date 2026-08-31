/**
 * Universal Telemetry & System Logging Utility
 * Can be called safely from both client components and server route handlers.
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
  // If running in browser / client-side
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

      // Use sendBeacon if available for non-blocking unload safety, otherwise fetch
      const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
      if (window.navigator?.sendBeacon && payload.eventType === 'page_unload') {
        window.navigator.sendBeacon('/api/logs', blob);
      } else {
        fetch('/api/logs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          keepalive: true,
        }).catch(() => {});
      }
    } catch (_) {}
    return;
  }

  // If running on server-side (Node.js/Next.js route handlers)
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
      userEmail,
      clientId,
      metadata,
    });
  } catch (err) {
    console.error('[Logger Server Error]', err.message);
  }
}
