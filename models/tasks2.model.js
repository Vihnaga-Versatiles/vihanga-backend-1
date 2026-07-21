const mongoose = require("mongoose");

const Schema = new mongoose.Schema({
  owner: {
    type: String,
  },
  employeeName: {
    type: String,
  },
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
  },
  startDate: {
    type: Date,
    required: true
  },
  dueDate: {
    type: Date,
    required: true
  },
  actualCompletionDate: {
    type: Date,
  },
  linkToKR: {
    type: String,
  },
  assignTo: {
    type: Array,
    required: true
  },
  priority: {
    type: String,
    required: true
  },
  status: {
    type: String,
    required: true
  },
  comments: {
    type: String
  },
  attachments: {
    type: String
  },
  krReferenceId: {
    type: String,
    ref: "KeyResult"
  },
  estimationEffort: {
    type: String,
  },
  actualEffort: {
    type: String,
  },
  rewardPoints: {
    type: Number,
    default: 0,
  },
  recurrence: {
    type: Boolean,
    default: false
  },
  recurrenceDetails: {
    type: Object,
    default: null
  },
  mainTask: {
    type: String,
    default: null
  },
  progressStatus: {
    type: Number,
    default: 0,
  },
  companyId: {
    type: String,
    ref: "Company"
  },
  userId: {
    type: String
  },
  pending: {
    type: Object,
    default: null
  },
  isApproved: {
    type: String
  },
  jiraKey: {
    type: String,
  },
  jiraStatus: {
    type: String,
  },
  uploadBatchId: {
    type: String,
    index: true
  }
}, { timestamps: true });

// Support task lookups by key-result and company scoping.
Schema.index({ krReferenceId: 1 });
Schema.index({ companyId: 1 });

module.exports = mongoose.model("tasks2", Schema);
