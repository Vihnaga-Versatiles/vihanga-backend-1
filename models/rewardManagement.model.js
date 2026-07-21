const mongoose = require("mongoose");

const Schema = new mongoose.Schema({
  rewardSchemeName: {
    type: String,
    require: true
  },
  rewardCategory: {
    type: String,
    require: true
  },
  rewardType: {
    type: String,
    require: true
  },
  rewardPoints: {
    type: String,
    require: true
  },
  rewardPointsType: {
    type: String,
  },
  rewardPoints2: {
    type: String,
    require: true
  },
  rewardPointsType2: {
    type: String,
  },
  rewardPoints3: {
    type: String,
    require: true
  },
  rewardPointsType3: {
    type: String,
  },
  kudosEnabled: {
    type: Boolean,
    default: false,
  },
  birthdayWishesEnabled: {
    type: Boolean,
    default: false,
  },
  approvalRequired: {
    type: Boolean,
    default: false,
  },
  anniversaryWishesEnabled: {
    type: Boolean,
    default: false,
  },
  objectivesAchievementPercent: {
    type: Number,
    default: 0
  },
  objectivesAchievementPoints: {
    type: Number,
    default: 0
  },
  okrTemplate: {
    type: String
  },
  krAchievementPercent: {
    type: Number,
    default: 0
  },
  krAchievementPoints: {
    type: Number,
    default: 0
  },
  taskAchievementPercent: {
    type: Number,
    default: 0
  },
  taskAchievementPoints: {
    type: Number,
    default: 0
  },
  subTaskAchievementPercent: {
    type: Number,
    default: 0
  },
  subTaskAchievementPoints: {
    type: Number,
    default: 0
  },
  eligibilityGroup: {
    type: String,
  },
  companyId: {
    type: String,
    ref: "Company"
  }
}, { timestamps: true });
module.exports = mongoose.model("rewardManagement", Schema);
