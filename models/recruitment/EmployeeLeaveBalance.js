
const mongoose = require("mongoose");

const employeeLeaveBalanceSchema = new mongoose.Schema(
  {
    companyId: {
      type: String,
      required: true,
    },
    empId: {
      type: String,
      required: true,
    },
    leaveTypes: [
      {
        leaveTypeId: { type: String, required: true },
        name: { type: String },
        unit: { type: String },
        balance: { type: Number, default: 0 },
        // Tracks last accrual applied per scope to ensure idempotency
        lastAccrual: {
          type: mongoose.Schema.Types.Mixed,
          default: {},
        },
      },
    ],
  },
  { timestamps: true }
);

employeeLeaveBalanceSchema.index({ companyId: 1, empId: 1 }, { unique: true });
employeeLeaveBalanceSchema.index({ companyId: 1, "leaveTypes.leaveTypeId": 1 });

const EmployeeLeaveBalance = mongoose.model(
  "EmployeeLeaveBalance",
  employeeLeaveBalanceSchema
);

module.exports = EmployeeLeaveBalance;


