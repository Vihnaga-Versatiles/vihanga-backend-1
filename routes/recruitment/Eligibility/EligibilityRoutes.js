// routes/recruitment/Candidate/candidateRoutes.js
const express = require("express");
const { createEligibilityCriteria, getEligibilityCriteria, updateEligibilityCriteria, getEligibilityCriteriaById, deleteEligibilityCriteria } = require("../../../controllers/Eligibility/EligibilityController");


const router = express.Router();


router.post("/eligibility-criteria", createEligibilityCriteria);
router.get("/eligibility-criteria", getEligibilityCriteria);
router.put("/eligibility-criteria", updateEligibilityCriteria);
router.get("/eligibility-criteria/id", getEligibilityCriteriaById);
router.delete("/eligibility-criteria", deleteEligibilityCriteria);


router.get("/eligibility/test", (req, res) => {
  res.send("Hello, API is working!");
});

module.exports = router;
