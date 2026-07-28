const mongoose = require("mongoose");

const psychometricUserSchema = new mongoose.Schema(
  {
    candidateId: {
      type: String,
      unique: true,
      sparse: true,
    },
    name: {
      type: String,
    },
    email: {
      type: String,
    },
    results: {
      type: Object,
      default: {
        ImplementationSpecialists: 0,
        RealWorlders: 0,
        DisruptiveInnovator: 0,
      },
    },
    assessmentCompleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    collection: "psychometricusers",
  }
);

const PsychometricUser =
  mongoose.models.PsychometricUser ||
  mongoose.model("PsychometricUser", psychometricUserSchema);

module.exports = PsychometricUser;
