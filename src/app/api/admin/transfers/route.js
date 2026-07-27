import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import TransferRecord from '@/models/TransferRecord';

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
    const limit = parseInt(searchParams.get('limit') || '15');
    const status = searchParams.get('status') || '';
    const search = searchParams.get('search') || '';
    const startDate = searchParams.get('startDate') || '';
    const endDate = searchParams.get('endDate') || '';
    
    const skip = (page - 1) * limit;

    const filter = {};

    if (status) {
      filter.status = status;
    }

    if (search) {
      filter.$or = [
        { roomId: { $regex: search, $options: 'i' } },
        { senderEmail: { $regex: search, $options: 'i' } },
        { receiverEmail: { $regex: search, $options: 'i' } },
        { 'files.fileName': { $regex: search, $options: 'i' } }
      ];
    }

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) {
        filter.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        // Set end date to end of that day
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = end;
      }
    }

    const [records, total] = await Promise.all([
      TransferRecord.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      TransferRecord.countDocuments(filter)
    ]);

    const transformed = records.map(r => ({
      ...r,
      _id: r._id?.toString(),
      linkId: r.roomId,
      fileCount: r.files?.length || 0,
      fileNames: r.files?.map(f => f.fileName) || [],
      senderName: r.senderEmail?.split('@')[0] || 'Unknown',
    }));

    return NextResponse.json({
      records: transformed,
      total,
      page,
      pages: Math.ceil(total / limit)
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
