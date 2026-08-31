import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const results = {
    timestamp: new Date().toISOString(),
    status: 'ok',
    environment: {
      MONGODB_URI: process.env.MONGODB_URI ? '✅ Configured' : '❌ MISSING (Add in Vercel Settings)',
      NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ? '✅ Configured' : '❌ MISSING',
      NEXTAUTH_URL: process.env.NEXTAUTH_URL || '❌ MISSING',
      VERCEL: process.env.VERCEL ? '✅ Running on Vercel' : 'Local / Custom Server',
      NODE_ENV: process.env.NODE_ENV,
    },
    database: {
      connected: false,
      message: 'Testing connection...',
    },
  };

  try {
    await connectDB();
    results.database.connected = true;
    results.database.message = '✅ MongoDB Atlas connection successful';
  } catch (err) {
    results.status = 'error';
    results.database.connected = false;
    results.database.message = `❌ MongoDB Connection Failed: ${err.message}`;
  }

  return NextResponse.json(results, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
}
