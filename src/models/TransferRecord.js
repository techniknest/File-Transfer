import mongoose from 'mongoose';

const TransferRecordSchema = new mongoose.Schema({
  roomId: { type: String, required: true },
  senderEmail: { type: String, required: true },
  receiverEmail: { type: String, default: 'anonymous' },
  files: { type: Array, default: [] },
  totalSize: { type: Number, default: 0 },
  status: { type: String, default: 'completed' },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.models.TransferRecord ||
  mongoose.model('TransferRecord', TransferRecordSchema);