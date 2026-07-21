const express = require("express");
const { createChatbot, getChatbotData } = require("../controllers/chatbot.controller");
const router = express.Router();

//Open Ended Questions Chatbot
//const { isAuth } = require("../config/auth");
const prefix = "/chatbot"
router.post(`${prefix}/sendMessage/:userId/:numberOfQuestions/:answer`, createChatbot);
router.get(`${prefix}/getChats`, getChatbotData);
// router.get(`${prefix}/getCompanies`, getCompanies);
// router.get(`${prefix}/getCompanyById/:id`, getCompanyById);

module.exports = router;