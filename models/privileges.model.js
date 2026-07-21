const mongoose = require("mongoose");

const privilegeSchema = new mongoose.Schema(
  {
    category: String,
    page: String,
    view: {
      type: Boolean,
      default: false,
    },
    edit: {
      type: Boolean,
      default: false,
    },
    delete: {
      type: Boolean,
      default: false,
    },
  }
)

const previlegesSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: false,
    },
    active: {
      type: Boolean,
      default: true,
      required: false,
    },
    privileges: {
      type: [privilegeSchema],
      required: true,
    },
    privilegeGroup: {
      type: String,
      ref: "PrivilegeGroup"
    },
    companyId: {
      type: String,
      ref: "Company"
    }
  },
  {
    timestamps: true,
  }
);

const Privilege = mongoose.models.Privilege || mongoose.model("Privilege", previlegesSchema);

module.exports = Privilege;
