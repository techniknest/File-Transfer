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

export async function POST(request, { params }) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
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
      await SystemLog.create({
        eventType: 'api_room_not_found',
        level: 'warn',
        category: 'room',
        roomId,
        clientId,
        message: `API: Receiver ${clientId.substring(0, 12)} attempted to join non-existent room: ${roomId}`,
        ip,
      }).catch(() => {});

      return NextResponse.json(
        { error: `Room ${roomId} not found. Please verify the room code or ask the sender to generate a fresh link.`, code: 'ROOM_NOT_FOUND' },
        { status: 404, headers: NO_CACHE_HEADERS }
      );
    }

    if (room.receiverClientId && room.receiverClientId !== clientId) {
      await SystemLog.create({
        eventType: 'api_room_full',
        level: 'warn',
        category: 'room',
        roomId,
        clientId,
        message: `API: Room ${roomId} is full (already has receiver ${room.receiverClientId.substring(0, 12)})`,
        ip,
      }).catch(() => {});

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

    await SystemLog.create({
      eventType: 'api_room_joined',
      level: 'success',
      category: 'room',
      roomId,
      clientId,
      message: `API: Receiver ${clientId.substring(0, 12)} joined room ${roomId} (Sender: ${room.senderClientId.substring(0, 12)})`,
      ip,
    }).catch(() => {});

    return NextResponse.json(
      { success: true, room },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (error) {
    console.error('[API /rooms/[roomId]/join] Error:', error.message);
    await SystemLog.create({
      eventType: 'api_join_error',
      level: 'error',
      category: 'room',
      message: `API join error: ${error.message}`,
      ip,
    }).catch(() => {});

    return NextResponse.json(
      { error: error.message || 'Internal server error while joining room' },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}
