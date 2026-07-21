const mongoose = require("mongoose");

const Schema = new mongoose.Schema({
  competencyName: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  competencyType: {
    type: String,
    required: true
  },
  developmentActivities: {
    type: Array,
    required: true
  },
  coachingActivities: {
    type: Array,
    required: true
  },
  categoryActivities: {
    type: String,
    required: true
  },
  designation: {
    type: Array,
  },
  companyId:{
        type: String,
        required: true
  }
}, { timestamps: true });

module.exports = mongoose.model("competency", Schema);
