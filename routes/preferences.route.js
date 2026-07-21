const express = require("express");
const { createpreference, getAllpreferences, getAllpreferencesById, updatepreference, deletepreference } = require("../controllers/preferences.controller");
const router = express.Router();
const prefix = "/preferences"
router.post(`${prefix}/createPreference`, createpreference);
router.get(`${prefix}/getPreferences`, getAllpreferences);
router.get(`${prefix}/getPreferences/:PreferenceId`, getAllpreferencesById);
router.delete(`${prefix}/deletePreference/:id`, deletepreference);
router.put(`${prefix}/updatePreference/:id`, updatepreference);
module.exports = router;
