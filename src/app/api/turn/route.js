import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const DEFAULT_ICE_SERVERS = [
  // Google Public STUN
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
  // Cloudflare Public STUN
  { urls: 'stun:stun.cloudflare.com:3478' },
  // OpenRelay Public STUN & TURN
  { urls: 'stun:openrelay.metered.ca:80' },
  { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
  { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
  { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' },
];

export async function GET() {
  const meteredDomain = process.env.METERED_DOMAIN;
  const meteredApiKey = process.env.METERED_API_KEY;

  if (meteredDomain && meteredApiKey) {
    try {
      const response = await fetch(
        `https://${meteredDomain}/api/v1/turn/credentials?apiKey=${meteredApiKey}`,
        { cache: 'no-store' }
      );

      if (response.ok) {
        const iceServers = await response.json();
        if (Array.isArray(iceServers) && iceServers.length > 0) {
          return NextResponse.json(
            { iceServers },
            {
              headers: {
                'Cache-Control': 'no-store, no-cache, must-revalidate',
              },
            }
          );
        }
      }
    } catch (error) {
      console.warn('[API /turn] Failed to fetch ephemeral Metered TURN credentials, falling back to defaults:', error.message);
    }
  }

  // Fallback to default STUN + Public TURN
  return NextResponse.json(
    { iceServers: DEFAULT_ICE_SERVERS },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    }
  );
}
