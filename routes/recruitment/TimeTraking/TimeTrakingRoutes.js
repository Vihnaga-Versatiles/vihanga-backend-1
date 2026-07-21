// routes/recruitment/TimeTracking/TimeTrackingRoutes.js
const express = require("express");
const { 
  createTimeTracking, 
  getAllTimeTrackings, 
  getTimeTrackingById,
  updateTimeTracking,
  deleteTimeTracking,
  approveTimeTracking,
  getPendingApprovals,
  getApprovalDashboard,
  bulkUploadTimeTracking,
  uploadTimeTrackingFile,
  listTimeTrackingBatches,
  getTimeTrackingBatch,
  getTimeTrackingBatchRecords,
  rollbackTimeTrackingBatch,
  deleteTimeTrackingBatch
} = require("../../../controllers/timeTracking/TimeTrackingController");
const multer = require("multer");
const upload = multer();

const router = express.Router();

// Basic CRUD operations
router.post("/time-tracking", createTimeTracking);
router.post("/bulk-upload/time-tracking", bulkUploadTimeTracking);

// Batch uploads: file upload, list, view, rollback
router.post("/time-tracking/uploads/file", upload.single('file'), uploadTimeTrackingFile);
router.get("/time-tracking/uploads", listTimeTrackingBatches);
router.get("/time-tracking/uploads/:batchId", getTimeTrackingBatch);
router.get("/time-tracking/uploads/:batchId/records", getTimeTrackingBatchRecords);
router.delete("/time-tracking/uploads/:batchId/rollback", rollbackTimeTrackingBatch);
router.delete("/time-tracking/uploads/:batchId", deleteTimeTrackingBatch);

router.get("/time-tracking", getAllTimeTrackings);
router.get("/time-tracking/entry", getTimeTrackingById);
router.put("/time-tracking/update", updateTimeTracking);
router.delete("/time-tracking/delete", deleteTimeTracking);

// Approval workflow endpoints
router.post("/time-tracking/approve", approveTimeTracking);
router.get("/time-tracking/pending-approvals", getPendingApprovals);
router.get("/time-tracking/approval-dashboard", getApprovalDashboard);

// Test endpoint
router.get("/time-tracking/test", (req, res) => {
  res.send("Hello, Time Tracking API with Approval Workflow is working!");
});

module.exports = router;
