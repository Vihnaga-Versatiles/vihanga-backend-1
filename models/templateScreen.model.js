const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    companyId: {
      type: String,
      required: true,
    },
    templateName: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    displayOptions: {
      type: Array,
      required: true,
    },
    displaySteps: {
      type: Array,
      required: true,
    },
    ratingScale: {
      type: String,
      required: true,
    },
    goalPercentage: {
      type: String,
      required: true,
    },
    percentageType:{
      type:String,
    },
    competenciesPercentage: {
      type: String,
      required: true,
    },
    competencies:{
      type: Array,
    }
  },
  {
    timestamps: true,
  }
);

const User = mongoose.model("templatescreen", userSchema);

module.exports = User;
