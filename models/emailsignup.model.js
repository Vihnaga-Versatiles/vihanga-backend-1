const mongoose = require("mongoose");

const Schema = new mongoose.Schema({
  email: {
    type: String,
    required: true
  },
}, { timestamps: true });

module.exports = mongoose.model("EmailSignup", Schema);
