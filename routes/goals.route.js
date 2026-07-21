const express = require("express");
const { createGoal, cascadeGoal, getGoals, deleteGoal, deleteGoals, updateGoal } = require("../controllers/goals.controller");
const router = express.Router();
const { saveChangedGoals } = require("../middlewares/AuditTrailData");

const prefix = "/goals"
router.post(`${prefix}/createGoal`, saveChangedGoals, createGoal);
router.post(`${prefix}/cascadeGoal`, cascadeGoal);
router.get(`${prefix}/getGoals/:role/:userId/:companyId`, getGoals);
router.delete(`${prefix}/deleteGoals`, deleteGoals);
router.delete(`${prefix}/deleteGoal/:id`, saveChangedGoals, deleteGoal);

router.put(`${prefix}/updateGoal/:id`, saveChangedGoals, updateGoal);
module.exports = router;