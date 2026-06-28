import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

export async function GET(request) {
  try {
    const session = await getServerSession();
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const level = searchParams.get('level') || 'all';
    const limit = parseInt(searchParams.get('limit') || '100');

    const allLogs = global._p2pLogs || [];
    const filtered = level === 'all' ? allLogs : allLogs.filter(l => l.level === level);

    return NextResponse.json({ logs: filtered.slice(0, limit), total: filtered.length });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const session = await getServerSession();
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }
    global._p2pLogs = [];
    return NextResponse.json({ message: 'Logs cleared' });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
