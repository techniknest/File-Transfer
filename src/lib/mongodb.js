import mongoose from 'mongoose';

// Cached connection for serverless (Vercel) environments
let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null, seeded: false };
}

async function connectDB() {
  const MONGODB_URI = process.env.MONGODB_URI;

  if (!MONGODB_URI) {
    throw new Error(
      'MONGODB_URI is not defined in environment variables. Please add MONGODB_URI in your Vercel Project Settings.'
    );
  }

  // Check if mongoose already has an active, live connection (readyState: 1 = connected)
  if (cached.conn && mongoose.connection.readyState === 1) {
    return cached.conn;
  }

  // If connection is dropped or disconnected (readyState 0 or 3), recreate promise
  if (!cached.promise || mongoose.connection.readyState === 0 || mongoose.connection.readyState === 3) {
    const opts = {
      serverSelectionTimeoutMS: 8000,
      connectTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      bufferCommands: false,
      maxPoolSize: 10,
      minPoolSize: 0,
    };

    cached.promise = mongoose.connect(MONGODB_URI, opts).then((m) => m);
  }

  try {
    cached.conn = await cached.promise;
  } catch (error) {
    cached.promise = null;
    cached.conn = null;
    console.error('[MongoDB] Connection error:', error.message);

    if (
      error.message?.includes('whitelist') ||
      error.message?.includes('ServerSelectionError') ||
      error.message?.includes('ETIMEDOUT') ||
      error.message?.includes('buffering timed out') ||
      error.message?.includes('querySrv ETIMEOUT')
    ) {
      throw new Error(
        'MongoDB Atlas connection failed. Please ensure IP Access List in MongoDB Atlas Network Access allows all IPs (0.0.0.0/0) for Vercel serverless deployments.'
      );
    }
    throw error;
  }

  // Fire-and-forget seed — does NOT block the response
  if (!cached.seeded) {
    cached.seeded = true;
    autoSeedAdmin().catch((e) =>
      console.error('[Auto-Seed] Failed:', e.message)
    );
  }

  return cached.conn;
}

async function autoSeedAdmin() {
  try {
    const User = (await import('../models/User.js')).default;
    const bcrypt = (await import('bcryptjs')).default;

    const existingAdmin = await User.findOne({ role: 'admin' }).lean();

    if (!existingAdmin) {
      const adminEmail = process.env.ADMIN_EMAIL;
      const adminPassword = process.env.ADMIN_PASSWORD;
      const adminName = process.env.ADMIN_NAME || 'Admin';

      if (adminEmail && adminPassword) {
        const hashedPassword = await bcrypt.hash(adminPassword, 10);
        await User.create({
          name: adminName,
          email: adminEmail.toLowerCase(),
          password: hashedPassword,
          role: 'admin',
          status: 'active',
        });
        console.log(`[Auto-Seed] Admin user created: ${adminEmail}`);
      } else {
        console.log('[Auto-Seed] ADMIN_EMAIL/ADMIN_PASSWORD not set. Skipping.');
      }
    }
  } catch (error) {
    console.error('[Auto-Seed] Error:', error.message);
  }
}

export default connectDB;