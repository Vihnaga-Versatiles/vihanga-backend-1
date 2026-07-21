const mongoose = require("mongoose");

const Schema = new mongoose.Schema({
  employeeName: {
    type: String,
    require: true
  },
  employeeId: {
    type: String,
    require: true
  },
  employeeFullName: {
    type: String,
    require: true
  },
  reviewPeriod: {
    type: String,
    require: true
  },
  startDate: {
    type: String,
    require: true
  },
  employeeRole: {
    type: String,
    require: true
  },
  endDate: {
    type: String,
    require: true
  },
  totalAchievement: {
    type: String,
  },
  overallRating: {
    type: Number,
    default: 0
  },
  goals: {
    type: Array,
    require: true
  },
  competencies: {
    type: Array,
    require: true
  },
  attachment: {
    type: String
  },
  status: {
    type: String,
    enum: ["Submit", "Manager Review", "HR Review", "Manager SignOff", "Employee SignOff", "Completed"],
    default: "Submit"
  },
  formId: {
    type: String,
  },
  managerName: {
    type: String,
  },
  managerId: {
    type: String,
  },
  managerSubmissionDate: {
    type: Date,
    default: Date.now()
  },
  employeeSubmissionDate: {
    type: Date,
    default: Date.now()
  },
  templateName: {
    type: String,
  },
  templateId: {
    type: String,
  },
  companyId: {
    type: String,
    ref: "Company"
  },
  managersRating: {
    type: Number,
    default: 0
  },
  overalComments: {
    cm1: {
      type: String
    },
    cm2: {
      type: String
    },
    cm3: {
      type: String
    }
  }
}, { timestamps: true });
module.exports = mongoose.model("TraditionalReview", Schema);
