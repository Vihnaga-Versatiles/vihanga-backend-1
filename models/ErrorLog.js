const mongoose = require("mongoose");

const ErrorLogSchema = new mongoose.Schema(
  {
    // High-level grouping
    module: {
      type: String,
      index: true,
      default: "General",
      trim: true,
    },
    stage: {
      type: String,
      index: true,
      default: "",
      trim: true,
    },
    action: {
      type: String,
      default: "",
      trim: true,
    },

    // Request metadata
    method: { type: String, default: "" },
    path: { type: String, index: true, default: "" },
    query: { type: Object, default: {} },
    params: { type: Object, default: {} },
    body: { type: Object, default: {} },
    headers: { type: Object, default: {} },
    ip: { type: String, default: "" },

    // Business identifiers
    companyId: { type: String, index: true, default: "" },
    candidateId: { type: String, index: true, default: "" },
    userId: { type: String, default: "" },
    userEmail: { type: String, default: "" },

    // Error information
    statusCode: { type: Number, default: 500, index: true },
    message: { type: String, default: "" },
    stack: { type: String, default: "" },
    rawError: { type: Object, default: {} },
  },
  { timestamps: true }
);

ErrorLogSchema.index({ createdAt: -1 });
ErrorLogSchema.index({ module: 1, stage: 1, createdAt: -1 });

const ErrorLog =
  mongoose.models.ErrorLog || mongoose.model("ErrorLog", ErrorLogSchema);

module.exports = ErrorLog;






