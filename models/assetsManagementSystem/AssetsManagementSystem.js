const mongoose = require('mongoose');

const assetSchema = new mongoose.Schema({
  assetType: {
    type: String,
    // required: true
  },
  assetNumber: {
    type: String,
    // required: true
  },
  issueDate: {
    type: Date,
    // required: true
  },
  // collectionDate: {
  //   type: Date,
  //   // required: true
  // },
  handoverDate: {
    type: Date,
    // required: true
  },
});


const employeeSchema = new mongoose.Schema({
  companyId: {
    type: String,
    required: true
  },
  fullName: {
    type: String,
    // required: true
  },
  department: {
    type: String,
    // required: true
  },
  workLocation: {
    type: String,
    // required: true
  },
  employeeId: {
    type: String,
    // required: true,
    unique: true
  },
  position: {
    type: String,
    // required: true
  },
  assets: [assetSchema]
});

// Create compound index for companyId and employeeId to ensure uniqueness within company
employeeSchema.index({ companyId: 1, employeeId: 1 }, { unique: true });

 const AssetsManagementModel= mongoose.model('AssetsManagementSystem', employeeSchema);


 module.exports = AssetsManagementModel