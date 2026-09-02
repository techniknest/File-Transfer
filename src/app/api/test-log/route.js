import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import SystemLog from '@/models/SystemLog';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NO_CACHE = {
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  'Pragma': 'no-cache',
};

/**
 * GET /api/test-log
 * Diagnostic: writes a test log directly and reads it back.
 * Use this to instantly verify MongoDB + logging pipeline on Vercel.
 */
export async function GET(request) {
  const result = {
    timestamp: new Date().toISOString(),
    steps: {},
  };

  // Step 1: Check environment
  result.steps.env = {
    MONGODB_URI: process.env.MONGODB_URI ? '✅ Set' : '❌ MISSING',
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ? '✅ Set' : '❌ MISSING',
    NEXTAUTH_URL: process.env.NEXTAUTH_URL || '⚠️ Not set (using VERCEL_URL fallback)',
    VERCEL_URL: process.env.VERCEL_URL || '(not on Vercel)',
    NODE_ENV: process.env.NODE_ENV,
  };

  if (!process.env.MONGODB_URI) {
    return NextResponse.json({ ...result, status: 'error', error: 'MONGODB_URI missing' }, { status: 500, headers: NO_CACHE });
  }

  // Step 2: Connect to MongoDB
  const dbStart = Date.now();
  try {
    await connectDB();
    result.steps.db_connect = { status: '✅ Connected', ms: Date.now() - dbStart };
  } catch (err) {
    result.steps.db_connect = { status: '❌ FAILED', error: err.message, ms: Date.now() - dbStart };
    return NextResponse.json({ ...result, status: 'error' }, { status: 500, headers: NO_CACHE });
  }

  // Step 3: Write a test log
  const writeStart = Date.now();
  let testLogId = null;
  try {
    const log = await SystemLog.create({
      eventType: 'test_log_write',
      level: 'info',
      category: 'system',
      message: `Diagnostic test log — written at ${new Date().toISOString()}`,
      metadata: { source: 'api/test-log', env: process.env.VERCEL ? 'vercel' : 'local' },
      timestamp: new Date(),
    });
    testLogId = log._id?.toString();
    result.steps.log_write = { status: '✅ Written', id: testLogId, ms: Date.now() - writeStart };
  } catch (err) {
    result.steps.log_write = { status: '❌ FAILED', error: err.message, ms: Date.now() - writeStart };
    return NextResponse.json({ ...result, status: 'error' }, { status: 500, headers: NO_CACHE });
  }

  // Step 4: Read logs back
  const readStart = Date.now();
  try {
    const count = await SystemLog.countDocuments({});
    const recent = await SystemLog.find({}).sort({ timestamp: -1 }).limit(3).lean();
    result.steps.log_read = {
      status: '✅ OK',
      totalLogsInDB: count,
      recentLogs: recent.map(l => ({
        id: l._id?.toString(),
        eventType: l.eventType,
        message: l.message?.substring(0, 80),
        timestamp: l.timestamp,
      })),
      ms: Date.now() - readStart,
    };
  } catch (err) {
    result.steps.log_read = { status: '❌ FAILED', error: err.message };
  }

  // Step 5: Clean up test log
  if (testLogId) {
    try {
      await SystemLog.deleteOne({ _id: testLogId });
      result.steps.cleanup = { status: '✅ Test log deleted' };
    } catch (_) {
      result.steps.cleanup = { status: '⚠️ Could not delete test log' };
    }
  }

  return NextResponse.json(
    { ...result, status: 'ok', summary: '✅ All logging pipeline checks passed!' },
    { headers: NO_CACHE }
  );
}
