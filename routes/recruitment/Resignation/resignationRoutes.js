const express = require("express");
const router = express.Router();
const multer = require("multer");
const { createResignationForm, getAllResignationForms,getResignationFormById,
  updateResignationForm,
  deleteResignationForm,
  approveResignationForm } = require("../../../controllers/resignationForm/resignationController");



const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname)
});

const upload = multer({ storage });
router.post('/createResignation',upload.single('uploadAttachments'),  createResignationForm);
router.get('/getAllResignations', getAllResignationForms);
router.get('/getResignation', getResignationFormById);
router.put('/updateResignation',upload.single('uploadAttachments'),  updateResignationForm);
router.delete('/deleteResignation', deleteResignationForm);
router.post("/approve-resignation", approveResignationForm);

router.get('/resignation/test', (req, res) => {
  res.send('Resignation form API is working!');
});

module.exports = router;
