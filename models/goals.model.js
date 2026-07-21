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
      enum: ["Active", "Inactive"],
      default: "Active"
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
      enum: ["Create", "Update", "Submit", "Approve", "Reject", "Unlock"],
      default: "Create"
    },
    companyId: {
      type: String,
      ref: "Company"
    },
    isAlignedToCompany: {
      type: String,
      enum: ["Yes", "No"],
      default: "Yes",
      required: true
    },
    frequency: {
      type: String,
      required: false
    },

    uom: {
      type: String,
      required: false
    },
    polarity: {
      type: String,
      required: false
    },
    msc: {
      type: String,
      required: false
    },
    targetDate: {
      type: Date,
      required: false
    },
    actualDate: {
      type: Date,
      required: false,
    },
    target: {
      type: Number,
      required: true
    },
    actual: {
      type: Number,
      required: false,
    },
    basevalue: {
      type: Number,
      required: false,
    },
    employeeRating: {
      type: Number,
      default: 0
    },
    managerRating: {
      type: Number,
      default: 0
    }
  },

  { timestamps: true }
);

module.exports = mongoose.model("Goals", Schema);
