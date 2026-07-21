const mongoose = require("mongoose");

const leavesSchema = new mongoose.Schema(
  {
    companyId: {
      type: String,
    },
    eligibilityId: {
      type: String,
    },
    leaveTypeId: {
      type: String,
    },
    empId: {
      type: String,
    },
    absenceType: {
      type: String,
    },
    halfDay: {
      type: Boolean,
      default: false,
    },
    from: {
      type: Date,
    },
    to: {
      type: Date,
    },
    durationOfAbsence: {
      type: String, 
    },
    note: {
      type: String,
    },
    attachment: {
      type: String
    },
    // Enhanced approval workflow fields
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'cancelled'],
      default: 'pending'
    },
    workflowId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workflow'
    },
    currentLevel: {
      type: String,
      default: "0" // Start from level 0
    },
    // Detailed approval levels tracking
    approverLevels: {
      type: Map,
      of: {
        status: {
          type: String,
          enum: ['pending', 'approved', 'rejected'],
          default: 'pending'
        },
        approvers: [{
          approverId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Employee'
          },
          approverType: String, // 'line_manager', 'hr_manager', etc.
          approverName: String,
          approverEmail: String,
          status: {
            type: String,
            enum: ['pending', 'approved', 'rejected'],
            default: 'pending'
          },
          approvedAt: Date,
          rejectionReason: String,
          comments: String
        }]
      }
    },
    // Current active approvers
    currentApprovers: [{
      approverId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee'
      },
      approverType: String,
      approverName: String,
      approverEmail: String,
      level: String
    }],
    // Approval history for audit trail
    approvalHistory: [{
      approverId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee'
      },
      approverName: String,
      approverType: String,
      level: String,
      action: {
        type: String,
        enum: ['approved', 'rejected', 'forwarded']
      },
      comments: String,
      rejectionReason: String,
      timestamp: {
        type: Date,
        default: Date.now
      }
    }],
    // Final approval details
    finalApprovalDate: Date,
    finalApprover: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee'
    },
    rejectionReason: String,
    rejectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee'
    },
    rejectedAt: Date,
    // Employee information for quick access
    employeeInfo: {
      name: String,
      email: String,
      department: String,
      position: String,
      employeeNumber: String
    },
    // Additional metadata
    isUrgent: {
      type: Boolean,
      default: false
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium'
    },
    // Notifications tracking
    notificationsSent: [{
      recipientId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee'
      },
      recipientEmail: String,
      type: String, // 'approval_request', 'approved', 'rejected'
      sentAt: {
        type: Date,
        default: Date.now
      }
    }]
  },
  {
    timestamps: true,
  }
);

// Add indexes for better query performance
leavesSchema.index({ companyId: 1, empId: 1 });
leavesSchema.index({ status: 1, currentLevel: 1 });
leavesSchema.index({ 'currentApprovers.approverId': 1 });
leavesSchema.index({ workflowId: 1 });

// Virtual for approval status display
leavesSchema.virtual('statusDisplay').get(function() {
  switch(this.status) {
    case 'approved': return '🟢 Approved';
    case 'pending': return '🟡 Pending';
    case 'rejected': return '🔴 Rejected';
    case 'cancelled': return '⚫ Cancelled';
    default: return '🟡 Pending';
  }
});

// Virtual for current approval level display
leavesSchema.virtual('currentLevelDisplay').get(function() {
  if (!this.approverLevels || this.approverLevels.size === 0) return 'No approval required';
  
  const currentLevelData = this.approverLevels.get(this.currentLevel);
  if (!currentLevelData) return 'Awaiting approval';
  
  const approverNames = currentLevelData.approvers.map(a => a.approverName).join(', ');
  return `Level ${parseInt(this.currentLevel) + 1}: ${approverNames}`;
});

const LeavesModel = mongoose.model("Leave", leavesSchema);

module.exports = LeavesModel;
