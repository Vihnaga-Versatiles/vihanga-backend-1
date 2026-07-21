const mongoose = require("mongoose");

const loginSessionSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },
    companyId: {
      type: String,
    },
    email: {
      type: String,
    },
    name: {
      type: String,
    },
    employeeNumber: {
      type: String,
    },
    designation: {
      type: String,
    },
    department: {
      type: String,
    },
    location: {
      type: String,
    },
    role: {
      type: String,
    },
    loginAt: {
      type: Date,
      default: Date.now,
    },
    logoutAt: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ["Active", "LoggedOut", "Expired"],
      default: "Active",
    },
    ipAddress: {
      type: String,
    },
    userAgent: {
      type: String,
    },
  },
  { timestamps: true }
);

loginSessionSchema.index({ employeeId: 1, loginAt: -1 });
loginSessionSchema.index({ companyId: 1, loginAt: -1 });

module.exports = mongoose.model("LoginSession", loginSessionSchema);


