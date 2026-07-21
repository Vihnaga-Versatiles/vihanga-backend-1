const mongoose = require("mongoose");

const Schema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      // required: true
    },
    businessEmail: {
      type: String,
      required: true,
    },

    phoneNumber: String,
    sizeOfOrganization: {
      type: String,
      required: true,
    },
    message: String,
    address: String,
    drynoEmail: String,
    // secondName: {
    //   type: String,
    //   // required: true
    // },

    // region: {
    //   type: String,
    //   required: true
    // },
  },
  { timestamps: true }
);

module.exports = mongoose.model("RequestDemo", Schema);
