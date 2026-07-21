const mongoose = require("mongoose");

const Schema = new mongoose.Schema({
  userId: String,
  userRole: String,
  reviewedId: String,
  reviewedRole: String,
}, { timestamps: true });

module.exports = mongoose.model("chatbotReviewsV1", Schema);
