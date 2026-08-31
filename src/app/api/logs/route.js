import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import SystemLog from '@/models/SystemLog';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request) {
  try {
    await connectDB();
    const body = await request.json().catch(() => ({}));
    const {
      eventType,
      level = 'info',
      category = 'system',
      message,
      roomId = null,
      userEmail = null,
      clientId = null,
      metadata = {},
      userAgent = '',
    } = body;

    if (!eventType || !message) {
      return NextResponse.json({ error: 'eventType and message are required' }, { status: 400 });
    }

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'unknown';
    const headerUserAgent = request.headers.get('user-agent') || userAgent;

    const log = await SystemLog.create({
      eventType,
      level,
      category,
      message,
      roomId: roomId ? roomId.trim().toUpperCase() : null,
      userEmail: userEmail ? userEmail.trim().toLowerCase() : null,
      clientId,
      metadata,
      userAgent: headerUserAgent,
      ip,
    });

    return NextResponse.json({ success: true, id: log._id });
  } catch (error) {
    console.error('[API /api/logs POST Error]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
