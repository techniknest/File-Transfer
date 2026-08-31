import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import SystemLog from '@/models/SystemLog';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin') return null;
  return session;
}

export async function GET(request) {
  try {
    const session = await requireAdmin();
    if (!session) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    await connectDB();

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
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

    if (search) {
      filter.$or = [
        { message: { $regex: search, $options: 'i' } },
        { eventType: { $regex: search, $options: 'i' } },
        { roomId: { $regex: search.toUpperCase(), $options: 'i' } },
        { userEmail: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (page - 1) * limit;

    const [logs, total, totalErrors, totalRooms, totalUsers] = await Promise.all([
      SystemLog.find(filter).sort({ timestamp: -1 }).skip(skip).limit(limit).lean(),
      SystemLog.countDocuments(filter),
      SystemLog.countDocuments({ level: 'error' }),
      SystemLog.distinct('roomId', { roomId: { $ne: null } }),
      SystemLog.distinct('userEmail', { userEmail: { $ne: null } }),
    ]);

    return NextResponse.json({
      logs: logs.map(l => ({
        ...l,
        _id: l._id.toString(),
      })),
      total,
      page,
      pages: Math.ceil(total / limit),
      stats: {
        totalLogs: total,
        totalErrors,
        uniqueRooms: totalRooms.length,
        uniqueUsers: totalUsers.length,
      },
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (error) {
    console.error('[API /admin/logs GET Error]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const session = await requireAdmin();
    if (!session) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    await connectDB();
    const { searchParams } = new URL(request.url);
    const roomId = searchParams.get('roomId');

    if (roomId) {
      await SystemLog.deleteMany({ roomId: roomId.trim().toUpperCase() });
      return NextResponse.json({ message: `Logs for room ${roomId} deleted` });
    }

    // Default: Clear all logs
    await SystemLog.deleteMany({});
    return NextResponse.json({ message: 'All system logs cleared successfully' });
  } catch (error) {
    console.error('[API /admin/logs DELETE Error]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
