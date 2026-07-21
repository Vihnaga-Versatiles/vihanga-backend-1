const mongoose = require("mongoose");

const Schema = new mongoose.Schema({
  okrTemplateName: {
    type: String,
    require: true
  },
  instructionsToUsers: {
    type: String,
    require: true
  },
  startDate: {
    type: Date,
    require: true
  },
  endDate: {
    type: Date,
    require: true
  },
  highValueRange: {
    type: Object,
    require: true
  },
  midValueRange: {
    type: Object,
    require: true
  },
  lowValueRange: {
    type: Object,
    require: true
  },
  highValueRange: {
    type: Object,
    require: true
  },
  eligibilityGroup: {
    type: Array,
    require: true
  },
  isExportOKRs: {
    type: Boolean,
    require: true,
    default: false
  },
  includingKeyResults: {
    type: Boolean,
    require: true,
    default: false
  },
  companyId: {
    type: String,
    ref: "Company"
  }
}, { timestamps: true });
module.exports = mongoose.model("okrTab", Schema);
