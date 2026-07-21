const express = require("express");
const { getRewardPoints, updateRewardPoints, deleteRewardPoints } = require("../controllers/rewardpoints.controller");
const router = express.Router();

const prefix = "/rewardpoints"
router.get(`${prefix}/getRewardPoints/:managerId`, getRewardPoints);
router.put(`${prefix}/updateRewardPoints/:id`, updateRewardPoints);
router.delete(`${prefix}/deleteRewardPoints/:id`, deleteRewardPoints);

module.exports = router;