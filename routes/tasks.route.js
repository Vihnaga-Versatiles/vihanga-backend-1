const express = require("express");
const { createTask, getAllTasks, deleteTask, updateTask, getTasksByRole,getTasksByID, deleteTasks, UpdateMultipleTasks, copyTask } = require("../controllers/tasks.controller");
const router = express.Router();

//const { isAuth } = require("../config/auth");
const prefix = "/tasks"
router.post(`${prefix}/createTask`, createTask);
router.get(`${prefix}/getTasks`, getAllTasks);
router.delete(`${prefix}/deleteTask/:id`, deleteTask);

router.put(`${prefix}/updateTask/:id`, updateTask);
router.get(`${prefix}/getTasksById/:id`, getTasksByID);
router.get(`${prefix}/getTasksByRole/:id`, getTasksByRole);
router.post(`${prefix}/deleteTasks`, deleteTasks);
router.post(`${prefix}/updateMultipleTasks`, UpdateMultipleTasks);
router.post(`${prefix}/copyTask/:id`, copyTask);
module.exports = router;