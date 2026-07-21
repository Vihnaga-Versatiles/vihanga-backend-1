const mongoose = require("mongoose");

const Schema = new mongoose.Schema({
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
    enum: ["High Level", "Medium Level", "Low Level"],
    default: "High Level",
    required: true
  },
  status: {
    type: String,
    enum: ["notstarted", "inprogress", "onhold", "completed"],
    default: "notstarted",
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
  recurrence: {
    type: Boolean,
    default: false
  },
  recurrenceDetails: {
    type: Object,
    default: null
  }
}, { timestamps: true });
module.exports = mongoose.model("tasks", Schema);
