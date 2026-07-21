const express = require("express");
const { createSessionScreen, getAllSessionScreens, getAllSessionScreensById, updateSessionScreen, deleteSessionScreen } = require("../controllers/sessionScreen.controller");
const router = express.Router();

const prefix = "/sessions"
router.post(`${prefix}/createSession`, createSessionScreen);
router.get(`${prefix}/getSessionsByUserId/:userId`, getAllSessionScreens);
router.get(`${prefix}/getSessions/:sessionId`, getAllSessionScreensById);
router.delete(`${prefix}/deleteSession/:id`, deleteSessionScreen);
router.put(`${prefix}/updateSession/:id`, updateSessionScreen);
module.exports = router;