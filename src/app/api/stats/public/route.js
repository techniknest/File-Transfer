import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import TransferRecord from '@/models/TransferRecord';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await connectDB();

    const [totalUsers, totalDataAgg] = await Promise.all([
      User.countDocuments({}),
      TransferRecord.aggregate([
        { $group: { _id: null, totalBytes: { $sum: '$totalSize' } } }
      ])
    ]);

    const totalBytes = totalDataAgg?.length > 0 ? (totalDataAgg[0]?.totalBytes || 0) : 0;
    
    // Format bytes
    let totalDataFormatted = '0 GB';
    if (totalBytes > 0) {
      if (totalBytes < 1073741824) {
        totalDataFormatted = `${(totalBytes / 1048576).toFixed(1)} MB`;
      } else if (totalBytes < 1099511627776) {
        totalDataFormatted = `${(totalBytes / 1073741824).toFixed(1)} GB`;
      } else {
        totalDataFormatted = `${(totalBytes / 1099511627776).toFixed(1)} TB`;
      }
    }

    return NextResponse.json({
      totalUsers: totalUsers || 0,
      totalDataFormatted,
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
