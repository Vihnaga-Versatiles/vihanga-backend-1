const mongoose = require("mongoose");

const ratingScaleSchema = new mongoose.Schema({
  code: {
    type: Number,
    required: true
  },
  meaning: {
    type: String,
    required: true,
  },
  dateStart: {
    type: Date,
    default: null
  },
  dateEnd: {
    type: Date,
    default: null
  },
  enabled: {
    type: Boolean,
    default: true
  }
}, { _id: false });

const lookupSchema = new mongoose.Schema({
  companyId: {
    type: String,
    required: true
  },
  lookType: {
    type: String,
    required: true,
  },
  meaning: {
    type: String,
    required: true,
  },
  ratingScale: {
    type: [ratingScaleSchema],
    default: []
  }
}, {
  timestamps: true // automatically adds createdAt & updatedAt
});

// Create compound index for companyId and lookType for better query performance
lookupSchema.index({ companyId: 1, lookType: 1 });

module.exports = mongoose.model("Lookups", lookupSchema);
