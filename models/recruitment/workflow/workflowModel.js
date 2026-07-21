const mongoose = require("mongoose");

// Sub-schema for Transaction Type
const transactionTypeSchema = new mongoose.Schema(
  {
    id: {
      type: String,
    //   required: true,
    },
    title: {
      type: String,
    //   required: true,
    },
    description: { type: String },
  },
  { _id: false }
);

// Sub-schema for Condition
const conditionSchema = new mongoose.Schema(
  {
    attribute: {
      type: String,
      enum: ['days'], // Can be extended in the future
    },
    operator: {
      type: String,
      enum: ['equal_to', 'less_than_or_equal', 'greater_than_or_equal'],
    },
    value: {
      type: Number,
    },
  },
  { _id: false }
);

// Sub-schema for Workflow Details
const workflowDetailsSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      //   required: true,
    },
    description: { type: String },
    condition: {
      type: mongoose.Schema.Types.Mixed, // Allows both structured object and simple string
    },
  },
  { _id: false }
);

// Sub-schema for individual approver in the approval chain
const approverSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      // required: true
    },
    title: {
      type: String,
      // required: true
    },
    subtitle: { 
      type: String 
    },
  },
  { _id: false }
);

// Main Workflow Schema
const workflowSchema = new mongoose.Schema(
  {
        companyId: {
            type: String,
            // required: true
        },

    transactionType: transactionTypeSchema,

    workflowDetails: workflowDetailsSchema,

    // Approval chain now stores the new format with numeric keys and arrays of approvers
    approvalChain: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
  },
  {
    timestamps: true,
  }
);

const WorkflowModel = mongoose.model("Workflow", workflowSchema);

module.exports = WorkflowModel;
