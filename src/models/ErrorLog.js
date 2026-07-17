import mongoose from 'mongoose';

const ErrorLogSchema = new mongoose.Schema({
  message: { type: String, required: true },
  stack: { type: String, default: '' },
  route: { type: String, default: 'unknown' },
  severity: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  timestamp: { type: Date, default: Date.now, index: true },
});

// Auto-expire logs after 30 days
ErrorLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

const ErrorLog = mongoose.models.ErrorLog || mongoose.model('ErrorLog', ErrorLogSchema);
export default ErrorLog;
