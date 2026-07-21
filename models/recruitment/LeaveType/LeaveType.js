const mongoose = require("mongoose");

const leaveTypeSchema = new mongoose.Schema(
  {
    companyId: {
      type: String,
    },
    eligibilityId: {
      type: String,
    },
    name: {
      type: String,
      // required: true,
    },
    icon: {
      type: String, // URL or icon name
    },
    code: {
      type: String,
      unique: true,
      trim: true,
      
    },
    balanceBasedOn: {
      type: String,
      // required: true,
    },
    unit: {
      type: String,
      // required: true,
    },
    status: {
      type: String,
    },
    attachmentsRequired: {
      type: String,
    },
    eligibility: {
      type: String,
      default: null,
    },
    carryOver: {
      carryOverDate: {
        type: String,
        default: "01",
      },
      carryOverExpiry: {
        type: Boolean,
        default: false,
      },
      maxDays: {
        type: Number,
        default: 0,
      },
    },
    // Advanced Configuration
    maxLeavesAtOnce: {
      type: Number,
      default: null,
    },
    autoAddLeaves: {
      enabled: {
        type: Boolean,
        default: false,
      },
      type: {
        type: String,
      },
      days: {
        type: Number,
        default: null,
      },
      maxElapsedDays: {
        type: Number,
        default: null, // Maximum accumulated balance allowed
      },
    },
    attachmentRequiredDays: {
      operator: {
        type: String
      },
      value: {
        type: Number,
        default: null,
      },
    },
    maxAdvanceDays: {
      type: [{
        minDays: {
          type: Number,
          required: true,
        },
        maxDays: {
          type: Number,
          default: null, // null means no upper limit
        },
        maxAdvanceDays: {
          type: Number,
          required: true,
        },
      }],
      default: [],
    },
    maxHalfDays: {
      type: Number,
      default: null, // null means no limit on half days
    },
  },
  {
    timestamps: true,
  }
);

// Create compound unique index for name and companyId
leaveTypeSchema.index({ name: 1, companyId: 1 }, { unique: true });

const LeaveTypeModel = mongoose.model("LeaveType", leaveTypeSchema);

module.exports = LeaveTypeModel;
