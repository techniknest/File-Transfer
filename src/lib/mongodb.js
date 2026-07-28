import mongoose from 'mongoose';

// Cached connection for serverless (Vercel) environments
let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null, seeded: false };
}

async function connectDB() {
  const MONGODB_URI = process.env.MONGODB_URI;

  if (!MONGODB_URI) {
    throw new Error('Please define the MONGODB_URI environment variable');
  }

  // Return existing connection if available
  if (cached.conn) {
    return cached.conn;
  }

  // Create connection promise if not already in progress
  if (!cached.promise) {
    const opts = {
      // Serverless-optimised: don't wait 30s, fail fast and let the client retry
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      // Prevent Mongoose from buffering commands when disconnected
      bufferCommands: false,
      // Keep connection pool small for serverless
      maxPoolSize: 10,
      minPoolSize: 0,
    };

    cached.promise = mongoose.connect(MONGODB_URI, opts).then((m) => m);
  }

  try {
    cached.conn = await cached.promise;
  } catch (error) {
    // Reset so the next request can try again
    cached.promise = null;
    console.error('[MongoDB] Connection error:', error.message);
    throw error;
  }

  // Fire-and-forget seed — does NOT block the login/auth response
  if (!cached.seeded) {
    cached.seeded = true; // set immediately so parallel requests don't double-seed
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
        // 10 rounds: still secure, ~3× faster than 12 on serverless CPUs
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