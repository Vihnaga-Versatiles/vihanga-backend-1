const express = require("express");
const { createkeyResult, getKeyResults, getKeyResultSingle, getKeyResultsAll, deletekeyResult, updatekeyResult, createOrUpdateMultipleKeyResults, predictData } = require("../controllers/keyResults.controller");
const router = express.Router();
const { saveChangedKeyResults } = require("../middlewares/AuditTrailData");

//const { isAuth } = require("../config/auth");
const prefix = "/keyresults"
router.post(`${prefix}/createkeyResult`, saveChangedKeyResults, createkeyResult);
router.post(`${prefix}/predictData`, predictData);
router.get(`${prefix}/getKeyResultSingle/:id/:role`, getKeyResultSingle);
router.get(`${prefix}/getKeyResults/:companyId`, getKeyResultsAll);
router.get(`${prefix}/getKeyResults/:id/:companyId`, getKeyResults);
router.delete(`${prefix}/deletekeyResult/:id`, saveChangedKeyResults, deletekeyResult);

router.put(`${prefix}/updatekeyResults`, createOrUpdateMultipleKeyResults);
router.put(`${prefix}/updatekeyResult/:id`, saveChangedKeyResults, updatekeyResult);

// router.post(`${prefix}/createOrUpdateMultipleObjectivess`, createOrUpdateMultipleemploys);

// router.post(`${prefix}/deleteObjectivess`, deleteObjectivess);
// router.get(`${prefix}/getObjectivesById/:id`, getEmployeById);

module.exports = router;