import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import TransferRecord from '@/models/TransferRecord';
import { getServerSession } from 'next-auth';

export async function GET(request) {
  try {
    await connectDB();
    const session = await getServerSession();

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const statusFilter = searchParams.get('status') || '';
    const skip = (page - 1) * limit;

    const filter = {};
    if (statusFilter) filter.status = statusFilter;

    // Non-admins can only see their own records
    if (session && session.user.role !== 'admin') {
      filter.senderEmail = session.user.email;
    }

    const [records, total] = await Promise.all([
      TransferRecord.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      TransferRecord.countDocuments(filter),
    ]);

    // Transform for frontend compatibility
    const transformed = records.map(r => ({
      ...r,
      _id: r._id?.toString(),
      linkId: r.roomId,
      fileCount: r.files?.length || 0,
      fileNames: r.files?.map(f => f.fileName) || [],
      senderName: r.senderEmail?.split('@')[0] || 'Unknown',
    }));

    return NextResponse.json({ records: transformed, total, page, pages: Math.ceil(total / limit) });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    await connectDB();
    const { roomId, senderEmail, files, totalSize } = await request.json();

    if (!roomId || !senderEmail) {
      return NextResponse.json({ error: 'roomId and senderEmail are required' }, { status: 400 });
    }

    const record = await TransferRecord.create({
      roomId,
      senderEmail: senderEmail || 'anonymous',
      files: files || [],
      totalSize: totalSize || 0,
      status: 'completed',
    });

    return NextResponse.json({ success: true, record });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}