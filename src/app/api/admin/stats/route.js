import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import TransferRecord from '@/models/TransferRecord';
import SystemLog from '@/models/SystemLog';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    const userEmail = session?.user?.email?.trim().toLowerCase();

    if (!session || (session.user.role !== 'admin' && (!adminEmail || userEmail !== adminEmail))) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    await connectDB();

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      activeUsers,
      suspendedUsers,
      newUsersThisWeek,
      totalTransfers,
      successTransfers,
      failedTransfers,
      inProgressTransfers,
      totalDataAgg,
      transfersByDayAgg,
      recentErrors,
    ] = await Promise.all([
      User.countDocuments({}),
      User.countDocuments({ status: 'active' }),
      User.countDocuments({ status: 'suspended' }),
      User.countDocuments({ createdAt: { $gte: sevenDaysAgo } }),
      TransferRecord.countDocuments({}),
      TransferRecord.countDocuments({ status: 'completed' }),
      TransferRecord.countDocuments({ status: 'failed' }),
      TransferRecord.countDocuments({ status: 'in_progress' }),
      TransferRecord.aggregate([
        { $group: { _id: null, totalBytes: { $sum: '$totalSize' } } }
      ]),
      // Group transfers by day for the last 7 days
      TransferRecord.aggregate([
        { $match: { createdAt: { $gte: sevenDaysAgo } } },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
            },
            count: { $sum: 1 },
            bytes: { $sum: '$totalSize' },
          }
        },
        { $sort: { _id: 1 } }
      ]),
      SystemLog.find({ level: 'error' }).sort({ timestamp: -1 }).limit(10).lean(),
    ]);

    // Build last 7 days chart data (fill in missing days with 0)
    const chartData = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().slice(0, 10); // YYYY-MM-DD
      const found = transfersByDayAgg.find(x => x._id === key);
      chartData.push({
        date: key,
        day: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
        transfers: found?.count || 0,
        bytes: found?.bytes || 0,
      });
    }

    // Active sockets from global state
    const rooms = global._p2pRooms?.() || {};
    const activeSessions = Object.keys(rooms).length;

    const totalBytes = totalDataAgg?.length > 0 ? (totalDataAgg[0]?.totalBytes || 0) : 0;
    const successRate = totalTransfers > 0 ? Math.round((successTransfers / totalTransfers) * 100) : 0;

    return NextResponse.json({
      users: { totalUsers, activeUsers, suspendedUsers, newUsersThisWeek },
      transfers: { totalTransfers, successTransfers, failedTransfers, inProgressTransfers, successRate, totalBytes, activeSessions },
      chartData,
      recentErrors,
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
