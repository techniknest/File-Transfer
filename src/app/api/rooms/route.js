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
    const files = Array.isArray(body?.files) ? body.files : [];
    const totalSize = Number(body?.totalSize) || 0;
    const fileCount = Number(body?.fileCount) || files.length;
    const roomId = rawRoomId ? rawRoomId.trim().toUpperCase() : '';

    if (!roomId || !clientId) {
      return NextResponse.json(
        { error: 'roomId and clientId are required' },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    console.log('[ROOM] Creating / resuming room:', roomId, 'for clientId:', clientId);

    // If the room already exists (e.g. sender reconnecting/resuming same session),
    // preserve existing receiverProgress and receiverClientId instead of deleting the document.
    let room = await Room.findOne({ roomId });
    if (room) {
      console.log('[ROOM] Re-using existing room for resume:', roomId);
      room.senderClientId = clientId;
      room.status = 'waiting';
      if (files.length > 0) room.files = files;
      if (totalSize > 0) room.totalSize = totalSize;
      if (fileCount > 0) room.fileCount = fileCount;
      await room.save();
    } else {
      room = await Room.create({
        roomId,
        senderClientId: clientId,
        status: 'waiting',
        files,
        totalSize,
        fileCount,
      });
      console.log('[ROOM] Created new room in MongoDB:', room.roomId, 'status:', room.status);
    }

    // Delete any stale signals for this roomId from previous sessions so WebRTC handshake starts fresh
    await Signal.deleteMany({ roomId });

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
    console.error('[ROOM] Error creating room:', error.message);
    return NextResponse.json(
      { error: error.message },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}
