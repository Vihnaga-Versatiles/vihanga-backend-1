const bcrypt = require("bcryptjs");
const employees = [
  {
    personalInformation: {
      firstName: "Teresa",
      lastName: "Gornall",
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
      email: "teresa@ollaa.org123",
      loginMethod: "Manual",
    },
    employmentInformation: {
      status: "Active",
      departmentHead: "No",
      role: "Employee",//Employee, Manager, Super Admin, HR Admin
      hireDate: new Date("2022/09/20"),
      employeeNumber: "OLLAA03/21",
      jobCategory: "Operational",
      department: "Advocacy",
      location: "Australia",
      legalEntity: "OLLAA",
      designation: "Advocacy Associate",
      lineManager: "6274e19396bf9824e441be02",
    },
    status: "Active"
  },
  {
    personalInformation: {
      firstName: "Yosef",
      lastName: "Tola",
      gender: "Male",
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
      email: "ytola@ollaa.org123",
      loginMethod: "Manual",
    },
    employmentInformation: {
      status: "Active",
      departmentHead: "Yes",
      role: "Employee",//Employee, Manager, Super Admin, HR Admin
      hireDate: new Date("2022/01/05"),
      employeeNumber: "OLLAA 01/21",
      jobCategory: "Supervisor",
      department: "Education",
      location: "Kenya",
      legalEntity: "OLLAA",
      designation: "Head of Education",
      lineManager: "6274e19396bf9824e441be01",
    },
    status: "Active"
  },
  {
    personalInformation: {
      firstName: "Esther",
      lastName: "Kamau",
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
      email: "esther@ollaa.org123",
      loginMethod: "Manual",
    },
    employmentInformation: {
      status: "Active",
      departmentHead: "Yes",
      role: "Employee",//Employee, Manager, Super Admin, HR Admin
      hireDate: new Date("2022/11/15"),
      employeeNumber: "OLLAA05/21",
      jobCategory: "Supervisor",
      department: "Volunteer/HR",
      location: "Kenya",
      legalEntity: "OLLAA",
      designation: "Volunteer Coordinator",
      lineManager: "6274e19396bf9824e441be01",
    },
    status: "Active"
  },
];

module.exports = employees;