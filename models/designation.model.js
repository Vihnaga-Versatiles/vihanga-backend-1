const mongoose = require("mongoose");

const Schema = new mongoose.Schema({
  designationName: {
    type: String,
    required: String
  },
  gradeName: {
    type: String,
    //required: true,
    ref: "Grade"
  },
  departmentName: {
    type: String,
    required: true,
    ref: "Department"
  },
  legalEntityName: {
    type: String,
    required: true,
    ref: "Entity"
  },
  status: {
    type: String,
    enum: ["Active", "Inactive"],
    default: "Active",
    required: true
  },
  //designationComposite: {
  //  type: {
  //    designationName: 1,
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

module.exports = mongoose.model("Designation", Schema);
