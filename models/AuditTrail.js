const mongoose = require("mongoose");

const AuditTrail = new mongoose.Schema({
  dataDocument: {
    type: Object
  },
  operation: {
    type: String //Insert, Update, Delete
  },
  collectionName: {
    type: String //database collection name
  },
  userId: {
    type: String, //Employee Id (Employee, HR, Super Admin etc.,)
  },
  featureName: {
    type: String // Tasks, Objectives, Key Results, Reviews etc.,
  },
  recordId: {
    type: String
  }
}, { timestamps: true });

module.exports = mongoose.model("AuditTrail", AuditTrail);
