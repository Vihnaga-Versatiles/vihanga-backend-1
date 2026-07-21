const mongoose = require("mongoose");

const Schema = new mongoose.Schema({
  okrIndustry: {
    type: String,
    require: true
  },
  okrFunction: {
    type: String,
    require: true
  },
  okrCategory: {
    type: String,
    require: true
  },
  objectiveKeyResults: {
    type: Array,
    require: true
  },
  isActive: {
    type: Boolean,
    require: true
  },
  exportOKRLibrary: {
    type: Boolean,
    require: true
  },
  companyId: {
    type: String,
    ref: "Company"
  }
}, { timestamps: true });
module.exports = mongoose.model("okrLibraryTab", Schema);
