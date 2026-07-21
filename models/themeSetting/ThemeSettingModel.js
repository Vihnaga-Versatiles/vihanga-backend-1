const mongoose = require("mongoose");

// Hex color validation regex
const hexColorRegex = /^#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})$/;


//  Color Schema - Individual color definition
 
const colorSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Color name is required"],
      trim: true
    },
    code: {
      type: String,
      required: [true, "Color code is required"],
      uppercase: true,
      match: [hexColorRegex, "Invalid hex color code. Use format #RRGGBB or #RGB"]
    },
    description: {
      type: String,
      trim: true,
      default: "" // Empty string instead of null for consistency
    }
  },
  { _id: false }
);

/**
 * Section Schema - Groups colors into primary/secondary sections
 */
const sectionSchema = new mongoose.Schema(
  {
    sectionTitle: {
      type: String,
      required: [true, "Section title is required"],
      trim: true
    },
    colors: {
      type: [colorSchema],
      validate: {
        validator: (colors) => Array.isArray(colors) && colors.length > 0,
        message: "At least one color is required per section"
      }
    }
  },
  { _id: false }
);

/**
 * Main Theme Schema
 */
const themeSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: [true, "Company ID is required"],
      index: true
    },
    themeName: {
      type: String,
      required: [true, "Theme name is required"],
      trim: true,
      maxlength: [100, "Theme name cannot exceed 100 characters"]
    },
    logoUrl: {
      type: String,
      trim: true,
      default: null
    },
    primary: {
      type: sectionSchema,
      required: [true, "Primary colors section is required"]
    },
    secondary: {
      type: sectionSchema,
      required: [true, "Secondary colors section is required"]
    },
    isDefault: {
      type: Boolean,
      default: false,
      index: true
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    }
  },
  {
    timestamps: true, // Adds createdAt and updatedAt
    collection: "themes"
  }
);

// Compound indexes for faster queries
themeSchema.index({ companyId: 1, isDefault: 1 });

/**
 * Pre-save middleware - Ensure only ONE default theme per company
 */
themeSchema.pre("save", async function (next) {
  if (this.isDefault && this.isModified("isDefault")) {
    await this.constructor.updateMany(
      { 
        companyId: this.companyId, 
        _id: { $ne: this._id } 
      },
      { 
        $set: { isDefault: false } 
      }
    );
  }
  next();
});

/**
 * Static method - Get active/default theme for a company
 */
themeSchema.statics.getCompanyTheme = async function (companyId) {
  // Try to find default theme
  let theme = await this.findOne({ 
    companyId, 
    isDefault: true 
  });
  
  // If no default, return most recent theme
  if (!theme) {
    theme = await this.findOne({ companyId }).sort({ updatedAt: -1 });
  }
  
  return theme;
};

module.exports = mongoose.model("Theme", themeSchema);