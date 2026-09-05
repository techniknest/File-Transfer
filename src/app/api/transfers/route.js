import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import TransferRecord from '@/models/TransferRecord';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request) {
  try {
    await connectDB();
    const session = await getServerSession(authOptions);

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const statusFilter = searchParams.get('status') || '';
    const typeFilter = searchParams.get('type') || 'all'; // 'all' | 'sent' | 'received'
    const skip = (page - 1) * limit;

    const filter = {};
    if (statusFilter) filter.status = statusFilter;

    if (session && session.user.role !== 'admin') {
      const userEmail = session.user.email?.toLowerCase();
      if (typeFilter === 'sent') {
        filter.senderEmail = { $regex: new RegExp(`^${userEmail}$`, 'i') };
      } else if (typeFilter === 'received') {
        filter.receiverEmail = { $regex: new RegExp(`^${userEmail}$`, 'i') };
      } else {
        filter.$or = [
          { senderEmail: { $regex: new RegExp(`^${userEmail}$`, 'i') } },
          { receiverEmail: { $regex: new RegExp(`^${userEmail}$`, 'i') } },
        ];
      }
    } else if (!session) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const [records, total] = await Promise.all([
      TransferRecord.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      TransferRecord.countDocuments(filter),
    ]);

    // Transform for frontend compatibility
    const transformed = records.map((r) => ({
      ...r,
      _id: r._id?.toString(),
      linkId: r.roomId,
      fileCount: r.files?.length || 0,
      fileNames: r.files?.map((f) => f.fileName) || [],
      senderName: r.senderEmail?.split('@')[0] || 'Unknown',
      receiverName: r.receiverEmail?.split('@')[0] || 'Unknown',
    }));

    return NextResponse.json({ records: transformed, total, page, pages: Math.ceil(total / limit) });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    await connectDB();
    const body = await request.json().catch(() => ({}));
    const {
      roomId,
      senderEmail,
      receiverEmail,
      files,
      totalSize,
      status,
      progress,
      receiverDetails,
      senderDetails,
    } = body;

    if (!roomId) {
      return NextResponse.json({ error: 'roomId is required' }, { status: 400 });
    }

    // Extract IP from request headers if available
    const forwarded = request.headers.get('x-forwarded-for');
    const realIp = request.headers.get('x-real-ip');
    let clientIp = forwarded ? forwarded.split(',')[0].trim() : (realIp || '');
    if (clientIp === '::1' || clientIp === '::ffff:127.0.0.1') clientIp = '127.0.0.1';

    // Check if a transfer record for this roomId already exists
    let record = await TransferRecord.findOne({ roomId });

    if (record) {
      if (senderEmail && record.senderEmail === 'anonymous') record.senderEmail = senderEmail;
      if (receiverEmail && receiverEmail !== 'anonymous') record.receiverEmail = receiverEmail;
      if (files && files.length > 0) record.files = files;
      if (totalSize) record.totalSize = Number(totalSize);
      if (status) record.status = status;
      if (typeof progress === 'number') record.progress = progress;
      if (receiverDetails) {
        record.receiverDetails = {
          ...record.receiverDetails,
          ...receiverDetails,
          ip: receiverDetails.ip || clientIp || record.receiverDetails?.ip || '',
        };
      }
      if (senderDetails) {
        record.senderDetails = {
          ...record.senderDetails,
          ...senderDetails,
          ip: senderDetails.ip || clientIp || record.senderDetails?.ip || '',
        };
      }
      record.updatedAt = new Date();
      await record.save();
    } else {
      record = await TransferRecord.create({
        roomId,
        senderEmail: senderEmail || 'anonymous',
        receiverEmail: receiverEmail || 'anonymous',
        files: files || [],
        totalSize: Number(totalSize) || 0,
        progress: typeof progress === 'number' ? progress : 0,
        status: status || 'in-progress',
        receiverDetails: receiverDetails || {},
        senderDetails: senderDetails || {},
        updatedAt: new Date(),
      });
    }

    return NextResponse.json({ success: true, record });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}