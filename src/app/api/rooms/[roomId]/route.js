import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Room from '@/models/Room';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
};

export async function GET(request, { params }) {
  try {
    await connectDB();
    const resolvedParams = await params;
    const rawRoomId = resolvedParams?.roomId;
    const roomId = rawRoomId ? decodeURIComponent(rawRoomId).trim().toUpperCase() : '';

    if (!roomId) {
      return NextResponse.json(
        { error: 'Room ID is required', status: 'not-found' },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    const room = await Room.findOne({ roomId }).lean();

    if (!room) {
      return NextResponse.json(
        { error: 'Room not found', status: 'not-found' },
        { status: 404, headers: NO_CACHE_HEADERS }
      );
    }

    return NextResponse.json(
      {
        exists: true,
        status: room.status,
        senderClientId: room.senderClientId,
        receiverClientId: room.receiverClientId,
      },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (error) {
    console.error('[API /rooms/[roomId] GET] Error:', error.message);
    return NextResponse.json(
      { error: error.message },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}
