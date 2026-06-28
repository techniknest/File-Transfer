import mongoose from 'mongoose';

const FileSchema = new mongoose.Schema({
  fileName: { type: String, required: true },
  fileSize: { type: Number, default: 0 },
  fileType: { type: String, default: 'application/octet-stream' },
}, { _id: false });

const TransferRecordSchema = new mongoose.Schema({
  roomId: { type: String, required: true, index: true },
  senderEmail: { type: String, required: true, index: true },
  receiverEmail: { type: String, default: 'anonymous' },
  files: [FileSchema],
  totalSize: { type: Number, default: 0 },
  fileCount: { type: Number, default: 0 },
  status: {
    type: String,
    enum: ['in_progress', 'completed', 'failed', 'cancelled'],
    default: 'completed',
    index: true,
  },
  startTime: { type: Date, default: Date.now },
  endTime: { type: Date },
  duration: { type: Number },           // seconds
  createdAt: { type: Date, default: Date.now, index: true },
});

// Auto-compute fileCount before save
TransferRecordSchema.pre('save', function (next) {
  this.fileCount = this.files?.length || 0;
  if (this.startTime && this.endTime) {
    this.duration = Math.round((this.endTime - this.startTime) / 1000);
  }
  next();
});

export default mongoose.models.TransferRecord ||
  mongoose.model('TransferRecord', TransferRecordSchema);