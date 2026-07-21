const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const resignationSchema = {
  fullName: { type: String },
  reasonForResignation: { type: String },
  lastDayOfWorking: { type: Date },
  notifiedDate: { type: Date },
  employeeNumber: { type: String },
  uploadAttachments: { type: String },
  approvalSteps: [
    {
      level: { type: String }, // e.g., "Manager", "HR", "Admin"
      approverId: { type: String },
      approverName: { type: String },
      status: { type: String, },
      comments: { type: String },
      date: { type: Date }
    }
  ],
  currentApprovalLevel: { type: Number, default: 0 },
  // New workflow fields
  approverLevels: { type: Map, of: mongoose.Schema.Types.Mixed },
  currentLevel: { type: String },
  currentApprovers: [
    {
      approverId: { type: String },
      approverType: { type: String },
      approverName: { type: String },
      approverEmail: { type: String },
      level: { type: String }
    }
  ],
  approvalHistory: [
    {
      approverId: { type: String },
      approverName: { type: String },
      approverType: { type: String },
      level: { type: String },
      action: { type: String },
      comments: { type: String },
      timestamp: { type: Date }
    }
  ],
  overallStatus: { type: String },
  finalApprovalDate: { type: Date },
  finalApprover: { type: String },
  companyId: { type: String },
  employeeInfo: {
    name: { type: String },
    email: { type: String },
    department: { type: String },
    position: { type: String }
  }
};

const exitInterviewSchema = {
  q1: {
    type: String
  },
  q2: {
    type: String
  },
  q3: {
    type: String
  },
  q4: {
    type: String
  },
  q5: {
    type: String
  },
  q6: {
    type: String
  }
}

// Additional schemas for candidate-specific data
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

