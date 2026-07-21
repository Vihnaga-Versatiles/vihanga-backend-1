const express = require("express");
const { 
  createLeave, 
  getAllLeaves, 
  getLeaveById, 
  updateLeave, 
  deleteLeave,
  getSummary,
  approveLeave,
  getPendingApprovals,
  getApprovalDashboard,
  debugPendingApprovals,
  testEmailTemplates,
 
} = require("../../../controllers/Candidate/Leaves/Leaves.controller");
const multer = require('multer');
const { bulkUploadLeaves, getLeavesByCompany, bulkExportBalances } = require("../../../controllers/Candidate/Leaves/BulkLeaves.controller");
const {
  uploadLeaveBalanceFile,
  listLeaveBalanceBatches,
  getLeaveBalanceBatch,
  getLeaveBalanceBatchRecords,
  rollbackLeaveBalanceBatch,
  deleteLeaveBalanceBatch
} = require("../../../controllers/Candidate/Leaves/BulkLeaveBatchUpload.controller");
var upload = multer();
const router = express.Router();

// Leave CRUD operations
router.post("/leaves", upload.any(), createLeave);
router.get("/leaves", getAllLeaves);
router.get("/leaves/id", getLeaveById);
router.put("/leaves", upload.any(), updateLeave);
router.delete("/leaves", deleteLeave);

// Approval operations
router.post("/approve-leave", approveLeave);
router.get("/pending-approvals", getPendingApprovals);
router.get("/approval-dashboard", getApprovalDashboard);

// Summary and reporting
router.get("/summary", getSummary);

// Bulk operations
router.post("/bulk-upload/leave-type", bulkUploadLeaves);
router.get('/leaves/by-company', getLeavesByCompany);
router.get('/bulk-export-balances', bulkExportBalances);

// Batch uploads: file upload, list, view, rollback
router.post("/leave-balance/uploads/file", upload.single('file'), uploadLeaveBalanceFile);
router.get("/leave-balance/uploads", listLeaveBalanceBatches);
router.get("/leave-balance/uploads/:batchId", getLeaveBalanceBatch);
router.get("/leave-balance/uploads/:batchId/records", getLeaveBalanceBatchRecords);
router.delete("/leave-balance/uploads/:batchId/rollback", rollbackLeaveBalanceBatch);
router.delete("/leave-balance/uploads/:batchId", deleteLeaveBalanceBatch);

// Debug endpoint
router.get("/debug-pending-approvals", debugPendingApprovals);

// Test endpoints
router.get("/leaves/test", (req, res) => {
  res.send("Hello, Leaves API is working!");
});

router.post("/test-email-templates", testEmailTemplates);

module.exports = router;
