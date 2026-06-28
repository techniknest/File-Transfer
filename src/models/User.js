import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  status: { type: String, enum: ['active', 'suspended'], default: 'active', index: true },
  lastLoginAt: { type: Date },
  loginCount: { type: Number, default: 0 },
  totalTransfers: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
});

const User = mongoose.models.User || mongoose.model('User', UserSchema);
export default User;