import mongoose from 'mongoose';

const RoomSchema = new mongoose.Schema({
  roomId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  senderClientId: {
    type: String,
    required: true,
  },
  receiverClientId: {
    type: String,
    default: null,
  },
  status: {
    type: String,
    enum: ['waiting', 'connected', 'closed'],
    default: 'waiting',
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 86400, // 24 hours TTL
  },
});

export default mongoose.models.Room || mongoose.model('Room', RoomSchema);
