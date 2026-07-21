const mongoose = require("mongoose");

const Schema = new mongoose.Schema({
  gradeName: {
    type: String,
    required: true
  },
  departmentName: {
    type: String,
  },
  departmentId: {
    type: String
  },
  designationName: {
    type: String,
  },
  designationId: {
    type: String
  },
  status: {
    type: String,
    enum: ["Active", "Inactive"],
    default: "Active",
    required: true
  },
  //gradeComposite: {
  //  type: {
  //    gradeName: 1,
  //    departmentName: 1
  //  },
  //  unique: true
  //},
  companyId: {
    type: String,
    ref: "Company"
  }
}, { timestamps: true });

module.exports = mongoose.model("Grade", Schema);
