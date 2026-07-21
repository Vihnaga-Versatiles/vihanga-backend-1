const express = require("express");
const { createObjective, cascadeObjective, cascadeObjectiveWithKeyResults, getObjectives, getObjectivesRewardPoints, getSimilarObjectives, getObjectivesTabs, getObjectivesAndOKRTab, getObjectivesDashboard } = require("../controllers/objectives.controller");
const { getEmpWithRewards, getObjectivesChartOCR, deleteObjective, deleteObjectives, updateObjective, updateObjectiveCascaded, approveAllObjectives } = require("../controllers/objectives2.controller");
const router = express.Router();
const { saveChangedObjectives } = require("../middlewares/AuditTrailData");
const { getCompanyObjectives } = require("../controllers/objective3.controller");

//const { isAuth } = require("../config/auth");
const prefix = "/objectives"
router.post(`${prefix}/createObjective`, saveChangedObjectives, createObjective);
router.post(`${prefix}/cascadeObjectiveWithKeyResults`, cascadeObjectiveWithKeyResults);
router.post(`${prefix}/cascadeObjective`, cascadeObjective);
router.get(`${prefix}/getObjectivesRewardPoints/:id/:role/:tab/:companyId`, getObjectivesRewardPoints);
router.get(`${prefix}/employeeWithRewards/:id/:role/:tab/:usertab/:companyId`, getEmpWithRewards);
router.get(`${prefix}/getObjectivesOCR/:id/:tab/:companyId`, getObjectivesChartOCR);
router.get(`${prefix}/getSimilarObjectives/:role/:userId/:companyId/:tabType/:objectiveId`, getSimilarObjectives);
router.get(`${prefix}/getObjectivesTabs/:role/:userId/:companyId/:tabType`, getObjectivesTabs);
router.get(`${prefix}/getObjectivesAndOKRTab/:role/:userId/:companyId`, getObjectivesAndOKRTab);
router.get(`${prefix}/getObjectivesDashboard/:role/:userId/:companyId`, getObjectivesDashboard);
router.get(`${prefix}/getObjectives/:role/:userId/:companyId/:objectiveId?`, getObjectives);
router.delete(`${prefix}/deleteObjectives`, deleteObjectives);
router.delete(`${prefix}/deleteObjective/:id`, saveChangedObjectives, deleteObjective);

router.put(`${prefix}/updateObjectiveCascaded/:id/:companyId`, updateObjectiveCascaded);
router.put(`${prefix}/updateObjective/:id`, saveChangedObjectives, updateObjective);



//newupdated apis

router.get(`${prefix}/getCompanyObjectives`, getCompanyObjectives);
router.post(`${prefix}/approve-all/:companyId/:managerId`, approveAllObjectives);


// router.post(`${prefix}/createOrUpdateMultipleObjectivess`, createOrUpdateMultipleemploys);

// router.post(`${prefix}/deleteObjectivess`, deleteObjectivess);
// router.get(`${prefix}/getObjectivesById/:id`, getEmployeById);

module.exports = router;