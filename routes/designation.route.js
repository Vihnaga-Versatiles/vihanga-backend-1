const express = require("express");
const { createDesignation, updateDesignation, deleteDesignation, getDesignations, getDesignationById, createOrUpdateMultipleDesignations, deleteDesignations } = require("../controllers/designation.controller");
const router = express.Router();

//const { isAuth } = require("../config/auth");
const prefix = "/designations"
router.post(`${prefix}/createDesignation`, createDesignation);
router.post(`${prefix}/createOrUpdateMultipleDesignations`, createOrUpdateMultipleDesignations);
router.put(`${prefix}/updateDesignation/:id`, updateDesignation);
router.post(`${prefix}/deleteDesignations`, deleteDesignations);
router.delete(`${prefix}/deleteDesignation/:id`, deleteDesignation);
router.get(`${prefix}/getDesignations/:companyId`, getDesignations);
router.get(`${prefix}/getDesignationById/:id`, getDesignationById);

module.exports = router;