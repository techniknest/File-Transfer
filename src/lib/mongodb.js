import mongoose from 'mongoose';

let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

async function connectDB() {
  const MONGODB_URI = process.env.MONGODB_URI;

  if (!MONGODB_URI) {
    throw new Error(
      'MONGODB_URI is not defined in Vercel Environment Variables. Please set MONGODB_URI in Vercel Dashboard -> Settings -> Environment Variables.'
    );
  }

  // If connection is already open and ready
  if (cached.conn && mongoose.connection.readyState === 1) {
    return cached.conn;
  }

  // If disconnected or never connected, initialize connection promise
  if (!cached.promise || mongoose.connection.readyState === 0) {
    const opts = {
      serverSelectionTimeoutMS: 8000,
      connectTimeoutMS: 8000,
      socketTimeoutMS: 30000,
      // CRITICAL: maxPoolSize=1 for Vercel serverless.
      // Each Lambda invocation is isolated. Setting >1 wastes RAM
      // and causes the 96% heap usage you see in the health dashboard.
      maxPoolSize: 1,
      minPoolSize: 0,
      family: 4, // Force IPv4 to prevent SRV DNS resolution timeouts on Vercel
      bufferCommands: false, // Fail immediately if not connected — don't mask errors
    };

    cached.promise = mongoose.connect(MONGODB_URI, opts).then((m) => m);
  }

  try {
    cached.conn = await cached.promise;
    return cached.conn;
  } catch (error) {
    cached.promise = null;
    cached.conn = null;
    console.error('[MongoDB] Connection error:', error.message);

    if (
      error.message?.includes('whitelist') ||
      error.message?.includes('ServerSelectionError') ||
      error.message?.includes('ETIMEDOUT') ||
      error.message?.includes('querySrv ETIMEOUT') ||
      error.message?.includes('buffering timed out')
    ) {
      throw new Error(
        'MongoDB Atlas connection failed. In MongoDB Atlas -> Network Access -> IP Access List, please add 0.0.0.0/0 (Allow Access from Anywhere).'
      );
    }
    throw error;
  }
}

export default connectDB;