const mongoose = require("mongoose");

const compositeSchema = new mongoose.Schema({
  companyEntityName: {
    type: String,
    required: true
  },
  country: {
    type: String,
    required: true
  }
})
const Schema = new mongoose.Schema({
  companyEntityName: {
    type: String,
    required: true,
  },
  industry: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    required: true,
    enum: ["Active", "Inactive"],
    default: "Active",
  },
  country: {
    type: String,
    required: true
  },
  userId: {
    type: Number,
    default: 0
  },
  // JSON config for company-specific feature flags (e.g. googleSheetEnable, googleSheetEditURL)
  config: {
    type: mongoose.Schema.Types.Mixed,
    default: () => ({})
  }
  //companyComposite: {
  //  type: {
  //    companyEntityName: 1,
  //    country: 1
  //  },
  //  unique: true
  //}
}, { timestamps: true });

module.exports = mongoose.model("Company", Schema);
