import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI;

async function connectDB() {
  if (global.mongoose?.conn) return global.mongoose.conn;

  if (!global.mongoose) {
    global.mongoose = { conn: null, promise: null };
  }

  try {
    if (!global.mongoose.promise) {
      global.mongoose.promise = mongoose.connect(MONGODB_URI, {
        serverSelectionTimeoutMS: 3000
      });
    }
    global.mongoose.conn = await global.mongoose.promise;
    console.log('MongoDB connected successfully');
    
    if (!global.mongoose.seeded) {
      await autoSeedAdmin();
    }
    
    return global.mongoose.conn;
  } catch (error) {
    console.error('MongoDB connection error:', error.message);
    if (global.mongoose) {
      global.mongoose.promise = null;
    }
    throw error;
  }
}

async function autoSeedAdmin() {
  if (global.mongoose?.seeded) return;
  try {
    const User = (await import('../models/User.js')).default;
    const bcrypt = (await import('bcryptjs')).default;

    const existingAdmin = await User.findOne({ role: 'admin' });
    if (!existingAdmin) {
      const adminEmail = process.env.ADMIN_EMAIL;
      const adminPassword = process.env.ADMIN_PASSWORD;
      const adminName = process.env.ADMIN_NAME || 'Admin';

      if (adminEmail && adminPassword) {
        const hashedPassword = await bcrypt.hash(adminPassword, 12);
        await User.create({
          name: adminName,
          email: adminEmail.toLowerCase(),
          password: hashedPassword,
          role: 'admin',
          status: 'active',
        });
        console.log(`[Auto-Seed] Admin user registered: ${adminEmail}`);
      } else {
        console.log('[Auto-Seed] Admin email or password not configured in env. Skipping auto-seed.');
      }
    } else {
      console.log('[Auto-Seed] Admin already exists in database. Skipping.');
    }
    if (global.mongoose) {
      global.mongoose.seeded = true;
    }
  } catch (error) {
    console.error('[Auto-Seed] Failed to seed admin user:', error.message);
  }
}

export default connectDB;