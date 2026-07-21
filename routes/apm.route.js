const express = require("express");
const { createApm, getAllApms, getAllApmsById, updateApm, deleteApm } = require("../controllers/apm.controller");
const router = express.Router();

const prefix = "/ratingScales"
router.post(`${prefix}/createRatingScale`, createApm);
router.get(`${prefix}/getRatingScales/:companyId`, getAllApms);
router.get(`${prefix}/getRatingScales/:id`, getAllApmsById);
router.delete(`${prefix}/deleteRatingScale/:id`, deleteApm);
router.put(`${prefix}/updateRatingScale/:id`, updateApm);
module.exports = router;