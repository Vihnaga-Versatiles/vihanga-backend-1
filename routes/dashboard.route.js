const express = require("express");
const { getDashboardData, getTaskDashboardData } = require("../controllers/dashboard.controller");
const router = express.Router();

// const { isAuth } = require("../config/auth");
const prefix = "/dashboard";

router.get(`${prefix}/getDashboardData`, getDashboardData);
router.get(`${prefix}/getTaskDashboardData`, getTaskDashboardData);

module.exports = router;