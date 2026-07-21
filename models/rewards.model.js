const mongoose = require("mongoose");

const Schema = new mongoose.Schema({
  rewardIcon: {
    type: String,
    require: true
  },
  rewardName: {
    type: String,
    require: true
  },
  rewardCode: {
    type: String,
    require: true
  },
  rewardDescription: {
    type: String,
    require: true
  },
  rewardType: {
    type: String,
    //require: true
  },
  rewardCategory: {
    type: String,
    //require: true
  },
  rewardApprover: {
    type: String,
    require: true
  },
  rewardPoints: {
    type: Number,
    require: true
  },
  rewardAmount: {
    type: Number,
    require: true
  },
  rewardStatus: {
    type: String,
    enum: ["active", "inactive"],
    default: "active",
  },
  companyId: {
    type: String,
    ref: "Company"
  }
}, { timestamps: true });
module.exports = mongoose.model("Reward", Schema);
