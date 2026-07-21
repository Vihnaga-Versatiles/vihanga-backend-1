const mongoose = require("mongoose");

const Schema = new mongoose.Schema({
  krID: {
    type: String,
    required: true
  },
  isGifShown: {
    type: Boolean,
    default: false
  },
  comments: {
    type: String,
  },
  okrName: {
    type: String,
    required: true
  },
  dimension: {
    type: String,
    //required: true
  },
  isAlignedToCompany: {
    type: String,
    enum: ["Yes", "No"],
    default: "No",
    required: true
  },
  keyResultName: {
    type: String,
    required: true
  },
  source: {
    type: String,
    required: false
  },
  kpiId: {
    type: String,
    required: false
  },
  query: {
    type: String,
    required: false
  },
  kpiName: {
    type: String,
    required: false
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
    type: String
  },

  actual: {
    type: String,
    required: false,
  },
  basevalue: {
    type: Number,
    required: false,
  },
  feedAttachment: {
    type: String,
    required: false,
  },
  objectiveId: {
    type: String,
    required: true,
    ref: 'Objective'
  },
  approvalRequired: {
    type: Boolean,
    default: false
  },
  userId: {
    type: String,
  },
  status: {
    type: String,
    required: false
  },
  unit: {
    type: String,
    required: false
  },
  pending: {
    type: Object,
    default: null
  },
  isApproved: {
    type: String
  },
  cascadeAssigneeType: {
    type: String,
    required: false
  },
  jiraKey: {
    type: String,
  },
  jiraStatus: {
    type: String,
  },
  companyId: {
    type: String,
    ref: "Company"
  },
  weight: {
    type: Number,
    default: 0
  },
  uploadBatchId: {
    type: String,
    index: true
  }
},
  { timestamps: true });

// Critical for the $lookup join in getCompanyObjectives.
Schema.index({ objectiveId: 1 });

module.exports = mongoose.model("KeyResults", Schema);
