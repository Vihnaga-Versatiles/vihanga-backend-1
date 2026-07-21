const mongoose = require("mongoose");

const FeedbackSchema = new mongoose.Schema({
  candidateId: {
    type: String,
    required: true,
  },

  // Interview round (interview 1 or interview 2)
  round: {
    type: String,
    required: true,
  },

  // Ratings can have dynamic competency keys (e.g., competency_68e3a703247aa2bffbd13c6d) plus overall
  // Using Mixed type to allow flexible structure with dynamic keys
  ratings: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },

  ratings1: {
    unsatisfactory: { type: Number, min: 0, max: 5 },
    belowAverage: { type: Number, min: 0, max: 5 },
    meetsRequirements: { type: Number, min: 0, max: 5 },
    exceedsRequirements: { type: Number, min: 0, max: 5 },
    farExceeds: { type: Number, min: 0, max: 5 },
  },

  // Comments can have dynamic competency keys (e.g., competency_68e3a703247aa2bffbd13c6d) plus overall
  // Using Mixed type to allow flexible structure with dynamic keys
  comments: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },

  // Store only competency IDs (more efficient than storing full objects)
  competencyIds: {
    type: [String],
    default: [],
  },

  // Optional uploaded file (filename or URL)
  uploadedDocument: {
    type: String,
    default: "",
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const FeedbackModel = mongoose.model("Feedback", FeedbackSchema);

module.exports = {
  FeedbackModel,
};
