const express = require("express");
const {
  createUser,
  fetchAllUsers,
  inviteLogin,
  saveUserResults,
  getUserResults,
} = require("../../controllers/psychometric/psychometricUserController");

const router = express.Router();

// Invite-link authentication (no Google login)
router.post("/invite-login", inviteLogin);

// Assessment results
router.post("/save-results", saveUserResults);
router.get("/user-results", getUserResults);

// User management
router.get("/users", fetchAllUsers);
router.post("/users", createUser);

module.exports = router;
