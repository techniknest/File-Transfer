import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import connectDB from '@/lib/mongodb';
import Review from '@/models/Review';

async function requireAdmin() {
  const session = await getServerSession();
  if (!session || session.user.role !== 'admin') return null;
  return session;
}

export async function PATCH(request, { params }) {
  try {
    const session = await requireAdmin();
    if (!session) return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

    await connectDB();
    const { id } = params;
    const { status } = await request.json();

    if (!['approved', 'rejected', 'pending'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status. Must be: approved, rejected, or pending' }, { status: 400 });
    }

    const review = await Review.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    ).lean();

    if (!review) return NextResponse.json({ error: 'Review not found' }, { status: 404 });

    return NextResponse.json({ review, message: `Review ${status}` });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const session = await requireAdmin();
    if (!session) return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

    await connectDB();
    const { id } = params;

    const review = await Review.findByIdAndDelete(id);
    if (!review) return NextResponse.json({ error: 'Review not found' }, { status: 404 });

    return NextResponse.json({ message: 'Review deleted successfully' });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
