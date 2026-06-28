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
    console.log('✅ MongoDB connected');
    return global.mongoose.conn;
  } catch (error) {
    console.error('⚠️ MongoDB connection error:', error.message);
    return null;
  }
}

export default connectDB;