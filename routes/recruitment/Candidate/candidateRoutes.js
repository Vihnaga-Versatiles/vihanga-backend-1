// routes/recruitment/Candidate/candidateRoutes.js
const express = require("express");
const router = express.Router();
const multer = require('multer');
var upload = multer();
const {
  createCandidate,
  getAllCandidates,
  UpdateCandiate,
  getCandidateById,
  deleteCandidateById,
  getSummary,
  getCandidatesAll,
  proxyFileDownload
} = require("../../../controllers/Candidate/candidateController");

router.post("/candidates",upload.any(), createCandidate);
router.get("/candidates", getAllCandidates);
router.get("/all-candidates", getCandidatesAll);
router.get("/getCandidateById", getCandidateById);
router.get("/getSummary", getSummary);
router.get("/proxyFileDownload", proxyFileDownload);
router.put("/candidates",upload.any(), UpdateCandiate);
router.delete("/candidates", deleteCandidateById);
// router.post("/files", upload.single("myfile"), uploadFiles);

module.exports = router;
