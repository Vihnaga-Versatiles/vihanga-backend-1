const mongoose = require("mongoose");

const Schema = new mongoose.Schema({
  rewardPoints: {
    type: String,
    require: true
  },
  rewardAmount: {
    type: String,
    require: true
  },
  userId: {
    type: String,
    require: true
  },
  rewardId: {
    type: String,
    require: true
  },
  status: {
    type: String
  },
  companyId: {
    type: String,
    ref: "Company"
  }
}, { timestamps: true });
module.exports = mongoose.model("Redemption", Schema);
