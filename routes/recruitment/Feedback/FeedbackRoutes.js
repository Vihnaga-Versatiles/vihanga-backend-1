// routes/recruitment/Candidate/candidateRoutes.js
const express = require("express");
const { submitFeedback, getFeedback, documentUpload,deleteDocument } = require("../../../controllers/Feedback/FeedbackController");
const router = express.Router();
const multer = require("multer");
var upload = multer();



router.post("/feedback", upload.single('file'), submitFeedback);

router.get("/feedback", getFeedback);

router.post("/document-upload", upload.any(), documentUpload);

router.delete("/deleteDocument", deleteDocument);

router.get("/feedback/test", (req, res) => {
  res.send("Hello, API is working!");
});

module.exports = router;