const Schema = new mongoose.Schema({

  personalInformation: {
    firstName: {
      type: String,
      require: true
    },
    lastName: {
      type: String,
      //required: true
    },
    gender: {
      type: String,
      require: true
    },
    title: {
      type: String,
      require: true
    },
    PanNumber: {
      type: String,
      require: true
    },
    middleName: {
      type: String,
      require: false
    },
    dateOfBirth: {
      type: Date,
      require: true
    },
    title: {
      type: String,
      require: true
    },

    password: {
      type: String,
      default: bcrypt.hashSync("Test@123"),
    },
    otp: {
      type: String,
    },
    otpExpire: {
      type: Date,
    },
    token: {
      type: String,
    },
    tokenExpire: {
      type: Date,
    },
    image: String,
    profilePicture: String,
  },
  contactInformation: {
    verified: {
      type: Boolean,
      default: true
    },
    email: {
      type: String,
      require: true,
    },
    workEmail: {
      type: String,
    },
    loginMethod: {
      type: String
    },
    mobileNumber: {
      type: Number,
      require: true
    },
    countryCode: {
      type: Number,
    },
    isSameWhatsapp: {
      type: Boolean,
    },
    whatsappNumber: {
      type: Number,
    },
    countryCode2: {
      type: Number,
    },
    homeAddress: {
      type: String,
    },
    countryOfBirth: {
      type: String,
    },
    StateOfBirth: {
      type: String,
    },
    nationality: {
      type: String,
    },
    marriageDate: {
      type: String,
    },
    Pf: {
      type: String,
    },
    FatherName: {
      type: String,
    },
    BloodGroup: {
      type: String,
    },


  },
  ChildInformation: [
    {
      lastName: {
        type: String,
      },
      firstName: {
        type: String,
      },
      gender: {
        type: String,
      },
      dateOfBirth: {
        type: Date,
      },
    }
  ],
  SpouseInformation: {
    lastName: {
      type: String,

    },
    firstName: {
      type: String,

    },
    Occupation: {
      type: String,

    },
    dateOfBirth: {
      type: Date,

    },
  },

  PresentAddress: {
    streetHouseNumber: {
      type: String,

    },
    addressLine2: {
      type: String,

    },
    city: {
      type: String,

    },
    postalCode: {
      type: String,

    },
    country: {
      type: String,

    },
    regionState: {
      type: String,

    },
    district: {
      type: String,

    },
    primaryEmergencyContactNumber: {
      type: String,

    },
    secondaryEmergencyContactNumber: {
      type: String,

    },
  },


  PermanentAddress: {
    streetHouseNumber: {
      type: String,

    },
    addressLine2: {
      type: String,

    },
    city: {
      type: String,

    },
    postalCode: {
      type: String,

    },
    country: {
      type: String,

    },
    regionState: {
      type: String,

    },
    district: {
      type: String,

    },
    primaryEmergencyContactNumber: {
      type: Number,

    },
    secondaryEmergencyContactNumber: {
      type: Number,

    },
  },


  employmentInformation: {
    hireDate: {
      type: Date,
      require: true
    },
    employeeNumber: {
      type: String,
      require: true
    },
    status: {
      type: String,
      enum: ["Active", "Inactive"],
      default: "Active",
      require: true
    },
    inactiveDate: {
      type: Date,
    },
    // Legacy fields - kept for backward compatibility
    // If single string exists, it will be treated as PRIMARY mapping
    legalEntity: {
      type: String,
      require: false,
      ref: "Entity"
    },
    department: {
      type: String,
      require: false,
      ref: "Department"
    },
    // New field: Array of Legal Entity & Function mappings
    legalEntityMappings: [{
      legalEntity: {
        type: String,
        require: true,
        ref: "Entity"
      },
      function: {
        type: String,
        require: true,
        ref: "Department"
      },
      // Optional per-mapping designation. Legacy employmentInformation.designation is derived from PRIMARY mapping when provided.
      designation: {
        type: String,
        ref: "Designation"
      },
      // Per-mapping Functional Head flag. Legacy employmentInformation.departmentHead is derived from PRIMARY mapping.
      functionalHead: {
        type: Boolean,
        default: false
      },
      type: {
        type: String,
        enum: ["PRIMARY", "SECONDARY"],
        default: "PRIMARY",
        require: true
      }
    }],
    designation: {
      type: String,
      require: true,
      ref: "Designation"
    },
    grade: {
      type: String,
      require: true,
      ref: "Grade"
    },
    location: {
      type: String,
      require: true
    },
    lineManager: {
      type: String,
      require: true
    },
    jobCategory: {
      type: String,
    },
    role: {
      type: String,
      require: true
    },
    departmentHead: {
      type: String,
      enum: ["Yes", "No"],
      default: "Yes",
      require: true
    },
    maritalStatus: {
      type: String,
    },
    highestEducationLevel: {
      type: String,
    },
    religion: {
      type: String,
    },
  },
  status: {
    type: String,
    enum: ["Active", "Inactive"],
    default: "Active"
  },
  companyId: {
    type: String,
    ref: "Company"
  },
  freeTrail: {
    type: String,
  },
  resignation: resignationSchema,
  exitInterview: exitInterviewSchema,

  candidateInformation: {
    originalCandidateId: {
      type: String,
      sparse: true
    },
    source: {
      type: String,
    },
    appliedOn: {
      type: Date,
    },
    experience: {
      type: String,
    },
    grossSalary: {
      type: Number
    },
    noticePeriod: {
      type: Number, // in days
    },
    probationPeriod: {
      type: Number, // in days
    },
    offerLetterDate: {
      type: Date,
    },
    resume: {
      type: String,
    },
    documents: [documentSchema],
    references: [referenceSchema],
    projectName: {
      type: String,
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
    bankDetails: {
      accountNumber: { type: String },
      ifscCode: { type: String },
      bankName: { type: String },
      branchName: { type: String },
      branchAddress: { type: String },
      city: { type: String },
      state: { type: String }
    },
    personalDetails: {
      aadharNumber: String,
      passportNumber: String,
      driverLicenseNumber: String,
      driverLicenseExpiry: String,
      driverLicensePeriod: String,
    },

    documentDetails: [
      {
        type: String, // Just the URL
      },
    ],
    moveToTalentPool: {
      type: String,
    },
    nextSuitableRole: {
      type: String,
    },
    feedbackId: {
      type: String,
    },
    educationQualification: {
      type: String,
    },
    dateOfJoining: {
      type: String,
    },
    showOfferLetter: {
      type: Boolean,
      default: false
    },
    // ✅ Insurance Details (restricted to Self only or Self + Family)
    insuranceDetails: {
      coverageFor: { type: String },
      spouseName: { type: String },
      spouseDob: { type: Date },
      child1Name: { type: String },
      child1Dob: { type: Date },
      child2Name: { type: String },
      child2Dob: { type: Date },
    },
  }

}, { timestamps: true });

Schema.index({ companyId: 1, 'contactInformation.email': 1 }, { unique: true, name: 'company_email_unique' });
// Support getCompanyObjectives team/function scoping queries.
Schema.index({ companyId: 1, 'employmentInformation.lineManager': 1 });
Schema.index({ companyId: 1, 'employmentInformation.department': 1 });

module.exports = mongoose.model("Employee", Schema);