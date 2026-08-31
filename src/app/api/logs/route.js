import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import SystemLog from '@/models/SystemLog';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NO_CACHE = {
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  'Pragma': 'no-cache',
};

export async function POST(request) {
  try {
    // Parse body safely
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400, headers: NO_CACHE });
    }

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
      return NextResponse.json(
        { error: 'eventType and message are required' },
        { status: 400, headers: NO_CACHE }
      );
    }

    // Sanitize level — must match enum
    const validLevels = ['info', 'success', 'warn', 'error'];
    const safeLevel = validLevels.includes(level) ? level : 'info';

    // Sanitize category — must match enum
    const validCategories = ['auth', 'navigation', 'file', 'room', 'webrtc', 'transfer', 'system'];
    const safeCategory = validCategories.includes(category) ? category : 'system';

    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'unknown';

    const headerUserAgent = request.headers.get('user-agent') || userAgent || '';

    await connectDB();

    const log = await SystemLog.create({
      eventType: String(eventType).substring(0, 100),
      level: safeLevel,
      category: safeCategory,
      message: String(message).substring(0, 500),
      roomId: roomId ? String(roomId).trim().toUpperCase().substring(0, 20) : null,
      userEmail: userEmail ? String(userEmail).trim().toLowerCase().substring(0, 100) : null,
      clientId: clientId ? String(clientId).substring(0, 100) : null,
      metadata: metadata && typeof metadata === 'object' ? metadata : {},
      userAgent: headerUserAgent.substring(0, 300),
      ip,
      timestamp: new Date(),
    });

    return NextResponse.json(
      { success: true, id: log._id?.toString() },
      { headers: NO_CACHE }
    );
  } catch (error) {
    console.error('[API /api/logs POST Error]', error.message);
    // Still return 200 to client — logging errors must never break the main app
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500, headers: NO_CACHE }
    );
  }
}

// Health check for the logging endpoint itself
export async function GET() {
  try {
    await connectDB();
    const count = await SystemLog.countDocuments({});
    return NextResponse.json(
      { status: 'ok', totalLogs: count },
      { headers: NO_CACHE }
    );
  } catch (error) {
    return NextResponse.json(
      { status: 'error', error: error.message },
      { status: 500, headers: NO_CACHE }
    );
  }
}
