const mongoose = require('mongoose')

const Schema = new mongoose.Schema({
  logo: {
    type: String,
    required: true
  },
  companyId: {
    type: String,
    required: true
  },
}, { timestamps: true })

module.exports = mongoose.model("preferences", Schema);
