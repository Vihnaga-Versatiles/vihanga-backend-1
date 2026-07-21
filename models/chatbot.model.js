//open ended questions
const mongoose = require('mongoose')

const Schema = new mongoose.Schema({
  category: {
    type: String,
    required: true
  },
  subcategory: {
    type: String
  },
  question: {
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
    type: String
  },
  userId: {
    type: String,
    required: true
  },
  polarity: {
    type: String
  }
}, { timestamps: true })

module.exports = mongoose.model("Chatbot", Schema);
