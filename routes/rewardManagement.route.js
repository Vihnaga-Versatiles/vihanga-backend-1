const express = require("express");
const { createOkrLibrary, getAllOkrLibrary, deleteOkrLibrary, okrLibaryUpdate, deleteOkrLibraries } = require("../controllers/rewardManagement.controller");
const router = express.Router();

const prefix = "/rewardManagement"
router.post(`${prefix}/createReward`, createOkrLibrary);
router.get(`${prefix}/getAllRewards/:companyId`, getAllOkrLibrary);
router.post(`${prefix}/deleteRewards`, deleteOkrLibraries);
router.delete(`${prefix}/deleteReward/:id`, deleteOkrLibrary);

router.put(`${prefix}/updateReward/:id`, okrLibaryUpdate);
module.exports = router;