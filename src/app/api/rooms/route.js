import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Room from '@/models/Room';
import Signal from '@/models/Signal';

export async function POST(request) {
  try {
    await connectDB();
    const { roomId, clientId } = await request.json();

    if (!roomId || !clientId) {
      return NextResponse.json({ error: 'roomId and clientId are required' }, { status: 400 });
    }

    // Clean up any existing room with same ID
    await Room.deleteOne({ roomId });

    // FIX: Also delete any stale signals for this roomId from previous sessions.
    // Without this, a re-used roomId can pick up ghost signals (old offer/answer/
    // ice-candidate entries) which confuse the WebRTC negotiation.
    await Signal.deleteMany({ roomId });

    const room = await Room.create({
      roomId,
      senderClientId: clientId,
      status: 'waiting',
    });

    return NextResponse.json({ success: true, room });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
