const express = require("express");
const { createReview, getAllReviews, getAllReviewsByUserId, deleteReview, updateReview } = require("../controllers/chatbotReviews.controller");
const router = express.Router();

//const { isAuth } = require("../config/auth");
const prefix = "/chatbotReviews"
router.post(`${prefix}/createReview`, createReview);
router.get(`${prefix}/getAllCommentsByUserId/:id`, getAllReviewsByUserId);
router.get(`${prefix}/getAllReviews`, getAllReviews);
router.delete(`${prefix}/deleteReview/:id`, deleteReview);
router.put(`${prefix}/updateReview/:id`, updateReview);

module.exports = router;