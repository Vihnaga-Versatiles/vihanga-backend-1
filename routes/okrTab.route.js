const express = require("express");
const multer = require('multer');
const { createOkrTab, getAllOkrTab, deleteOkrTab, updateOkrTab, deleteOkrTabs, createObjectivesAndKeyResults, copyObjectives } = require("../controllers/okrTab.controller");
const { uploadFileToS3, getUploads, getUploadRecords, rollbackUpload, deleteUpload } = require("../controllers/okrBulkUpload.controller");
const upload = multer();
const router = express.Router();

const prefix = "/okrManagement"
router.post(`${prefix}/createOkrTab`, createOkrTab);
router.get(`${prefix}/getAllOkrTab/:companyId`, getAllOkrTab);
router.delete(`${prefix}/deleteOkrTab/:id`, deleteOkrTab);
router.post(`${prefix}/deleteOkrTabs`, deleteOkrTabs);
router.put(`${prefix}/updateOkrTab/:id`, updateOkrTab);
router.post(`${prefix}/createObjectivesAndKeyResults`, createObjectivesAndKeyResults);
router.post(`${prefix}/copyObjectives`, copyObjectives);

// Bulk Upload Routes
router.post(`${prefix}/uploads/file`, upload.single('file'), uploadFileToS3);
router.get(`${prefix}/uploads`, getUploads);
router.get(`${prefix}/uploads/:batchId/records`, getUploadRecords);
router.delete(`${prefix}/uploads/:batchId/rollback`, rollbackUpload);
router.delete(`${prefix}/uploads/:batchId`, deleteUpload);

module.exports = router;