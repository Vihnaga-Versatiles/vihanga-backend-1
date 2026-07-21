//close ended questions
const mongoose = require('mongoose')

const Schema = new mongoose.Schema({
  category: {
    type: String,
    required: true
  },
  subcategory: {
    type: String,
    required: true
  },
  question: {
    type: String,
    required: true
  },
  defination: {
    type: String,
    required: true
  },
  answer: {
    type: String,
    required: true
  },
  responsetime: {
    type: String,
    required: true
  },
  Ranking: {
    type: String,
    required: true
  },
  userId: {
    type: String,
    required: true
  },
  polarity: {
    type: String,
  },
  tag: {
    type: String
  },
  score: {
    type: Number
  },
  templateId: {
    type: String
  }
}, { timestamps: true })

module.exports = mongoose.model("Chatbot2", Schema);
