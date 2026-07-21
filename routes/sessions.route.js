const express = require("express");
const { getActiveSessions, getNotActiveEmployees, getSessionHistory, getActivityUsers } = require("../controllers/sessions.controller");
const router = express.Router();

const prefix = "/sessions";

router.get(`${prefix}/active/:companyId`, getActiveSessions);
router.get(`${prefix}/not-active/:companyId`, getNotActiveEmployees);
router.get(`${prefix}/history/:companyId`, getSessionHistory);
router.get(`${prefix}/activity/:companyId`, getActivityUsers);

module.exports = router;


