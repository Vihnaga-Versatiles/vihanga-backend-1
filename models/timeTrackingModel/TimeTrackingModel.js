const mongoose = require("mongoose");

const timeTrackingSchema = new mongoose.Schema(
  {
    companyId: {
      type: String,
    },
    userId: {
      type: String,
    },
    day: {
      type: String,
    },
    dateString: {
      type: String,
    },
    timeIn: {
      type: String,
    },
    timeOut: {
      type: String,
      default: null,
    },
    hours: {
      type: String,
    },
    method: {
      type: String, // "manual" or "geo"
    },
    status: {
      type: String,
      default: "pending", // "pending", "approved", "rejected"
    },
    longitude: {
      type: Number,
    },
    latitude: {
      type: Number,
    },
    // Distance traveled object containing coordinates and calculation
    distanceTraveled: {
      clockInCoordinates: {
        longitude: { type: Number },
        latitude: { type: Number }
      },
      clockOutCoordinates: {
        longitude: { type: Number },
        latitude: { type: Number }
      },
      distanceInKm: { type: String, default: "00km 00m" },
      calculatedAt: { type: Date, default: null }
    },
    // Approval workflow fields
    workflowId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workflow",
      default: null,
    },
    currentLevel: {
      type: String,
      default: null,
    },
    approverLevels: {
      type: Map,
      of: {
        status: { type: String, default: "pending" }, // 'pending', 'approved', 'rejected'
        approvers: [
          {
            approverId: {
              type: mongoose.Schema.Types.ObjectId,
              ref: "Employee",
            },
            approverType: String, // 'Line Manager', 'HR Manager', etc.
            approverName: String,
            approverEmail: String,
            status: { type: String, default: "pending" }, // 'pending', 'approved', 'rejected'
            approvedAt: Date,
            comments: String,
            rejectionReason: String,
          },
        ],
      },
      default: new Map(),
    },
    currentApprovers: [
      {
        approverId: { type: mongoose.Schema.Types.ObjectId, ref: "Employee" },
        approverType: String,
        approverName: String,
        approverEmail: String,
        level: String,
      },
    ],
    approvalHistory: [
      {
        approverId: { type: mongoose.Schema.Types.ObjectId, ref: "Employee" },
        approverName: String,
        approverType: String,
        level: String,
        action: String, // 'approved', 'rejected'
        comments: String,
        rejectionReason: String,
        timestamp: { type: Date, default: Date.now },
      },
    ],
    // Employee information for quick access
    employeeInfo: {
      name: String,
      email: String,
      department: String,
      position: String,
      // Store location so exports / reports don't have to re-join Employee
      location: String,
    },
    // Final approval/rejection details
    finalApprovalDate: Date,
    finalApprover: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
    },
    rejectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
    },
    rejectedAt: Date,
    rejectionReason: String,
    // Comments/notes for manual entries
    comments: String,
            Remarks: String, // Additional remarks or notes

    // Batch upload reference for rollback
    batchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TimeTrackingUploadBatch",
      default: null,
    },

  },
  {
    timestamps: true,
  }
);

// Virtual for status display
timeTrackingSchema.virtual("statusDisplay").get(function () {
  switch (this.status) {
    case "pending":
      return { text: "Pending Approval", color: "orange" };
    case "approved":
      return { text: "Approved", color: "green" };
    case "rejected":
      return { text: "Rejected", color: "red" };
    default:
      return { text: this.status, color: "gray" };
  }
});

// Virtual for current level display
timeTrackingSchema.virtual("currentLevelDisplay").get(function () {
  if (!this.currentLevel) return null;
  return `Level ${parseInt(this.currentLevel) + 1}`;
});

// Ensure virtuals are included in JSON output
timeTrackingSchema.set("toJSON", { virtuals: true });
timeTrackingSchema.set("toObject", { virtuals: true });

const TimeTrackingModel = mongoose.model("timeTracking", timeTrackingSchema);

module.exports = TimeTrackingModel;
