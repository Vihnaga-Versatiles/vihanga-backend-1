const mongoose = require("mongoose");

const Schema = new mongoose.Schema({
  companyId: {
    type: String,
    required: true,
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
  employees: {
    type: Array,
  },
  templateName: {
    type: String,
  }
}, { timestamps: true });

module.exports = mongoose.model("launchForms", Schema);
