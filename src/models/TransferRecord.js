import mongoose from 'mongoose';

const TransferRecordSchema = new mongoose.Schema({
  roomId: { type: String, required: true },
  senderEmail: { type: String, required: true },
  receiverEmail: { type: String, default: 'anonymous' },
  receiverDetails: {
    ip: { type: String, default: '' },
    deviceType: { type: String, default: '' },
    browser: { type: String, default: '' },
    os: { type: String, default: '' },
    userAgent: { type: String, default: '' },
    requestedAt: { type: Date },
  },
  senderDetails: {
    ip: { type: String, default: '' },
    deviceType: { type: String, default: '' },
    browser: { type: String, default: '' },
    os: { type: String, default: '' },
    userAgent: { type: String, default: '' },
  },
  files: { type: Array, default: [] },
  totalSize: { type: Number, default: 0 },
  progress: { type: Number, default: 0 },
  status: { type: String, default: 'in-progress' }, // in-progress | completed | interrupted | cancelled
  updatedAt: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now, expires: 2592000 } // 30 days TTL
});

// Indexes for fast lookup on transfers by roomId and by sender
TransferRecordSchema.index({ roomId: 1 });
TransferRecordSchema.index({ senderEmail: 1, createdAt: -1 });
TransferRecordSchema.index({ receiverEmail: 1, createdAt: -1 });

export default mongoose.models.TransferRecord ||
  mongoose.model('TransferRecord', TransferRecordSchema);