const mongoose = require("mongoose");

const Schema = new mongoose.Schema({
  category: String,
  filename: String,
  loadedData: String,
  totalData: String,
  fileSize: String,
  fileUrl: String,
  status: {
    type: String,
    enum: ["success", "failed"],
    default: "success"
  },
  companyId: {
    type: String,
    ref: "Company"
  }
}, { timestamps: true });

module.exports = mongoose.model("Upload", Schema);
