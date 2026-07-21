const mongoose = require("mongoose");

const documentSubmissionSchema = new mongoose.Schema(
  {
    companyId: {
      type: String,
      required: true,
    },
    employeeId: {
      type: String,
      required: true,
    },
    documentTypeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DocumentType",
      required: true,
    },
    submissionDate: {
      type: Date,
      required: true,
    },
    fileUrl: {
      type: String,
      default: null,
    },
    fileName: {
      type: String,
      default: null,
    },
    fileSize: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    rejectionReason: {
      type: String,
      default: null,
    },
    approvedBy: {
      type: String, // User ID who approved/rejected
      default: null,
    },
    approvedAt: {
      type: Date,
      default: null,
    },
    dynamicFieldValues: {
      type: mongoose.Schema.Types.Mixed, // Store dynamic field values as JSON
      default: {},
    },
    // Store file URLs for dynamic file fields
    dynamicFileUrls: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for better query performance
documentSubmissionSchema.index({ companyId: 1, employeeId: 1 });
documentSubmissionSchema.index({ documentTypeId: 1 });
documentSubmissionSchema.index({ status: 1 });
documentSubmissionSchema.index({ submissionDate: -1 });

const DocumentSubmissionModel = mongoose.model("DocumentSubmission", documentSubmissionSchema);

module.exports = DocumentSubmissionModel;

