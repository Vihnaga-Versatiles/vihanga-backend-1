const mongoose = require("mongoose");

const Schema = new mongoose.Schema({
  employeeId: {
    type: String,
    ref: "Employee"
  },
  employeeName: String,
  comment: String,
  referenceId: String,
  attachment: String
}, { timestamps: true });

module.exports = mongoose.model("TasksComments", Schema);
