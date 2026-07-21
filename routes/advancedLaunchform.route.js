const express = require("express");
const { createLaunchForm, getAllLaunchForms, getAllLaunchFormsById, getAllLaunchFormsByEmployeeId, updateLaunchForm, deleteLaunchForm, getAdvancedLaunchFormsByEmployeeId } = require("../controllers/advancedLaunchform.controller");
const router = express.Router();

const prefix = "/advanced-launchform"
router.post(`${prefix}/createForm`, createLaunchForm);
router.get(`${prefix}/getForms`, getAllLaunchForms);
router.get(`${prefix}/getFormsByEmployeeId/:employeeId`, getAllLaunchFormsByEmployeeId);
router.get(`${prefix}/getReviewFormsByEmployeeId/:employeeId/:role/:tab`, getAdvancedLaunchFormsByEmployeeId);
router.get(`${prefix}/getForms/:formId`, getAllLaunchFormsById);
router.delete(`${prefix}/deleteForm/:id`, deleteLaunchForm);

router.put(`${prefix}/updateForm/:id`, updateLaunchForm);
module.exports = router;