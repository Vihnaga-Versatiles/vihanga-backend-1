const express = require("express");
const {
  createDocumentType,
  getAllDocumentTypes,
  getActiveDocumentTypes,
  getDocumentTypeById,
  getDocumentTypeFormConfig,
  updateDocumentType,
  deleteDocumentTypeById,
} = require("../../controllers/DocumentPanel/DocumentTypeController");

const router = express.Router();

// Create document type
router.post("/document-type", createDocumentType);

// Get all document types (with pagination and filters)
router.get("/document-type", getAllDocumentTypes);

// Get active document types (for employee dropdown)
router.get("/document-type/active", getActiveDocumentTypes);

// Get document type by ID
router.get("/document-type/:id", getDocumentTypeById);

// Get form configuration for document type
router.get("/document-type/:id/form-config", getDocumentTypeFormConfig);

// Update document type
router.put("/document-type", updateDocumentType);

// Delete document type
router.delete("/document-type", deleteDocumentTypeById);

module.exports = router;

