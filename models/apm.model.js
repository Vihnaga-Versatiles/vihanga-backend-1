const mongoose = require("mongoose");

const AuditTrail = new mongoose.Schema({
  ratingScale: {
    type: Object
  },
  companyId: {
    type: String
  }
}, { timestamps: true });

module.exports = mongoose.model("apm", AuditTrail);
