const mongoose = require("mongoose");
const userSchema = new mongoose.Schema(
  {
    sessionName: {
      type: String,
      required: true,
    },
    sessionStartDate: {
      type: Date,
      required: true,
    },
    sessionEndDate: {
      type: Date,
      required: true,
    },
    sessionOwners: {
      type: Array,
      required: true,
    },
    employees: {
      type: Array,
      required: true
    },
    performance: {
      type: Array,
      required: true
    },
    employeesGroup: {
      type: String
    },
    templateName: {
      type: String,
    }
  },
  {
    timestamps: true,
  }
);

const User = mongoose.model("sessionscreen", userSchema);

module.exports = User;
