import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import connectDB from '@/lib/mongodb';
import TransferRecord from '@/models/TransferRecord';

export async function GET(request) {
  try {
    const session = await getServerSession();
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    await connectDB();

    const now = new Date();
    const startOfDay = new Date(now); startOfDay.setHours(0, 0, 0, 0);
    const startOfWeek = new Date(now); startOfWeek.setDate(now.getDate() - 7);
    const startOfMonth = new Date(now); startOfMonth.setDate(1); startOfMonth.setHours(0, 0, 0, 0);

    const [
      totalTransfers,
      successTransfers,
      failedTransfers,
      totalDataAgg,
      dailyAgg,
      weeklyAgg,
      monthlyAgg,
      statusBreakdown,
    ] = await Promise.all([
      TransferRecord.countDocuments({}),
      TransferRecord.countDocuments({ status: 'completed' }),
      TransferRecord.countDocuments({ status: 'failed' }),

      // Total data
      TransferRecord.aggregate([
        { $group: { _id: null, totalBytes: { $sum: '$totalSize' } } },
      ]),

      // Daily (last 24h)
      TransferRecord.aggregate([
        { $match: { createdAt: { $gte: startOfDay } } },
        { $group: { _id: { $hour: '$createdAt' }, count: { $sum: 1 }, bytes: { $sum: '$totalSize' } } },
        { $sort: { '_id': 1 } },
      ]),

      // Weekly (last 7 days)
      TransferRecord.aggregate([
        { $match: { createdAt: { $gte: startOfWeek } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 },
            bytes: { $sum: '$totalSize' },
          }
        },
        { $sort: { '_id': 1 } },
      ]),

      // Monthly (last 30 days by day)
      TransferRecord.aggregate([
        { $match: { createdAt: { $gte: startOfMonth } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 },
            bytes: { $sum: '$totalSize' },
          }
        },
        { $sort: { '_id': 1 } },
      ]),

      // Status breakdown
      TransferRecord.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
    ]);

    const totalBytes = totalDataAgg[0]?.totalBytes || 0;
    const successRate = totalTransfers > 0 ? Math.round((successTransfers / totalTransfers) * 100) : 0;

    return NextResponse.json({
      summary: {
        totalTransfers,
        successTransfers,
        failedTransfers,
        totalBytes,
        successRate,
      },
      charts: {
        daily: dailyAgg,
        weekly: weeklyAgg,
        monthly: monthlyAgg,
        statusBreakdown,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
