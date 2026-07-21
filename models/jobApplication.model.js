const mongoose = require("mongoose");

const Schema = new mongoose.Schema(
  {
    jobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Job",
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
    },
    phone: {
      type: String,
      required: true,
    },
    linkedinURL: {
      type: String,
      default: "",
    },
    cvURL: {
      type: String,
      required: true,
    },
    company: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("JobApplication", Schema);
