const mongoose = require("mongoose");

const groupMembersSchema = new mongoose.Schema(
  {
    categoryName: String,
    categoryValue: String,
    categoryValueText: String,
    categoryValues: [],
  }
)


const previlegesSchema = new mongoose.Schema(
  {
    groupName: {
      type: String,
      required: true,
    },
    groupMembers: {
      type: [groupMembersSchema],
      default: []
    },
    excludeGroupMembers: {
      type: [groupMembersSchema],
      default: []
    },
    actualActiveGroupMembers: {
      type: Array,
      default: [],
    },
    activeGroupMembers: {
      type: Array,
      default: [],
    },
    inActiveGroupMembers: {
      type: Array,
      default: [],
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

const PrivilegeGroup = mongoose.models.PrivilegeGroup || mongoose.model("PrivilegeGroup", previlegesSchema);

module.exports = PrivilegeGroup;
