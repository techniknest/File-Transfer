import mongoose from 'mongoose';

const SignalSchema = new mongoose.Schema({
  roomId: {
    type: String,
    required: true,
    index: true,
  },
  fromClientId: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    required: true,
    enum: ['offer', 'answer', 'ice-candidate', 'receiver-joined', 'peer-disconnected'],
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

export default mongoose.models.Signal || mongoose.model('Signal', SignalSchema);
