// routes/recruitment/index.js
const express = require("express");
const router = express.Router();

const candidateRoutes = require("./Candidate/candidateRoutes");

const feedbackRoutes = require("./Feedback/FeedbackRoutes")

const eligibilityRoutes = require("./Eligibility/EligibilityRoutes")

const leaveTypeRoutes = require("./LeaveType/LeaveTypeRoutes");

const leavesRoutes = require("./Leaves/Leaves.routes");
const workFlowRoutes = require("./workflow/workflowRoutes");

const timeTrakingRoutes=require("./TimeTraking/TimeTrakingRoutes");

const resignationRoutes = require("./Resignation/resignationRoutes")

const exitInterViewRoutes = require("./ExitInterview/exitInterviewRouter")

const documentTypeRoutes = require("../DocumentPanel/DocumentTypeRoutes");

const documentSubmissionRoutes = require("../DocumentPanel/DocumentSubmissionRoutes");



// URL will be: /api/recruitment/...
router.use("/recruitment", candidateRoutes);
router.use("/recruitment", feedbackRoutes);
router.use("/recruitment", eligibilityRoutes);
router.use("/recruitment", leaveTypeRoutes);
router.use("/recruitment", workFlowRoutes);


router.use("/recruitment", leavesRoutes);

router.use("/recruitment", timeTrakingRoutes);

router.use("/recruitment", resignationRoutes);

router.use("/recruitment", exitInterViewRoutes);

router.use("/recruitment", documentTypeRoutes);

router.use("/recruitment", documentSubmissionRoutes);









module.exports = router;
