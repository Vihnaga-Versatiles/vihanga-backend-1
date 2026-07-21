const express = require("express");
const { getSearchBarData } = require("../controllers/navbarSearch.controller");
const router = express.Router();

const prefix = "/navbar"
router.get(`${prefix}/getData/:role/:userId/:keyword`, getSearchBarData);

module.exports = router;