const express = require("express");
const { createPrivilege, getAllPrivileges, deletePrivilege, updatePrivilege, getPrivilege, deletePrivilegeMultiple, updatePrivilegesActive, updatePrivilegePermissionGroup, updatePrivilegesInActive, pickCategory } = require("../controllers/privileges.controller");
const router = express.Router();

//const { isAuth } = require("../config/auth");
const prefix = "/privileges"
router.post(`${prefix}/createPrivilege`, createPrivilege);
router.get(`${prefix}/getPrivilege/:role/:companyId`, getPrivilege);
router.get(`${prefix}/getAllPrivileges/:companyId`, getAllPrivileges);
router.post(`${prefix}/deletePrivilegeMultiple`, deletePrivilegeMultiple);
router.delete(`${prefix}/deletePrivilege/:id`, deletePrivilege);
router.put(`${prefix}/updatePrivilegePermissionGroup/:id`, updatePrivilegePermissionGroup);
router.post(`${prefix}/updatePrivilegesInActive`, updatePrivilegesInActive);
router.post(`${prefix}/updatePrivilegesActive`, updatePrivilegesActive);
router.put(`${prefix}/updatePrivilege/:id`, updatePrivilege);

module.exports = router;