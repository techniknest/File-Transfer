import mongoose from 'mongoose';

async function connectDB() {
  const MONGODB_URI = process.env.MONGODB_URI;
  console.log(`URI exists: ${!!MONGODB_URI}`);

  if (global.mongoose?.conn) return global.mongoose.conn;

  if (!global.mongoose) {
    global.mongoose = { conn: null, promise: null };
  }

  try {
    if (!global.mongoose.promise) {
      if (!MONGODB_URI) {
        throw new Error('Please define the MONGODB_URI environment variable inside .env.local');
      }
      global.mongoose.promise = mongoose.connect(MONGODB_URI, {
        serverSelectionTimeoutMS: 30000
      });
    }
    global.mongoose.conn = await global.mongoose.promise;
    console.log('MongoDB connected successfully');
    return global.mongoose.conn;
  } catch (error) {
    console.error('MongoDB connection error:', error.message);
    // Reset the promise so we can attempt to reconnect on the next request
    global.mongoose.promise = null;
    throw error;
  }
}

export default connectDB;