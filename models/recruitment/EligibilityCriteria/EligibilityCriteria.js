const mongoose = require("mongoose");



// Define the EligibilityCriteria schema
const eligibilityCriteriaSchema = new mongoose.Schema(
  {
    companyId: {
      type: String,
     
      trim: true,
    },
    eligibilityName: {
      type: String,
        required: true,
      trim: true,
    },
    age: {
      type: String,
      //   required: true,
    },
    lengthOfService: {
      type: String, // e.g., in months or years
      //   required: true,
      min: 0,
    },
    lengthOfServiceExclusions: {
      excludePublicHolidays: {
        type: Boolean,
        default: false,
      },
      excludeLeaves: {
        type: Boolean,
        default: false,
      },
      excludeWeekends: {
        type: Boolean,
        default: false,
      },
    },
    jobName: {
      type: String,
      //   required: true,
      trim: true,
    },
    gender: {
      type: String,

      //   required: true,
    },
    grade: {
      type: String,
      //   required: true,
      trim: true,
    },
    maritalStatus: {
      type: String,

      //   required: true,
    },
    location: {
      type: String,
      //   required: true,
      trim: true,
    },
    probationPeriod: {
      type: String, // e.g., in months
      //   required: true,
    },
    noticePeriod: {
      type: String, // e.g., in months
      //   required: true,
    },
    personType: {
      type: String,

      //   required: true,
    },
    religion: {
      type: String,
      trim: true,
      default: null,
    },
    position: {
      type: String,
      //   required: true,
      trim: true,
    },
    hireDate: {
      type: Date,
      //   required: true,
    },
    department: {
      type: String,
      //   required: true,
      trim: true,
    },
    workType: {
      type: String,

      //   required: true,
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt fields
  }
);

// Create and export the model
const EligibilityCriteriaModel = mongoose.model(
  "EligibilityCriteria",
  eligibilityCriteriaSchema
);

module.exports=EligibilityCriteriaModel;
