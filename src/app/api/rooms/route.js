import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Room from '@/models/Room';
import Signal from '@/models/Signal';

export async function POST(request) {
  try {
    await connectDB();
    const body = await request.json().catch(() => ({}));
    const rawRoomId = body?.roomId;
    const clientId = body?.clientId;
    const roomId = rawRoomId ? rawRoomId.trim().toUpperCase() : '';

    if (!roomId || !clientId) {
      return NextResponse.json({ error: 'roomId and clientId are required' }, { status: 400 });
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

    return NextResponse.json({ success: true, room });
  } catch (error) {
    console.error('[API /rooms POST] Error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
