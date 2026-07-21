const mongoose = require("mongoose");

const Schema = new mongoose.Schema(
  {
    domain: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: false,
      trim: true,
    },
    apiToken: {
      type: String,
      required: true,
    },
    companyId: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { timestamps: true }
);

// One config per company
Schema.index({ companyId: 1 }, { unique: true });

module.exports = mongoose.model("JiraConfig", Schema);
