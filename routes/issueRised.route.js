const express = require("express");
const multer = require("multer");
const upload = multer();
const { createIssue,updateIssue,getIssues,getIssueByEmpId,getIssueById, getIssuesByCompanyId, uploadIssueAttachment } = require("../controllers/issueRise.controller");
const router = express.Router();

const prefix = "/issue"
// Parse multipart/form-data for form fields (no files on create/update)
router.post(`${prefix}/createIssue`, upload.any(), createIssue);
router.get(`${prefix}/issues`, getIssues);
router.get(`${prefix}/issuesByEmployeeId/:EmpId`, getIssueByEmpId);
router.get(`${prefix}/getIssuesById/:id`, getIssueById);
router.put(`${prefix}/updateIssue/:id`, upload.any(), updateIssue);
router.get(`${prefix}/issuesByCompanyId/:companyId`, getIssuesByCompanyId);
router.post(`${prefix}/upload`, upload.single('file'), uploadIssueAttachment);


module.exports = router;