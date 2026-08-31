import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import mongoose from 'mongoose';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Server uptime
    const uptimeSeconds = process.uptime();
    const memUsage = process.memoryUsage();

    // MongoDB health check
    let dbStatus = 'offline';
    let dbResponseTime = null;
    const dbStart = Date.now();
    if (global.useMockDb) {
      dbStatus = 'mock';
      dbResponseTime = 0;
    } else {
      try {
        await connectDB();
        if (mongoose.connection.readyState === 1) {
          await mongoose.connection.db.command({ ping: 1 });
          dbStatus = 'online';
          dbResponseTime = Date.now() - dbStart;
        }
      } catch (e) {
        dbStatus = 'error';
      }
    }

    // Active sessions from socket handler
    const rooms = global._p2pRooms?.() || {};
    const sessionMeta = global._p2pSessions?.() || {};
    const activeSessions = Object.keys(rooms).length;
    
    // Active connections: global.activeConnections = { count }
    const activeConnections = (global.activeConnections && typeof global.activeConnections.count === 'number')
      ? global.activeConnections.count
      : (global._p2pIO?.engine?.clientsCount || 0);

    // Session statuses
    const sessionsByStatus = Object.values(sessionMeta).reduce((acc, s) => {
      acc[s.status] = (acc[s.status] || 0) + 1;
      return acc;
    }, {});

    // Log count for diagnostics
    let logCount = null;
    try {
      const SystemLog = (await import('@/models/SystemLog')).default;
      logCount = await SystemLog.countDocuments({});
    } catch (_) {}

    return NextResponse.json({
      server: {
        status: 'online',
        uptimeSeconds: Math.round(uptimeSeconds),
        uptimeFormatted: formatUptime(uptimeSeconds),
        memory: {
          used: Math.round(memUsage.heapUsed / 1024 / 1024),
          total: Math.round(memUsage.heapTotal / 1024 / 1024),
          rss: Math.round(memUsage.rss / 1024 / 1024),
          usagePercent: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100),
          note: 'Vercel Lambda has ~256MB. Memory % reflects this instance only.',
        },
        nodeVersion: process.version,
      },
      database: {
        status: dbStatus,
        useMockDb: !!global.useMockDb,
        responseTime: dbResponseTime,
        mongoVersion: mongoose.version,
        connectionState: global.useMockDb
          ? 'Mock Database Active'
          : (['disconnected', 'connected', 'connecting', 'disconnecting'][mongoose.connection.readyState] || 'unknown'),
        systemLogCount: logCount,
      },
      transfers: {
        activeSessions,
        activeConnections,
        sessionsByStatus,
        totalRooms: Object.keys(rooms).length,
      },
    }, { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m ${secs}s`;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
}
