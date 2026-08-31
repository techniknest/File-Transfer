import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Room from '@/models/Room';
import Signal from '@/models/Signal';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
};

export async function POST(request, { params }) {
  try {
    await connectDB();
    const resolvedParams = await params;
    const rawRoomId = resolvedParams?.roomId;
    const roomId = rawRoomId ? decodeURIComponent(rawRoomId).trim().toUpperCase() : '';
    const body = await request.json().catch(() => ({}));
    const clientId = body?.clientId;

    if (!clientId) {
      return NextResponse.json(
        { error: 'clientId is required', code: 'CLIENT_ID_REQUIRED' },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    if (!roomId) {
      return NextResponse.json(
        { error: 'roomId is required', code: 'ROOM_ID_REQUIRED' },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    const room = await Room.findOne({ roomId });

    if (!room) {
      return NextResponse.json(
        { error: `Room ${roomId} not found. Please verify the room code or ask the sender to generate a fresh link.`, code: 'ROOM_NOT_FOUND' },
        { status: 404, headers: NO_CACHE_HEADERS }
      );
    }

    if (room.receiverClientId && room.receiverClientId !== clientId) {
      return NextResponse.json(
        { error: 'Another receiver is already connected to this transfer session.', code: 'ROOM_FULL' },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    room.receiverClientId = clientId;
    room.status = 'connected';
    await room.save();

    // Create a receiver-joined signal for the sender
    await Signal.create({
      roomId,
      fromClientId: clientId,
      type: 'receiver-joined',
      payload: { roomId, receiverClientId: clientId },
    });

    return NextResponse.json(
      { success: true, room },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (error) {
    console.error('[API /rooms/[roomId]/join] Error:', error.message);
    return NextResponse.json(
      { error: error.message || 'Internal server error while joining room' },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}
