const express = require("express");
const { createCompetency, updateCompetency, deleteCompetency, getCompetencies, getCompetencyById} = require("../controllers/competency.controller");
const router = express.Router();

const prefix = "/competency"
router.post(`${prefix}/createCompetency`, createCompetency);
router.put(`${prefix}/updateCompetency/:id`, updateCompetency);
router.delete(`${prefix}/deleteCompetency/:id`, deleteCompetency);
router.get(`${prefix}/getCompetencies`, getCompetencies);
router.get(`${prefix}/getCompetencyById/:id`, getCompetencies);

module.exports = router;