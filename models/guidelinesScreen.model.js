const mongoose = require("mongoose");
const userSchema = new mongoose.Schema(
  {
    selectedTemplate: {
      type: String,
      required: true,
    },
    session: {
      type: String,
      required: true,
    },
    step: {
      type: String,
      required: true,
    },
    guidelines: {
      type: Array,
      required: true,
    }
  },
  {
    timestamps: true,
  }
);

const User = mongoose.model("guidelinesscreen", userSchema);

module.exports = User;
