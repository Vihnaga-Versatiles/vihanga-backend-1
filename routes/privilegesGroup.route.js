const express = require("express");
const { createPrivilege, getAllPrivileges, deletePrivilege, updatePrivilege, getPrivilege, deletePrivilegeMultiple, updatePrivilegesActive, updatePrivilegesInActive } = require("../controllers/privilegesGroup.controller");
const router = express.Router();

//const { isAuth } = require("../config/auth");
const prefix = "/privilegesgroups"
router.post(`${prefix}/createPrivilegeGroup`, createPrivilege);
router.get(`${prefix}/getPrivilegeGroup/:role/:companyId`, getPrivilege);
router.get(`${prefix}/getAllPrivilegesGroup/:companyId`, getAllPrivileges);
router.post(`${prefix}/deletePrivilegeGroupMultiple`, deletePrivilegeMultiple);
router.delete(`${prefix}/deletePrivilegeGroup/:id`, deletePrivilege);
router.post(`${prefix}/updatePrivilegesGroupInActive`, updatePrivilegesInActive);
router.post(`${prefix}/updatePrivilegesGroupActive`, updatePrivilegesActive);
router.put(`${prefix}/updatePrivilegeGroup/:id`, updatePrivilege);

module.exports = router;