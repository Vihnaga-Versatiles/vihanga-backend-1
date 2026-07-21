const express = require("express");
const { createGuidelinesScreen, getAllGuidelinesScreens, getAllGuidelinesScreensById, updateGuidelinesScreen, deleteGuidelinesScreen } = require("../controllers/guidelinesScreen.controller");
const router = express.Router();

const prefix = "/guidelines"
router.post(`${prefix}/createGuideline`, createGuidelinesScreen);
router.get(`${prefix}/getGuidelines`, getAllGuidelinesScreens);
router.get(`${prefix}/getGuidelines/:guidelineId`, getAllGuidelinesScreensById);
router.delete(`${prefix}/deleteGuideline/:id`, deleteGuidelinesScreen);
router.put(`${prefix}/updateGuideline/:id`, updateGuidelinesScreen);
module.exports = router;