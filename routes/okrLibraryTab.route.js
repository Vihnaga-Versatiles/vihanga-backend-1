const express = require("express");
const { createOkrLibrary, createObjectives, getAllOkrLibrary, deleteOkrLibrary, okrLibaryUpdate, deleteOkrLibraries, createGoals } = require("../controllers/okrLibrayTab.controller");
const router = express.Router();

const prefix = "/okrManagement"
router.post(`${prefix}/createObjectives`, createObjectives);
router.post(`${prefix}/createGoals`, createGoals);
router.post(`${prefix}/createOkrLibrary`, createOkrLibrary);
router.get(`${prefix}/getAllOkrLibrary/:id`, getAllOkrLibrary);
router.get(`${prefix}/getAllOkrLibrary`, getAllOkrLibrary);
router.post(`${prefix}/deleteOkrLibraries`, deleteOkrLibraries);
router.delete(`${prefix}/deleteOkrLibrary/:id`, deleteOkrLibrary);
router.put(`${prefix}/updateOkrLibary/:id`, okrLibaryUpdate);
module.exports = router;