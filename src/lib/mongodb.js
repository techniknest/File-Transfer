import mongoose from 'mongoose';

let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

async function connectDB() {
  const MONGODB_URI = process.env.MONGODB_URI;

  if (!MONGODB_URI) {
    throw new Error(
      'MONGODB_URI is not defined. Set it in Vercel Dashboard → Settings → Environment Variables.'
    );
  }

  // Reuse existing live connection
  if (cached.conn && mongoose.connection.readyState === 1) {
    return cached.conn;
  }

  // Clear stale promise if connection dropped
  if (mongoose.connection.readyState === 0) {
    cached.promise = null;
    cached.conn = null;
  }

  if (!cached.promise) {
    const opts = {
      serverSelectionTimeoutMS: 10000, // 10s for Vercel cold starts
      connectTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      maxPoolSize: 1,   // CRITICAL: 1 connection per Lambda = low RAM usage
      minPoolSize: 0,
      family: 4,        // Force IPv4 — prevents SRV DNS timeouts on AWS Lambda
      // NOTE: bufferCommands defaults to true — keep it that way so operations
      // queue briefly during connect rather than failing immediately on cold start
    };

    cached.promise = mongoose.connect(MONGODB_URI, opts)
      .then((m) => {
        console.log('[MongoDB] Connected successfully');
        return m;
      })
      .catch((err) => {
        cached.promise = null;
        cached.conn = null;
        throw err;
      });
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
      error.message?.includes('buffering timed out') ||
      error.message?.includes('ECONNREFUSED')
    ) {
      throw new Error(
        'MongoDB Atlas connection failed. Go to MongoDB Atlas → Network Access → IP Access List → Add 0.0.0.0/0 (Allow Access from Anywhere).'
      );
    }
    throw error;
  }
}

export default connectDB;