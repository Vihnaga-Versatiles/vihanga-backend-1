const mongoose = require("mongoose");

const Schema = new mongoose.Schema({
  departmentName: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ["Active", "Inactive"],
    default: "Active",
    required: true
  },
  legalEntityName: {
    type: String,
    required: true,
    ref: "Company",
  },
  legalEntityId: {
    type: String,
    ref: "Company",
  },
  parentDepartment: {
    type: String,
  },
  parentDepartmentId: {
    type: String,
    ref: "Department"
  },
  location: {
    type: String,
    required: true
  },
  //departmentComposite: {
  //  type: {
  //    departmentName: 1,
  //    legalEntityName: 1,
  //    location: 1
  //  },
  //  unique: true
  //},
  companyId: {
    type: String,
    ref: "Company"
  }
}, { timestamps: true });

module.exports = mongoose.model("Department", Schema);
