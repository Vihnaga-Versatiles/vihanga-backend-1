const mongoose = require("mongoose");

const Schema = new mongoose.Schema({
  userId: String,
  userRole: String,
  reviewedId: String,
  reviewedRole: String,
  templateId: {
    type: String,
  }
}, { timestamps: true });

module.exports = mongoose.model("chatbotReviewsAdvanced", Schema);