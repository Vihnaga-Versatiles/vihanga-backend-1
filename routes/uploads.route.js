const express = require("express");
const { createUpload, deleteUpload, getUploadsByCategory, getUploads, updateUpload } = require("../controllers/uploads.controller");
const router = express.Router();

//const { isAuth } = require("../config/auth");
const prefix = "/uploads"
router.get(`${prefix}/getUploads`, getUploads);

router.post(`${prefix}/createUpload`, createUpload);
router.get(`${prefix}/getUploadsByCategory/:category/:companyId`, getUploadsByCategory);
router.delete(`${prefix}/deleteUpload/:id`, deleteUpload);
router.put(`${prefix}/updateUpload/:id`, updateUpload);


module.exports = router;