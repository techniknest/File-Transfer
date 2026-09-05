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
    enum: ['waiting', 'connected', 'active_transfer', 'closed'],
    default: 'waiting',
  },
  // Timestamp of the last receiver ping — used to detect stale / timed-out connections
  receiverLastActivity: {
    type: Date,
    default: null,
  },
  // Server-side resume offsets: { "0": 1024, "1": 512 } — fileIndex → chunks received
  // Updated periodically by receiver so a page refresh can restore progress even if
  // IndexedDB is cleared (e.g. private browsing, storage pressure, different device)
  receiverProgress: {
    type: Map,
    of: Number,
    default: {},
  },
  // Attached files metadata permanently linked to this fixed room number
  files: [{
    fileName: { type: String, required: true },
    fileSize: { type: Number, required: true },
    fileType: { type: String, default: 'application/octet-stream' },
  }],
  totalSize: {
    type: Number,
    default: 0,
  },
  fileCount: {
    type: Number,
    default: 0,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 86400, // 24 hours TTL
  },
});

export default mongoose.models.Room || mongoose.model('Room', RoomSchema);
