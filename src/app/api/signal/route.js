import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Signal from '@/models/Signal';

export async function POST(request) {
  try {
    await connectDB();
    const body = await request.json().catch(() => ({}));
    const rawRoomId = body?.roomId;
    const clientId = body?.clientId;
    const type = body?.type;
    const payload = body?.payload;
    const roomId = rawRoomId ? rawRoomId.trim().toUpperCase() : '';

    if (!roomId || !clientId || !type) {
      return NextResponse.json({ error: 'roomId, clientId, and type are required' }, { status: 400 });
    }

    const signal = await Signal.create({
      roomId,
      fromClientId: clientId,
      type,
      payload,
    });

    return NextResponse.json({ success: true, signalId: signal._id });
  } catch (error) {
    console.error('[API /signal POST] Error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(request) {
  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const rawRoomId = searchParams.get('roomId');
    const roomId = rawRoomId ? rawRoomId.trim().toUpperCase() : '';
    const clientId = searchParams.get('clientId');

    if (!roomId || !clientId) {
      return NextResponse.json({ error: 'roomId and clientId are required' }, { status: 400 });
    }

    // Find signals in this room NOT sent by this client and NOT yet consumed by this client
    const signals = await Signal.find({
      roomId,
      fromClientId: { $ne: clientId },
      consumedBy: { $ne: clientId },
    }).sort({ createdAt: 1 }).lean();

    if (signals.length > 0) {
      const signalIds = signals.map(s => s._id);
      await Signal.updateMany(
        { _id: { $in: signalIds } },
        { $addToSet: { consumedBy: clientId } }
      );
    }

    return NextResponse.json({ signals });
  } catch (error) {
    console.error('[API /signal GET] Error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
