const express = require("express");
const { createCompany, updateCompany, deleteCompany, getCompanies, getCompanyById, createOrUpdateMultipleCompanies, deleteCompanies, getCompanyConfig, updateCompanyConfig } = require("../controllers/company.controller");
const router = express.Router();

//const { isAuth } = require("../config/auth");
const prefix = "/companies"
router.post(`${prefix}/createCompany`, createCompany);
router.post(`${prefix}/createOrUpdateMultipleCompanies`, createOrUpdateMultipleCompanies);
router.put(`${prefix}/updateCompany/:id`, updateCompany);
router.post(`${prefix}/deleteCompanies`, deleteCompanies);
router.delete(`${prefix}/deleteCompany/:id`, deleteCompany);
router.get(`${prefix}/getCompanies`, getCompanies);
router.get(`${prefix}/getCompanyById/:id`, getCompanyById);
router.get(`${prefix}/getCompanyConfig/:id`, getCompanyConfig);
router.put(`${prefix}/updateCompanyConfig/:id`, updateCompanyConfig);

module.exports = router;