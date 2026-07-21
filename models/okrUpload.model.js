const mongoose = require("mongoose");

const OKRUploadSchema = new mongoose.Schema(
  {
    companyId: {
      type: String,
      required: true,
      index: true
    },
    filename: {
      type: String,
      required: true
    },
    s3Url: {
      type: String
    },
    fileSize: {
      type: String
    },
    status: {
      type: String,
      enum: ['completed', 'failed', 'rolled_back', 'processing'],
      default: 'completed'
    },
    objectivesCount: {
      type: Number,
      default: 0
    },
    keyResultsCount: {
      type: Number,
      default: 0
    },
    tasksCount: {
      type: Number,
      default: 0
    },
    uploadBatchId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    createdBy: {
      type: String
    },
    createdByName: {
      type: String
    },
    rolledBackAt: {
      type: Date
    },
    rolledBackBy: {
      type: String
    },
    errorMessage: {
      type: String
    }
  },
  { timestamps: true }
);

// Index for faster queries
OKRUploadSchema.index({ companyId: 1, createdAt: -1 });

module.exports = mongoose.model("OKRUpload", OKRUploadSchema);
