const mongoose = require("mongoose");

const Schema = new mongoose.Schema({
  formName: {
    type: String,
    required: true
  },
  formType: {
    type: String,
    required: true
  },
  formTemplate: {
    type: String,
    required: true
  },
  launchDate: {
    type: String,
    required: true
  },
  reviewPeriodStartDate: {
    type: String,
    required: true
  },
  reviewPeriodEndDate: {
    type: String,
    required: true
  },
  toEmployee: {
    type: String,
    required: true
  },
  selfAndManager: {
    type: Array,
  },
  peers: {
    type: Array,
  },
  templateName: {
    type: String,
  }
}, { timestamps: true });
module.exports = mongoose.model("advancedLaunchForms", Schema);
