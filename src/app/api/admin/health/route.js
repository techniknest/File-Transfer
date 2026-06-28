import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import connectDB from '@/lib/mongodb';
import mongoose from 'mongoose';

export async function GET() {
  try {
    const session = await getServerSession();
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

    // Active sessions from socket handler
    const rooms = global._p2pRooms?.() || {};
    const sessionMeta = global._p2pSessions?.() || {};
    const activeSessions = Object.keys(rooms).length;
    const activeConnections = global._p2pIO?.engine?.clientsCount || 0;

    // Session statuses
    const sessionsByStatus = Object.values(sessionMeta).reduce((acc, s) => {
      acc[s.status] = (acc[s.status] || 0) + 1;
      return acc;
    }, {});

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
        },
        nodeVersion: process.version,
      },
      database: {
        status: dbStatus,
        responseTime: dbResponseTime,
        mongoVersion: mongoose.version,
        connectionState: ['disconnected', 'connected', 'connecting', 'disconnecting'][mongoose.connection.readyState] || 'unknown',
      },
      transfers: {
        activeSessions,
        activeConnections,
        sessionsByStatus,
        totalRooms: Object.keys(rooms).length,
      },
    });
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
