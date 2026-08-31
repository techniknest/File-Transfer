import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import SystemLog from '@/models/SystemLog';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NO_CACHE = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  'Pragma': 'no-cache',
  'Expires': '0',
};

async function requireAdmin(request) {
  try {
    const session = await getServerSession(authOptions);
    if (session && session.user?.role === 'admin') return session;
  } catch (e) {
    console.error('[AdminLogs] getServerSession error:', e.message);
  }
  return null;
}

export async function GET(request) {
  try {
    const session = await requireAdmin(request);
    if (!session) {
      return NextResponse.json(
        { error: 'Admin access required. Please log in as admin.' },
        { status: 403, headers: NO_CACHE }
      );
    }

    await connectDB();

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200);
    const category = searchParams.get('category') || '';
    const level = searchParams.get('level') || '';
    const roomId = searchParams.get('roomId') || '';
    const userEmail = searchParams.get('userEmail') || '';
    const search = searchParams.get('search') || '';

    const filter = {};

    if (category && category !== 'all') filter.category = category;
    if (level && level !== 'all') filter.level = level;
    if (roomId) filter.roomId = roomId.trim().toUpperCase();
    if (userEmail) filter.userEmail = { $regex: userEmail.trim(), $options: 'i' };

    if (search && search.trim()) {
      const searchTrimmed = search.trim();
      filter.$or = [
        { message: { $regex: searchTrimmed, $options: 'i' } },
        { eventType: { $regex: searchTrimmed, $options: 'i' } },
        { roomId: { $regex: searchTrimmed.toUpperCase(), $options: 'i' } },
        { userEmail: { $regex: searchTrimmed, $options: 'i' } },
        { 'metadata.path': { $regex: searchTrimmed, $options: 'i' } },
      ];
    }

    const skip = (page - 1) * limit;

    const [logs, total, totalErrors, roomIds, userEmails] = await Promise.all([
      SystemLog.find(filter)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      SystemLog.countDocuments(filter),
      SystemLog.countDocuments({ level: 'error' }),
      SystemLog.distinct('roomId', { roomId: { $ne: null } }),
      SystemLog.distinct('userEmail', { userEmail: { $ne: null } }),
    ]);

    const serializedLogs = logs.map((l) => ({
      ...l,
      _id: l._id?.toString(),
      timestamp: l.timestamp ? new Date(l.timestamp).toISOString() : null,
    }));

    return NextResponse.json(
      {
        logs: serializedLogs,
        total,
        page,
        pages: Math.ceil(total / limit) || 1,
        stats: {
          totalLogs: total,
          totalErrors,
          uniqueRooms: roomIds.length,
          uniqueUsers: userEmails.length,
        },
      },
      { headers: NO_CACHE }
    );
  } catch (error) {
    console.error('[API /admin/logs GET Error]', error.message, error.stack);
    return NextResponse.json(
      { error: error.message, stack: process.env.NODE_ENV === 'development' ? error.stack : undefined },
      { status: 500, headers: NO_CACHE }
    );
  }
}

export async function DELETE(request) {
  try {
    const session = await requireAdmin(request);
    if (!session) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403, headers: NO_CACHE }
      );
    }

    await connectDB();
    const { searchParams } = new URL(request.url);
    const roomId = searchParams.get('roomId');

    if (roomId) {
      const result = await SystemLog.deleteMany({ roomId: roomId.trim().toUpperCase() });
      return NextResponse.json(
        { message: `Deleted ${result.deletedCount} logs for room ${roomId}` },
        { headers: NO_CACHE }
      );
    }

    const result = await SystemLog.deleteMany({});
    return NextResponse.json(
      { message: `All ${result.deletedCount} system logs cleared successfully` },
      { headers: NO_CACHE }
    );
  } catch (error) {
    console.error('[API /admin/logs DELETE Error]', error.message);
    return NextResponse.json(
      { error: error.message },
      { status: 500, headers: NO_CACHE }
    );
  }
}
