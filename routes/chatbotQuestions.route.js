const express = require("express");
const { createOrUpdateOrDeleteMultipleQuestions, getChatbotQuestions, deleteQuestion, getCompetencies } = require("../controllers/chatbotQuestions.controller");
const router = express.Router();

const prefix = "/chatbot-open-ended-questions"
router.post(`${prefix}/addUpdateDeleteQuestions`, createOrUpdateOrDeleteMultipleQuestions);
router.get(`${prefix}/getQuestions`, getChatbotQuestions);
router.get(`${prefix}/getCompetencies`, getCompetencies);
router.delete(`${prefix}/deleteQuestion/:id`, deleteQuestion);

module.exports = router;