import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Room from '@/models/Room';
import Signal from '@/models/Signal';

export async function POST(request, { params }) {
  try {
    await connectDB();
    const resolvedParams = await params;
    const rawRoomId = resolvedParams?.roomId;
    const roomId = rawRoomId ? rawRoomId.trim().toUpperCase() : '';
    const body = await request.json().catch(() => ({}));
    const clientId = body?.clientId;

    if (!clientId) {
      return NextResponse.json({ error: 'clientId is required' }, { status: 400 });
    }

    if (!roomId) {
      return NextResponse.json({ error: 'roomId is required' }, { status: 400 });
    }

    const room = await Room.findOne({ roomId });

    if (!room) {
      return NextResponse.json({ error: 'Room not found', code: 'ROOM_NOT_FOUND' }, { status: 404 });
    }

    if (room.receiverClientId && room.receiverClientId !== clientId) {
      return NextResponse.json({ error: 'Room is full', code: 'ROOM_FULL' }, { status: 400 });
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

    return NextResponse.json({ success: true, room });
  } catch (error) {
    console.error('[API /rooms/[roomId]/join] Error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
