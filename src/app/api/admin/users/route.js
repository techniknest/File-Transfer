import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';

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
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';
    const skip = (page - 1) * limit;

    const filter = {};
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }
    if (status) filter.status = status;

    const [users, total] = await Promise.all([
      User.find(filter, { password: 0 }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      User.countDocuments(filter),
    ]);

    return NextResponse.json({ users, total, page, pages: Math.ceil(total / limit) });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const session = await requireAdmin();
    if (!session) return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

    await connectDB();
    const { userId, action } = await request.json();

    if (!userId || !action) return NextResponse.json({ error: 'userId and action required' }, { status: 400 });

    let update = {};
    if (action === 'suspend') update = { status: 'suspended' };
    else if (action === 'activate') update = { status: 'active' };
    else return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

    const user = await User.findByIdAndUpdate(userId, update, { new: true, select: '-password' });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    return NextResponse.json({ user });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const session = await requireAdmin();
    if (!session) return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

    await connectDB();
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });

    // Prevent admin from deleting themselves
    const target = await User.findById(userId);
    if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    if (target.email === session.user.email) return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 });

    await User.findByIdAndDelete(userId);
    return NextResponse.json({ message: 'User deleted' });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
