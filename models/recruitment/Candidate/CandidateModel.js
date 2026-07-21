const mongoose = require("mongoose");

const documentSchema = new mongoose.Schema({
  type: { type: String, required: true },
  url: { type: String, required: true },
  fileName: { type: String, required: true },
  fileSize: { type: String, required: true },
  uploadedAt: { type: Date, default: Date.now }
}, { _id: false });

const referenceSchema = new mongoose.Schema({
  name: { type: String },
  email: { type: String },
  phone: { type: String }
}, { _id: false });

const interviewerSchema = new mongoose.Schema({
  name: { type: String },
  email: { type: String },
  id: { type: String },
  feedbackId: { type: String }
}, { _id: false });

const reportingManagerSchema = new mongoose.Schema({
  name: { type: String },
  email: { type: String },
  id: { type: String }
}, { _id: false });

const candidateSchema = new mongoose.Schema(
  {
    feedbackId: {
      type: String,
      default: null,
    },
    experience: {
      type: String,
    },
    educationQualification: {
      type: String,
    },
    dateOfJoining: {
      type: String,

    },
    candidateId: {
      type: String,
      unique: true,
    },
    candidateName: {
      type: String,
      unique: "compositeIndex",
    },
    email: {
      type: String,
    },
    phone: {
      type: String,
    },
    // ✅ Additional required fields for employee conversion
    title: {
      type: String,
    },
    middleName: {
      type: String,
    },
    panNumber: {
      type: String,
    },
    cityStateOfBirth:{
      type: String,
    },
    countryOfBirth: {
      type: String,
    },
    stateOfBirth: {
      type: String,
    },
    nationality: {
      type: String,
    },
    marriageDate: {
      type: String,
    },
        maritalStatus:{
      type: String,
    },

    fatherName: {
      type: String,
    },
    bloodGroup: {
      type: String,
    },
    pfNumber: {
      type: String,
    },
    dob: {
      type: String,
      unique: "compositeIndex",
    },
    gender: {
      type: String,
    },
    location: {
      type: String,
    },
    source: {
      type: String,
    },
    department: {
      type: String,
    },
    designation: {
      type: String,
    },
    legalEntity: {
      type: String,
    },
    projectName: {
      type: String,
    },
    status: {
      type: String,
    },
    appliedOn: {
      type: Date,
      default: Date.now,
    },
    interviewer1: {
      type: interviewerSchema,
      default: {},
    },
    interviewer2: {
      type: interviewerSchema,
      default: {},
    },
    reportingManager: {
      type: reportingManagerSchema,
      default: {},
    },
    image: {
      type: String,
    },
    resume: {
      type: String,
    },
    documents: [documentSchema],
    references: [referenceSchema],
    grossSalary: { 
      type: Number 
    },
    noticePeriod: {
      type: Number, // in days
      default: null
    },
    probationPeriod: {
      type: Number, // in days
      default: null
    },
    moveToTalentPool: {
      type: String,
      default: null
    },
    nextSuitableRole: {
      type: String,
      default: null
    },
    offerLetterDate: {
      type: Date,
      default: null
    },
    joiningDate: {
      type: Date,
      default: null
    },
    companyId: {
      type: String,
    },
    // ✅ Profile Details
    profileDetails: {
      candidateId: String,
      firstName: String,
      lastName: String,
      phoneNumber: String,
      joiningDate: Date,
      designation: String,
      department: String,
      workingshift: String,
      emailId: String,
      status: String,
      gender: String,
      dateOfBirth: String,
      address: String,
    },

    // ✅ Personal Details
    personalDetails: {
      aadharNumber: String,
      passportNumber: String,
      driverLicenseNumber: String,
      driverLicenseExpiry: String,
      driverLicensePeriod: String,
      // ✅ Spouse Details (nested inside personalDetails)
      spouseDetails: {
        firstName: { type: String },
        surName: { type: String },
        dateOfBirth: { type: Date },
        occupation: { type: String },
      },
      // ✅ Present Address (nested inside personalDetails)
      presentAddress: {
        streetHouseNumber: { type: String },
        addressLine2: { type: String },
        city: { type: String },
        postalCode: { type: String },
        country: { type: String },
        regionState: { type: String },
        district: { type: String },
        primaryEmergencyContact: { type: String },
        secondaryEmergencyContact: { type:Number  },
      },
      // ✅ Permanent Address (nested inside personalDetails)
      permanentAddress: {
        streetHouseNumber: { type: String },
        addressLine2: { type: String },
        city: { type: String },
        postalCode: { type: String },
        country: { type: String },
        regionState: { type: String },
        district: { type: String },
        primaryEmergencyContact: { type: String },
        secondaryEmergencyContact: { type:Number  },
      },
    },

    // ✅ Bank Details
    bankDetails: {
      accountNumber: { type: String },
      ifscCode: { type: String },
      bankName: { type: String },
      branchName: { type: String },
      branchAddress: { type: String },
      city: { type: String },
      state: { type: String },
    },

    // ✅ Family Details
    familyDetails: {
      maritalStatus: String,
    },

    // ✅ Child Information (Array for multiple children)
    childInfoList: [
      {
        firstName: { type: String },
        lastName: { type: String },
        gender: { type: String },
        dateOfBirth: { type: Date },
      }
    ],

    // ✅ Insurance Details (restricted to Self only or Self + Family)
    insuranceDetails: {
      coverageFor: { type: String, enum: ["self_only", "self_family"], default: "self_only" },
      spouseName: { type: String },
      spouseDob: { type: Date },
      child1Name: { type: String },
      child1Dob: { type: Date },
      child2Name: { type: String },
      child2Dob: { type: Date },
    },

    showOfferLetter: {
      type: Boolean,
      default: false
    },

    // ✅ Document Details (can be multiple documents)
    documentDetails: [
      {
        type: String, // Just the URL
      },
    ],
  },
  {
    timestamps: true,
    indexes: [
      {
        fields: { candidateName: 1, dob: 1 },
        unique: true,
        name: "candidateName_dob_unique",
      },
    ],
  }
);

const CandidateModel = mongoose.model("Candidate", candidateSchema);

module.exports = CandidateModel;