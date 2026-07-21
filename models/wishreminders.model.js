const mongoose = require("mongoose");

const Schema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['Birthday', 'Anniversary'],
    required: true
  },
  senderName: {
    type: String
  },
  companyId: {
    type: String,
    ref: "Company"
  }
}, { timestamps: true });

module.exports = mongoose.model("WishReminder", Schema);
