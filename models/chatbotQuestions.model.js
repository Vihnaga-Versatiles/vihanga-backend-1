const mongoose = require('mongoose')
const Schema = new mongoose.Schema({
  EIndex: {
    type: Number,
    required: true
  },
  CompetencyName: {
    type: String,
    required: true
  },
  Question: {
    type: String,
    required: true
  },
  LinkIndex: {
    type: Number,
    required: true
  }
}, { timestamps: true })

module.exports = mongoose.model("ChatbotOpenEndedQuestions", Schema);
