const express = require("express");
const { createReviewForm, createMultipleReviewForm, getAllReviewsByUserId, getAllReviewsByTemplateId, getAllReviewsById, deleteReview, updateReview, getAllReviewsForm, UpdateMultipleReviews,getChartData } = require("../controllers/reviewForm.controller");
const router = express.Router();

const prefix = "/reviewForm"
router.post(`${prefix}/createMultipleReviewForm`, createMultipleReviewForm);
router.post(`${prefix}/createReviewForm`, createReviewForm);
router.get(`${prefix}/getAllReviewsForm/:companyId/:userId/:role`, getAllReviewsForm);
router.get(`${prefix}/getAllReviewsByTemplateId/:id`, getAllReviewsByTemplateId);
router.get(`${prefix}/getReviewFormByUserId/:id`, getAllReviewsByUserId);
router.get(`${prefix}/getReviewFormById/:id`, getAllReviewsById);
router.delete(`${prefix}/deleteReviewForm/:id`, deleteReview);
router.put(`${prefix}/updateReviewForm/:id`, updateReview);
router.get(`${prefix}/chartData/:role/:id`, getChartData);
router.put(`${prefix}/updateReviewFormMultiple`, UpdateMultipleReviews);
module.exports = router;