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

// A receiver connection is considered "active" (blocking new joins) only if they
// had a recorded ping within the last 45 seconds AND the room is in active_transfer.
// After 45s of silence we assume the receiver has disconnected / refreshed.
const ACTIVE_RECEIVER_TIMEOUT_MS = 45 * 1000;

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

    const isSameClient = room.receiverClientId === clientId;

    // Determine if the previous receiver is still considered "live":
    // They must have pinged within the last 45s AND the room must be in active_transfer.
    const lastActivity = room.receiverLastActivity ? new Date(room.receiverLastActivity).getTime() : 0;
    const receiverIsLive =
      room.receiverClientId &&
      !isSameClient &&
      room.status === 'active_transfer' &&
      Date.now() - lastActivity < ACTIVE_RECEIVER_TIMEOUT_MS;

    if (receiverIsLive) {
      // A genuinely different, actively-connected receiver is transferring — block.
      await SystemLog.create({
        eventType: 'api_room_full',
        level: 'warn',
        category: 'room',
        roomId,
        clientId,
        message: `API: Room ${roomId} is busy — receiver ${room.receiverClientId.substring(0, 12)} was active ${Math.round((Date.now() - lastActivity) / 1000)}s ago`,
        ip,
      }).catch(() => {});

      return NextResponse.json(
        { error: 'Another receiver is actively transferring in this session.', code: 'ROOM_FULL' },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    // ── Reconnect / fresh join allowed ──
    const isReconnect = Boolean(room.receiverClientId);

    // Capture server-side progress so receiver can restore from it even if IndexedDB was cleared
    const serverProgress = room.receiverProgress
      ? (room.receiverProgress instanceof Map ? Object.fromEntries(room.receiverProgress) : room.receiverProgress)
      : {};

    room.receiverClientId = clientId;
    room.status = 'connected';
    room.receiverLastActivity = new Date();
    await room.save();

    // Signal sender that a receiver (re-)joined
    await Signal.create({
      roomId,
      fromClientId: clientId,
      type: 'receiver-joined',
      payload: { roomId, receiverClientId: clientId, isReconnect },
    });

    await SystemLog.create({
      eventType: isReconnect ? 'api_room_reconnected' : 'api_room_joined',
      level: 'success',
      category: 'room',
      roomId,
      clientId,
      message: isReconnect
        ? `API: Receiver ${clientId.substring(0, 12)} RECONNECTED to room ${roomId}`
        : `API: Receiver ${clientId.substring(0, 12)} joined room ${roomId} (Sender: ${room.senderClientId.substring(0, 12)})`,
      ip,
    }).catch(() => {});

    return NextResponse.json(
      { success: true, room, isReconnect, serverProgress },
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
