import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import connectDB from '@/lib/mongodb';
import Review from '@/models/Review';

async function requireAdmin() {
  const session = await getServerSession();
  if (!session || session.user.role !== 'admin') return null;
  return session;
}

export async function GET(request) {
  try {
    const session = await requireAdmin();
    if (!session) return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

    await connectDB();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;

    const filter = status ? { status } : {};

    const [reviews, total] = await Promise.all([
      Review.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Review.countDocuments(filter),
    ]);

    return NextResponse.json({ reviews, total, page, pages: Math.ceil(total / limit) });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
