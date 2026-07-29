import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Room from '@/models/Room';

export async function GET(request, { params }) {
  try {
    await connectDB();
    const { roomId } = await params;

    const room = await Room.findOne({ roomId }).lean();

    if (!room) {
      return NextResponse.json({ error: 'Room not found', status: 'not-found' }, { status: 404 });
    }

    return NextResponse.json({
      exists: true,
      status: room.status,
      senderClientId: room.senderClientId,
      receiverClientId: room.receiverClientId,
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
