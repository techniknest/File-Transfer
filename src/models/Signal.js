import mongoose from 'mongoose';

const SignalSchema = new mongoose.Schema({
  roomId: {
    type: String,
    required: true,
  },
  fromClientId: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    required: true,
    enum: [
      'offer',
      'answer',
      'ice-candidate',
      'receiver-joined',
      'peer-disconnected',
      'transfer-request',
      'transfer-allow',
      'transfer-decline',
      'transfer-resume',
      'sender-ready',
    ],
  },
  payload: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },
  consumedBy: {
    type: [String],
    default: [],
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 1800, // 30 minutes TTL
  },
});

// Compound index: the poll query filters on roomId + fromClientId + consumedBy.
// A compound index on roomId + createdAt makes the poll both fast and ordered.
// This is critical for Vercel serverless where every ms of DB query time matters.
SignalSchema.index({ roomId: 1, createdAt: 1 });

export default mongoose.models.Signal || mongoose.model('Signal', SignalSchema);
