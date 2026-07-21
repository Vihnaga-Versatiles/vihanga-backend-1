const mongoose = require("mongoose");

const Schema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },
    path: {
      type: String,
      required: true,
    },
    operation: {
      type: String,
      required: true,
    },
    row: {
      type: Object
    },
    companyInfo: {
      type: Object
    },
    companyId: {
      type: String,
      ref: "Company"
    }
  },

  { timestamps: true }
);

module.exports = mongoose.model("Notifications", Schema);
