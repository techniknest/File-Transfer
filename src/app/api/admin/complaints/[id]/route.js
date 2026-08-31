import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import connectDB from '@/lib/mongodb';
import Contact from '@/models/Contact';
import { authOptions } from '@/lib/auth';

export async function PATCH(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    await connectDB();
    const resolvedParams = await params;
    const { id } = resolvedParams || {};
    const { status } = await request.json();

    if (!['pending', 'resolved'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const complaint = await Contact.findByIdAndUpdate(id, { status }, { new: true });
    
    if (!complaint) {
      return NextResponse.json({ error: 'Complaint not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, complaint });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
