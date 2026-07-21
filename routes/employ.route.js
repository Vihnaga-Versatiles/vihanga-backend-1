const express = require("express");
const { createEmployee, updateEmployee, deleteEmploy, changePassword, forgotpassword, getEmployeByDateOfBirth, resetpassword, getEmployeByHireDate, getEmployees, getEmployeById, orgChartData, createOrUpdateMultipleemploys, deleteEmployees, getEmployeesAll } = require("../controllers/employee.controller");
const { sendEmailToEmployee } = require("../controllers/employee.controller");
const router = express.Router();

//const { isAuth } = require("../config/auth");
const prefix = "/employees"
router.post(`${prefix}/createEmployee`, createEmployee);
router.get(`${prefix}/getEmployeesAll/:companyId`, getEmployeesAll);
router.get(`${prefix}/getEmployees/:companyId`, getEmployees);
router.post(`${prefix}/sendCredentials/:companyId`, sendEmailToEmployee);

router.post(`${prefix}/createOrUpdateMultipleEmployees`, createOrUpdateMultipleemploys);
router.put(`${prefix}/deleteEmployee/:id`, deleteEmploy);

router.get(`${prefix}/getOrgChartData/:companyId`, orgChartData);
router.put(`${prefix}/updateEmployee/:id`, updateEmployee);
router.post(`${prefix}/deleteEmployees`, deleteEmployees);
router.get(`${prefix}/getEmployeeById/:id`, getEmployeById);
router.get(`${prefix}/getEmployeByHireDate`, getEmployeByHireDate);
router.get(`${prefix}/getEmployeByDateOfBirth`, getEmployeByDateOfBirth);
//change password
router.post(`${prefix}/change-password`, changePassword);

router.post(`${prefix}/forgotpassword`, forgotpassword);

router.post(`${prefix}/resetpassword`, resetpassword);

module.exports = router;