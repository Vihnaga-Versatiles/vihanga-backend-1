const express = require("express");
const {
  createUser,
  fetchAllUsers,
  loginGoogleUser,
  saveUserResults,
  getUserResults,
} = require("../../controllers/psychometric/psychometricUserController");

const router = express.Router();

// Google login / candidate authentication
router.post("/google-login", loginGoogleUser);

// Assessment results
router.post("/save-results", saveUserResults);
router.get("/user-results", getUserResults);

// User management
router.get("/users", fetchAllUsers);
router.post("/users", createUser);

module.exports = router;
