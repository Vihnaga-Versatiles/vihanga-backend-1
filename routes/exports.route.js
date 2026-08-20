const express = require("express");
const {
  exportEmployees,
  exportLeaves,
  exportTasks,
  exportObjectives,
  exportTimeEntries,
} = require("../controllers/exports.controller");

const router = express.Router();
const prefix = "/exports";

router.get(`${prefix}/employees`, exportEmployees);
router.get(`${prefix}/leaves`, exportLeaves);
router.get(`${prefix}/tasks/:userId/:companyId`, exportTasks);
router.get(`${prefix}/objectives`, exportObjectives);
router.get(`${prefix}/time-entries`, exportTimeEntries);

module.exports = router;


