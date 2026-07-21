//chatbotv2
const express = require("express");
const { createOrUpdateOrDeleteMultipleQuestions, getChatbotQuestions, deleteQuestion } = require("../controllers/chatbotQuestions_v2.controller");
const router = express.Router();

const prefix = "/chatbot-close-ended-questions"
router.post(`${prefix}/addUpdateDeleteQuestions`, createOrUpdateOrDeleteMultipleQuestions);
router.get(`${prefix}/getQuestions`, getChatbotQuestions);
router.delete(`${prefix}/deleteQuestion/:id`, deleteQuestion);

module.exports = router;