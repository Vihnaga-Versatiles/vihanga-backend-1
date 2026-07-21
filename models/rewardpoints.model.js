const mongoose = require("mongoose");

const Schema = new mongoose.Schema({
  referenceID: {
    type: String,
    required: true
  },
  employeeReferenceId: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ["Objective", "Key Result", "Task", "Sub Task"],
    required: true
  },
  rewardPoints: {
    type: Number,
    default: 0,
    required: true
  },
  isApproved: {
    type: String
  }
},
  { timestamps: true });


module.exports = mongoose.model("RewardPoints", Schema);
