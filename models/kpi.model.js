const mongoose = require("mongoose");

const Schema = new mongoose.Schema({
  // Basic Information
  kpiID: {
    type: String,
    default: function() {
      return 'KPI' + this._id;
    }
  },
  name: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: false
  },
  category: {
    type: String,
    enum: ['Financial', 'Operational', 'Sales', 'Marketing', 'HR', 'Customer', 'Project', 'Salesforce'],
    required: true
  },
  subCategory: {
    type: String,
    required: true
  },
  userId: {
    type: String,
    required: true
  },
  orgId: {
    type: String,
    required: true
  },
  enabled: {
    type: Boolean,
    default: true
  },
  dimension: {
    type: String,
    required: false
  },

  // Query String
  query: {
    type: String,
    required: false
  },

  // Measurement Properties
  measurementType: {
    type: String,
    enum: ['Numeric', 'Percentage', 'Currency', 'Ratio', 'Boolean'],
    required: true,
    default: 'Numeric'
  },
  uom: {  // Unit of Measure
    type: String,
    required: false
  },
  polarity: {
    type: String,
    enum: ['Positive', 'Negative'],
    required: false
  },

  // Format Settings
  formatConfig: {
    digitFormat: {
      type: String,
      enum: ['Auto', 'Whole', 'Decimal'],
      default: 'Auto'
    },
    decimalPlaces: {
      type: Number,
      default: 2
    },
    roundingMode: {
      type: String,
      enum: ['UP', 'DOWN', 'CEILING', 'FLOOR', 'HALF_UP', 'HALF_DOWN'],
      default: 'HALF_UP'
    },
    currencyCode: String
  },

  // Data Collection
  frequency: {
    type: String,
    enum: ['Daily', 'Weekly', 'Monthly', 'Quarterly', 'Yearly'],
    required: false,
    default: 'Monthly'
  },
  harvestSchedule: {
    startDate: Date,
    endDate: Date,
    specificDays: [Number],
    required: false
  },

  // Values
  target: {
    type: Number,
    required: false
  },
  actual: {
    type: Number,
    required: false
  },
  basevalue: {
    type: Number,
    required: false
  },
  thresholds: {
    critical: Number,
    warning: Number,
    success: Number,
    required: false
  },

  // Dates
  targetDate: {
    type: Date,
    required: false
  },
  actualDate: {
    type: Date,
    required: false
  },
  nextHarvestDate: {
    type: Date,
    required: false
  },

  // Status and Tracking
  status: {
    type: String,
    enum: ['Active', 'Inactive', 'Under Review', 'Archived'],
    default: 'Active'
  },
  trend: {
    type: String,
    enum: ['Increasing', 'Decreasing', 'Stable'],
    required: false
  },

  // Ownership and Approval
  owner: {
    type: String,
    required: false
  },
  department: {
    type: String,
    required: false
  },
  approvalRequired: {
    type: Boolean,
    default: false
  },
  isAlignedToCompany: {
    type: String,
    enum: ["Yes", "No"],
    default: "Yes"
  },

  // Metadata
  tags: [String],
  msc: {  // Measurement System Category
    type: String,
    required: false
  }
}, 
{ timestamps: true });

module.exports = mongoose.model("KPI", Schema);
