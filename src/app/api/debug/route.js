import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';

export async function GET() {
  const results = {
    timestamp: new Date().toISOString(),
    env: {
      MONGODB_URI: process.env.MONGODB_URI ? '✅ SET' : '❌ MISSING',
      NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ? '✅ SET' : '❌ MISSING',
      NEXTAUTH_URL: process.env.NEXTAUTH_URL || '❌ MISSING',
      NODE_ENV: process.env.NODE_ENV,
    },
    mongodb: 'untested',
  };

  try {
    await connectDB();
    results.mongodb = '✅ Connected';
  } catch (err) {
    results.mongodb = `❌ Failed: ${err.message}`;
  }

  return NextResponse.json(results);
}
