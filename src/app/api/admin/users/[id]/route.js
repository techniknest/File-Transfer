import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';

async function requireAdmin() {
  const session = await getServerSession();
  if (!session || session.user.role !== 'admin') return null;
  return session;
}

export async function PATCH(request, { params }) {
  try {
    const session = await requireAdmin();
    if (!session) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    await connectDB();
    const { id } = params;
    const body = await request.json();
    const { action } = body;

    if (!id || !action) {
      return NextResponse.json({ error: 'User ID and action are required' }, { status: 400 });
    }

    const targetUser = await User.findById(id);
    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Prevent admins from modifying their own role/status via this endpoint
    if (targetUser.email === session.user.email && (action === 'suspend' || action === 'remove-admin')) {
      return NextResponse.json({ error: 'You cannot modify your own account status or role' }, { status: 400 });
    }

    let update = {};

    switch (action) {
      case 'block':
      case 'suspend':
        update = { status: 'suspended', blockedAt: new Date() };
        break;
      case 'unblock':
      case 'activate':
        update = { status: 'active', blockedAt: null };
        break;
      case 'make-admin':
        update = { role: 'admin' };
        break;
      case 'remove-admin':
        update = { role: 'user' };
        break;
      default:
        return NextResponse.json({ error: `Invalid action: ${action}` }, { status: 400 });
    }

    const updatedUser = await User.findByIdAndUpdate(
      id,
      update,
      { new: true, select: '-password' }
    ).lean();

    return NextResponse.json({ user: updatedUser, message: 'User updated successfully' });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const session = await requireAdmin();
    if (!session) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    await connectDB();
    const { id } = params;

    const targetUser = await User.findById(id);
    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (targetUser.email === session.user.email) {
      return NextResponse.json({ error: 'You cannot delete your own admin account' }, { status: 400 });
    }

    await User.findByIdAndDelete(id);
    return NextResponse.json({ message: 'User deleted successfully' });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
