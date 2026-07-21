const mongoose = require("mongoose");

const leaveAccrualLogSchema = new mongoose.Schema(
  {
    companyId: { type: String, required: true },
    leaveTypeId: { type: String, required: true },
    periodScope: {
      type: String,
      enum: ["hourly", "monthly", "yearly", "carry"],
      required: true,
    },
    periodKey: { type: String, required: true }, // e.g. 2025-12, 2025, 2025-04-01, 2025-12-01-09
    executedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Ensure exactly-once per (company, leaveType, scope, period)
leaveAccrualLogSchema.index(
  { companyId: 1, leaveTypeId: 1, periodScope: 1, periodKey: 1 },
  { unique: true }
);

const LeaveAccrualLog = mongoose.model("LeaveAccrualLog", leaveAccrualLogSchema);

module.exports = LeaveAccrualLog;






