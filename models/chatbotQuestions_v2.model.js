const mongoose = require('mongoose')
const Schema = new mongoose.Schema({
  CompetencyName: {
    type: String,
    required: true
  },
  SubCategory: {
    type: String,
    required: true
  },
  Question: {
    type: String,
    required: true
  },
  Options: {
    type: String,
    required: true
  },
  Ranking: {
    type: String,
    required: true
  },
  Defination: {
    type: String,
    required: true
  }
}, { timestamps: true })

module.exports = mongoose.model("ChatbotCloseEndedQuestions", Schema);
