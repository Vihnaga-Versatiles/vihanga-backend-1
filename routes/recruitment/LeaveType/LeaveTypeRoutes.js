// routes/recruitment/Candidate/candidateRoutes.js
const express = require("express");
const { createLeaveType, getAllLeaveTypes, updateLeaveType, getLeaveTypeById, deleteLeaveTypeById } = require("../../../controllers/LeaveType/LeaveTypeController");
const multer = require("multer");

var upload = multer();

const router = express.Router();

router.post("/leave-type",upload.any(), createLeaveType);
router.get("/leave-type", getAllLeaveTypes);
router.put("/leave-type",upload.any(), updateLeaveType);
router.get("/leave-type", getLeaveTypeById);
router.delete("/leave-type", deleteLeaveTypeById);


router.get("/leave-type/test", (req, res) => {
  res.send("Hello, API is working!");
});

module.exports = router;
