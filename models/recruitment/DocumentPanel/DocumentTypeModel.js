const mongoose = require("mongoose");

const documentTypeSchema = new mongoose.Schema(
  {
    companyId: {
      type: String,
      required: true,
    },
    documentTypeName: {
      type: String,
      required: true,
    },
    documentCode: {
      type: String,
      unique: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
    privilegeGroup: {
      type: String,
      default: "",
    },
    privilegeGroupId: {
      type: String,
      default: "",
    },
    requiresFileUpload: {
      type: Boolean,
      default: true,
    },
    dynamicFields: [
      {
        fieldName: {
          type: String,
          required: true,
        },
        fieldType: {
          type: String,
          enum: ["text", "number", "date", "file", "dropdown", "radio", "checkbox"],
          required: true,
        },
        isRequired: {
          type: Boolean,
          default: false,
        },
        fieldOptions: {
          type: String, // Comma-separated values for dropdown/radio
          default: "",
        },
        fieldOrder: {
          type: Number,
          default: 0,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Create compound unique index for documentTypeName and companyId
documentTypeSchema.index({ documentTypeName: 1, companyId: 1 }, { unique: true });

const DocumentTypeModel = mongoose.model("DocumentType", documentTypeSchema);

module.exports = DocumentTypeModel;

