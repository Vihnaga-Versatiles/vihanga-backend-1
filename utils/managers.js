const bcrypt = require("bcryptjs");
const ObjectId = require('mongoose').Types.ObjectId;
const managers = [
  {
    _id: new ObjectId("6274e23696bf9824e441be16"),
    personalInformation: {
      firstName: "Super",
      lastName: "Admin",
      gender: "Female",
      dateOfBirth: Date.now(),
      password: bcrypt.hashSync("Test@123"),
      otp: "",
      otpExpire: null,
      token: "",
      tokenExpire: null,
      image: "",
      profilePicture: this.gender === "Male" ? "https://www.clipartmax.com/png/middle/103-1038880_user-rubber-stamp-female-user-icon.png" : "https://www.clipartmax.com/png/middle/103-1038880_user-rubber-stamp-female-user-icon.png",
    },
    contactInformation: {
      verified: true,
      email: "superadmin@gmail.com",
      loginMethod: "Manual",
    },
    employmentInformation: {
      status: "Active",
      departmentHead: "Yes",
      role: "Super Admin",//Employee, Manager, Super Admin, HR Admin
      legalEntity: "OLLAA",
    },
    status: "Active"
  },
  {
    _id: new ObjectId("6274e19396bf9824e441be01"),
    personalInformation: {
      firstName: "Seenaa",
      lastName: "Jim",
      gender: "Female",
      dateOfBirth: Date.now(),
      password: bcrypt.hashSync("Test@123"),
      otp: "",
      otpExpire: null,
      token: "",
      tokenExpire: null,
      image: "",
      profilePicture: this.gender === "Male" ? "https://www.clipartmax.com/png/middle/103-1038880_user-rubber-stamp-female-user-icon.png" : "https://www.clipartmax.com/png/middle/103-1038880_user-rubber-stamp-female-user-icon.png",
    },
    contactInformation: {
      verified: true,
      email: "Seena@ollaa.org123",
      loginMethod: "Manual",
    },
    employmentInformation: {
      status: "Active",
      departmentHead: "Yes",
      role: "Manager",//Employee, Manager, Super Admin, HR Admin
      jobCategory: "Director",
      department: "Advocacy",
      location: "United States",
      legalEntity: "OLLAA",
      designation: "Executive Director",
      lineManager: ""
    },
    status: "Active"
  },
  {
    _id: new ObjectId("6274e19396bf9824e441be02"),
    personalInformation: {
      firstName: "Alyssa",
      lastName: "Oravec",
      gender: "Female",
      dateOfBirth: Date.now(),
      password: bcrypt.hashSync("Test@123"),
      otp: "",
      otpExpire: null,
      token: "",
      tokenExpire: null,
      image: "",
      profilePicture: this.gender === "Male" ? "https://www.clipartmax.com/png/middle/103-1038880_user-rubber-stamp-female-user-icon.png" : "https://www.clipartmax.com/png/middle/103-1038880_user-rubber-stamp-female-user-icon.png",
    },
    contactInformation: {
      verified: true,
      email: "alyssa@ollaa.org123",
      loginMethod: "Manual",
    },
    employmentInformation: {
      hireDate: new Date("2022/09/17"),
      employeeNumber: "OLLAA02/21",
      status: "Active",
      departmentHead: "Yes",
      role: "Manager",//Employee, Manager, Super Admin, HR Admin
      jobCategory: "Supervisor",
      department: "Advocacy",
      location: "United States",
      legalEntity: "OLLAA",
      designation: "Advocacy Manager",
      lineManager: "6274e19396bf9824e441be01"
    },
  },
  {
    _id: new ObjectId("6274e19396bf9824e441be03"),
    personalInformation: {
      firstName: "Nadiya",
      lastName: "Boru",
      gender: "Female",
      dateOfBirth: Date.now(),
      password: bcrypt.hashSync("Test@123"),
      otp: "",
      otpExpire: null,
      token: "",
      tokenExpire: null,
      image: "",
      profilePicture: this.gender === "Male" ? "https://www.clipartmax.com/png/middle/103-1038880_user-rubber-stamp-female-user-icon.png" : "https://www.clipartmax.com/png/middle/103-1038880_user-rubber-stamp-female-user-icon.png",
    },
    contactInformation: {
      verified: true,
      email: "nboru@ollaa.org123",
      loginMethod: "Manual",
    },
    employmentInformation: {
      hireDate: new Date("2022/01/01"),
      employeeNumber: "OLLAA01/22",
      status: "Active",
      departmentHead: "Yes",
      role: "Manager",//Employee, Manager, Super Admin, HR Admin
      jobCategory: "Supervisor",
      department: "Communication",
      location: "Canada",
      legalEntity: "OLLAA",
      designation: "Communication Manager",
      lineManager: "6274e19396bf9824e441be01"
    },
    status: "Active"
  }
];

module.exports = managers;