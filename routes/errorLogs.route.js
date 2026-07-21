const express = require("express");
const router = express.Router();
const {
  getErrorLogs,
  getErrorLogFacets,
  getErrorLogById,
} = require("../controllers/errorLogs.controller");

const prefix = "/error-logs";

router.get(`${prefix}`, getErrorLogs);
router.get(`${prefix}/modules`, getErrorLogFacets);
router.get(`${prefix}/:id`, getErrorLogById);

module.exports = router;






