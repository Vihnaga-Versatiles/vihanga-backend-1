const express = require("express");
const { createChatbot, getChatbotData } = require("../controllers/chatbot.controller_v2");
const router = express.Router();

//Close Ended Questions Chatbot
//const { isAuth } = require("../config/auth");
const prefix = "/chatbot_v2"
router.post(`${prefix}/sendMessage/:userId/:role/:answer/:toEmployeeId/:reviewRole/:templateId`, createChatbot);
router.get(`${prefix}/getChats`, getChatbotData);
// router.get(`${prefix}/getCompanies`, getCompanies);
// router.get(`${prefix}/getCompanyById/:id`, getCompanyById);

module.exports = router;