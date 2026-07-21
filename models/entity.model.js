const mongoose = require("mongoose");


const compositeSchema = new mongoose.Schema({
  companyEntityName: {
    type: String,
    required: true
  },
  legalEntityName: {
    type: String,
    required: true,
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
  companyId: {
    type: String,
    ref: "Company"
  },
  industry: {
    type: String,
    required: true,
  },
  legalEntityName: {
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
  entityComposite: {
    type: {
      companyEntityName: 1,
      legalEntityName: 1,
      country: 1
    },
    unique: true,
  }
}, { timestamps: true });

module.exports = mongoose.model("Entity", Schema);
