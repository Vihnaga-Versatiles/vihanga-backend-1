const express = require("express");
const { createDepartment, updateDepartment, deleteDepartment, getDepartments, getDepartmentById, createOrUpdateMultipleDepartments, deleteDepartments, getDepartmentsData } = require("../controllers/department.controller");
const router = express.Router();

//const { isAuth } = require("../config/auth");
const prefix = "/departments"
router.post(`${prefix}/createDepartment`, createDepartment);
router.post(`${prefix}/createOrUpdateMultipleDepartments`, createOrUpdateMultipleDepartments);
router.put(`${prefix}/updateDepartment/:id`, updateDepartment);
router.post(`${prefix}/deleteDepartments`, deleteDepartments);
router.delete(`${prefix}/deleteDepartment/:id`, deleteDepartment);
router.get(`${prefix}/getDepartmentsData/:companyId`, getDepartmentsData);
router.get(`${prefix}/getDepartments`, getDepartments);
router.get(`${prefix}/getDepartmentById/:id`, getDepartmentById);

module.exports = router;