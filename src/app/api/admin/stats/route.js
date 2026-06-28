import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import TransferRecord from '@/models/TransferRecord';

export async function GET() {
  try {
    const session = await getServerSession();
    if (!session || session.user.role !== 'admin') {
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
    ] = await Promise.all([
      User.countDocuments({}),
      User.countDocuments({ status: 'active' }),
      User.countDocuments({ status: 'suspended' }),
      User.countDocuments({ createdAt: { $gte: sevenDaysAgo } }),
      TransferRecord.countDocuments({}),
      TransferRecord.countDocuments({ status: 'completed' }),
      TransferRecord.countDocuments({ status: 'failed' }),
      TransferRecord.countDocuments({ status: 'in_progress' }),
      TransferRecord.aggregate([{ $group: { _id: null, totalBytes: { $sum: '$totalSize' } } }]),
    ]);

    // Active sockets (from global state set by socket handler)
    const rooms = global._p2pRooms?.() || {};
    const activeSessions = Object.keys(rooms).length;

    const totalBytes = totalDataAgg[0]?.totalBytes || 0;
    const successRate = totalTransfers > 0 ? Math.round((successTransfers / totalTransfers) * 100) : 0;

    return NextResponse.json({
      users: { totalUsers, activeUsers, suspendedUsers, newUsersThisWeek },
      transfers: { totalTransfers, successTransfers, failedTransfers, inProgressTransfers, successRate, totalBytes, activeSessions },
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
