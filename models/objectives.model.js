const mongoose = require("mongoose");

const Schema = new mongoose.Schema(
  {
    objectiveID: {
      type: String,
      required: true
    },
   
    employeeNumber: {
      type: String
    },
    employeeName: {
      type: String,
      //required: true,
    },
    okrPeriod: {
      type: String,
      required: true,
    },
    okrYear: {
      type: Number,
      require: true,
    },
    objective: {
      type: String,
      required: true,
    },
    dueDate: {
      type: Date,
      default: null,
      require: false,
    },
    weight: {
      type: Number,
      require: true,
      min: 1,
      max: 100,
    },
    owner: {
      type: String,
      require: true,
    },
    successMetrics: {
      type: String,
    },
    progressStatus: {
      type: Number,
    },
    feedAttachment: {
      type: String,
    },
    comments: {
      type: String,
    },
    employeeReferenceId: {
      type: String,
      require: true,
      ref: "Employee",
    },
    status: {
      type: String,
      // enum: ["Active", "Inactive"],
      // default: "Active"
    },
    cascaded: {
      type: Boolean,
      default: false
    },
    cascadedType: {
      type: String,
    },
    cascadedById: {
      type: String,
    },
    cascadedByName: {
      type: String,
    },
    cascadedObjectiveId: {
      type: String,
    },
    keyResults: {
      type: Array
    },
    dimension: {
      type: String,
      //required: true,
    },
    objectiveStatus: {
      type: String,
      // enum: ["Create", "Update", "Submit", "Approve", "Reject", "Unlock"],
      // default: "Create"
    },
    companyId: {
      type: String,
      ref: "Company"
    },
    approvalRequired: {
      type: Boolean,
      default: false
    },
    isGifShown: {
      type: Boolean,
      default: false
    },
    pending: {
      type: Object,
      default: null
    },
    isApproved: {
      type: String
    },
    isAlignedToCompany: {
      type: String,
      enum: ["Yes", "No"],
      default: "No"
    },
    cascadeAssigneeType: {
      type: String,
      enum: ["employees", "organization", "function", "teams"],
      default: "employees"
    },
    uploadBatchId: {
      type: String,
      index: true
    }
  },

  { timestamps: true }
);

// Indexes to support getCompanyObjectives filtering / lookups.
Schema.index({ employeeReferenceId: 1 });
Schema.index({ owner: 1 });
Schema.index({ companyId: 1 });
Schema.index({ companyId: 1, okrYear: 1 });

module.exports = mongoose.model("Objectives", Schema);
