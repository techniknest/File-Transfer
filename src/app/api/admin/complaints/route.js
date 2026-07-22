import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import connectDB from '@/lib/mongodb';
import Contact from '@/models/Contact';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    await connectDB();

    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status') || '';

    const filter = {};
    if (statusFilter) filter.status = statusFilter;

    const complaints = await Contact.find(filter).sort({ createdAt: -1 }).lean();

    return NextResponse.json({ complaints });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
