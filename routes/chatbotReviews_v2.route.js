const express = require("express");
const { createReview, getAllReviews, getAllReviewsByUserId, getReportByUserId, deleteReview, updateReview } = require("../controllers/chatbotReviews_v2.controller");
const router = express.Router();

//const { isAuth } = require("../config/auth");
const prefix = "/chatbotReviews_v2"
router.post(`${prefix}/createReview`, createReview);
router.get(`${prefix}/getAllReviewsByUserId/:userId`, getAllReviewsByUserId);
router.get(`${prefix}/getReport/:userId/:templateId`, getReportByUserId);
router.get(`${prefix}/getAllReviews`, getAllReviews);
router.delete(`${prefix}/deleteReview/:id`, deleteReview);
router.put(`${prefix}/updateReview/:id`, updateReview);

module.exports = router;