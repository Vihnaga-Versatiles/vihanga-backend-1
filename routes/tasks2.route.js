const express = require("express");
const { createTask, getAllTasks, deleteTask, updateTask, approveTask, getTasksByRole, getTasksByID, deleteTasks, UpdateMultipleTasks, getAuditTrail,createSheet, updateSheet, copyTask } = require("../controllers/tasks2.controller");
const router = express.Router();
const { saveChangedTasks } = require("../middlewares/AuditTrailData");

//const { isAuth } = require("../config/auth");
const prefix = "/tasks2"
router.post(`${prefix}/createTask`, saveChangedTasks, createTask);
router.get(`${prefix}/getTasks/:userId/:companyId`, getAllTasks);
router.get(`${prefix}/getAuditHistory/:recordId`, getAuditTrail);
router.delete(`${prefix}/deleteTask/:id`, saveChangedTasks, deleteTask);
router.post(`${prefix}/create-sheet/:userId/:companyId`, createSheet);
router.post(`${prefix}/webhook`, updateSheet);
router.put(`${prefix}/updateTask/:id`, saveChangedTasks, updateTask);
router.put(`${prefix}/approveTask`, approveTask);
router.get(`${prefix}/getTasksById/:id`, getTasksByID);
router.get(`${prefix}/getTasksByRole/:id/:userId/:companyId/:ownerId`, getTasksByRole);
router.post(`${prefix}/deleteTasks`, deleteTasks);
router.post(`${prefix}/updateMultipleTasks`, UpdateMultipleTasks);
router.post(`${prefix}/copyTask/:id`, copyTask);
module.exports = router;