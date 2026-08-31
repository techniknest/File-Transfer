import mongoose from 'mongoose';

const SystemLogSchema = new mongoose.Schema({
  eventType: {
    type: String,
    required: true,
    index: true,
  },
  level: {
    type: String,
    enum: ['info', 'success', 'warn', 'error'],
    default: 'info',
    index: true,
  },
  category: {
    type: String,
    enum: ['auth', 'navigation', 'file', 'room', 'webrtc', 'transfer', 'system'],
    default: 'system',
    index: true,
  },
  message: {
    type: String,
    required: true,
  },
  roomId: {
    type: String,
    default: null,
    index: true,
  },
  userEmail: {
    type: String,
    default: null,
    index: true,
  },
  clientId: {
    type: String,
    default: null,
    index: true,
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  userAgent: {
    type: String,
    default: '',
  },
  ip: {
    type: String,
    default: '',
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true,
    expires: 14 * 24 * 60 * 60, // 14 days auto-expire TTL
  },
});

// Compound indexes for fast admin querying & filtering
SystemLogSchema.index({ roomId: 1, timestamp: -1 });
SystemLogSchema.index({ level: 1, timestamp: -1 });
SystemLogSchema.index({ category: 1, timestamp: -1 });

const SystemLog = mongoose.models.SystemLog || mongoose.model('SystemLog', SystemLogSchema);
export default SystemLog;
