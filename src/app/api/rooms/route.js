import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Room from '@/models/Room';
import Signal from '@/models/Signal';
import SystemLog from '@/models/SystemLog';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
};

export async function POST(request) {
  try {
    await connectDB();
    const body = await request.json().catch(() => ({}));
    const rawRoomId = body?.roomId;
    const clientId = body?.clientId;
    const roomId = rawRoomId ? rawRoomId.trim().toUpperCase() : '';

    if (!roomId || !clientId) {
      return NextResponse.json(
        { error: 'roomId and clientId are required' },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    // Clean up any existing room with same ID
    await Room.deleteOne({ roomId });

    // Delete any stale signals for this roomId from previous sessions
    await Signal.deleteMany({ roomId });

    const room = await Room.create({
      roomId,
      senderClientId: clientId,
      status: 'waiting',
    });

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    await SystemLog.create({
      eventType: 'api_room_created',
      level: 'info',
      category: 'room',
      roomId,
      clientId,
      message: `API: Created transfer room ${roomId} for sender ${clientId.substring(0, 12)}`,
      ip,
    }).catch(() => {});

    return NextResponse.json(
      { success: true, room },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (error) {
    console.error('[API /rooms POST] Error:', error.message);
    return NextResponse.json(
      { error: error.message },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}
