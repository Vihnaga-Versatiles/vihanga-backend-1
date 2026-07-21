const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    image: {
      type: String,
      required: false,
    },
    address: {
      type: String,
      required: false,
    },
    country: {
      type: String,
      required: false,
    },
    city: {
      type: String,
      required: false,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },
    phone: {
      type: String,
      required: false,
    },
    password: {
      type: String,
      required: false,
    },
    verified: {
      type: Boolean,
      default: true,
    },
    emailSignup: {
      type: Boolean,
      default: false,
    },
    role: {
      type: String,
      required: false,
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
  },
  {
    timestamps: true,
  }
);

const User = mongoose.models.User || mongoose.model("User", userSchema);

module.exports = User;
