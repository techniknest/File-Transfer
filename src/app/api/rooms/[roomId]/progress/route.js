import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Room from '@/models/Room';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
};

/**
 * PATCH /api/rooms/:roomId/progress
 * Called by the receiver periodically to persist its current chunk progress.
 * Body: { clientId, progress: { "0": 1024, "1": 512 } }  (fileIndex → chunks received)
 * Also refreshes receiverLastActivity so the room knows this receiver is still alive.
 */
export async function PATCH(request, { params }) {
  try {
    await connectDB();
    const resolvedParams = await params;
    const roomId = resolvedParams?.roomId
      ? decodeURIComponent(resolvedParams.roomId).trim().toUpperCase()
      : '';

    if (!roomId) {
      return NextResponse.json({ error: 'roomId is required' }, { status: 400, headers: NO_CACHE_HEADERS });
    }

    const body = await request.json().catch(() => ({}));
    const { clientId, progress } = body;

    if (!clientId || !progress || typeof progress !== 'object') {
      return NextResponse.json({ error: 'clientId and progress are required' }, { status: 400, headers: NO_CACHE_HEADERS });
    }

    // Only update if the requestor is the current receiver of this room
    const room = await Room.findOne({ roomId });
    if (!room) {
      return NextResponse.json({ error: 'Room not found', code: 'ROOM_NOT_FOUND' }, { status: 404, headers: NO_CACHE_HEADERS });
    }

    // Accept update from current receiver OR from the previous receiver if it just reconnected
    // (identified by the fact it's sending progress for the right room)
    room.receiverProgress = new Map(Object.entries(progress).map(([k, v]) => [k, Number(v)]));
    room.receiverLastActivity = new Date();
    // Mark room as active_transfer once progress is being reported
    if (room.status === 'connected') {
      room.status = 'active_transfer';
    }
    await room.save();

    return NextResponse.json({ success: true }, { headers: NO_CACHE_HEADERS });
  } catch (error) {
    console.error('[API /rooms/progress] Error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500, headers: NO_CACHE_HEADERS });
  }
}
