const express = require("express");
const { createOkrLibrary, getAllOkrLibrary, deleteOkrLibrary, okrLibaryUpdate, deleteOkrLibraries, createRedeemPoints, getAllRedeemPoints, deleteRedeempOptions, redeemUpdate } = require("../controllers/rewards.controller");
const router = express.Router();

const prefix = "/rewards"
router.post(`${prefix}/createReward`, createOkrLibrary);
router.put(`${prefix}/redeemUpdate/:id`, redeemUpdate);
router.post(`${prefix}/createRedeemPoints`, createRedeemPoints);
router.get(`${prefix}/getAllRedeemPoints/:id`, getAllRedeemPoints);
router.get(`${prefix}/getAllRewards/:companyId`, getAllOkrLibrary);
router.post(`${prefix}/deleteRewards`, deleteOkrLibraries);
router.delete(`${prefix}/deleteRedeempOptions`, deleteRedeempOptions);
router.delete(`${prefix}/deleteReward/:id`, deleteOkrLibrary);
router.put(`${prefix}/updateReward/:id`, okrLibaryUpdate);
module.exports = router;