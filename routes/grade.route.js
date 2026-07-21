const express = require("express");
const { createGrade, updateGrade, deleteGrade, getGrades, getGradeById, createOrUpdateMultipleGrades, deleteGrades } = require("../controllers/grade.controller");
const router = express.Router();

//const { isAuth } = require("../config/auth");
const prefix = "/grades"
router.post(`${prefix}/createGrade`, createGrade);
router.post(`${prefix}/createOrUpdateMultipleGrades`, createOrUpdateMultipleGrades);
router.put(`${prefix}/updateGrade/:id`, updateGrade);
router.post(`${prefix}/deleteGrades`, deleteGrades);
router.delete(`${prefix}/deleteGrade/:id`, deleteGrade);
router.get(`${prefix}/getGrades/:companyId`, getGrades);
router.get(`${prefix}/getGradeById/:id`, getGradeById);

module.exports = router;