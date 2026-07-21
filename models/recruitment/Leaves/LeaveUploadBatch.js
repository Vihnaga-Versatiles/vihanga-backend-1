const mongoose = require("mongoose");

const leaveUploadBatchSchema = new mongoose.Schema(
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
    createdBalanceUpdateIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "EmployeeLeaveBalance",
      },
    ],
    previousBalances: [
      {
        balanceId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "EmployeeLeaveBalance",
        },
        leaveTypes: [{
          leaveTypeId: String,
          name: String,
          unit: String,
          balance: Number,
        }],
      },
    ],
    rolledBackAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

const LeaveUploadBatchModel = mongoose.model(
  "LeaveUploadBatch",
  leaveUploadBatchSchema
);

module.exports = LeaveUploadBatchModel;

