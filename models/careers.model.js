const mongoose = require("mongoose");

const Schema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  linkedinURL: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true
  },
  phone: {
    type: String,
    required: true
  },
  cvURL: {
    type: String,
    required: true
  },
}, { timestamps: true });

module.exports = mongoose.model("Career", Schema);
