const express = require("express");
const multer = require("multer");
const {
  createDocumentSubmission,
  getAllDocumentSubmissions,
  getDocumentSubmissionById,
  approveDocumentSubmission,
  rejectDocumentSubmission,
  downloadDocument,
  updateDocumentSubmission,
  deleteDocumentSubmission,
} = require("../../controllers/DocumentPanel/DocumentSubmissionController");

const upload = multer();

const router = express.Router();

// Create document submission (with file upload)
router.post("/document-submission", upload.any(), createDocumentSubmission);

// Get all document submissions (with pagination and filters)
router.get("/document-submissions", getAllDocumentSubmissions);

// Get document submission by ID
router.get("/document-submissions/:id", getDocumentSubmissionById);

// Approve document submission
router.put("/document-submissions/:id/approve", approveDocumentSubmission);

// Reject document submission
router.put("/document-submissions/:id/reject", rejectDocumentSubmission);

// Download document file
router.get("/document-submissions/:id/download", downloadDocument);

// Update document submission
router.put("/document-submissions/:id", upload.any(), updateDocumentSubmission);

// Delete document submission
router.delete("/document-submissions/:id", deleteDocumentSubmission);

module.exports = router;

