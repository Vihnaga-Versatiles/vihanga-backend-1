const mongoose = require("mongoose");

const timeTrackingUploadBatchSchema = new mongoose.Schema(
  {
    companyId: {
      type: String,
      required: true,
    },
    filename: {
      type: String,
    },
    fileSize: {
      type: Number,
      default: null,
    },
    s3Key: {
      type: String,
      default: null,
    },
    s3Url: {
      type: String,
      default: null,
    },
    type: {
      type: String,
      default: null, // from selected tab type
    },
    status: {
      type: String,
      enum: ["processing", "completed", "rolled_back", "failed"],
      default: "processing",
    },
    totalRecords: {
      type: Number,
      default: 0,
    },
    successCount: {
      type: Number,
      default: 0,
    },
    errorCount: {
      type: Number,
      default: 0,
    },
    createdEntryIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "timeTracking",
      },
    ],
    anyRequiresApproval: {
      type: Boolean,
      default: false,
    },
    rolledBackAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

const TimeTrackingUploadBatchModel = mongoose.model(
  "TimeTrackingUploadBatch",
  timeTrackingUploadBatchSchema
);

module.exports = TimeTrackingUploadBatchModel;


