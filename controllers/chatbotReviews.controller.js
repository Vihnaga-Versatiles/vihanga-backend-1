const ChatbotReviewsModel = require("../models/chatbotReviews.model");
const ReviewFormModel = require("../models/reviewForm.model");

const successResponse = ({ message, data }) => ({
  success: true,
  data: data ? data : null,
  message,
});
const failResponse = ({ message, data }) => ({
  success: false,
  data: data ? data : null,
  message,
});

const createReview = async (req, res) => {
  // #swagger.tags = ['Chatbot Reviews V2']
  try {
    let requestBody = {
      userId: req.body.userId,
      userRole: req.body.userRole,
      reviewedId: req.body.reviewedId,
      reviewedRole: req.body.reviewedRole
    };
    const newChatbotReview = new ChatbotReviewsModel(requestBody);
    await newChatbotReview.save();
    res.status(200).send(
      successResponse({
        message: "Review Added Successfully!",
      })
    );
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Review Not Added!",
      })
    );
  }
};

const getAllReviews = async (req, res) => {
  // #swagger.tags = ['Chatbot Reviews V2']
  try {
    const Reviews = await ChatbotReviewsModel.find({}).sort({ _id: -1 });
    res.status(200).send(
      successResponse({
        message: "Reviews Retrieved Successfully!",
        data: Reviews,
      })
    );
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "reviews Not Fetched!",
      })
    );
  }
};
const getAllReviewsByUserId = async (req, res) => {
  // #swagger.tags = ['Chatbot Reviews V2']
  try {
    const Reviews = await ChatbotReviewsModel.find({ userId: req.params.id }).sort({ _id: -1 });
    res.status(200).send(
      successResponse({
        message: "Reviews Retrieved Successfully!",
        data: Reviews,
      })
    );
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Reviews Not Fetched!",
      })
    );
  }
};
const deleteReview = (req, res) => {
  // #swagger.tags = ['Chatbot Reviews V2']
  ChatbotReviewsModel.findByIdAndRemove({ _id: req.params.id }, (err) => {
    if (!err) {
      res.status(200).send(
        successResponse({
          message: "Review Deleted Successfully!",
        })
      );
    } else {
      res.status(500).send(
        failResponse({
          message: err ? err.message : "Review Not Deleted!",
        })
      );
    }
  });
};

const updateReview = async (req, res) => {
  // #swagger.tags = ['Chatbot Reviews V2']
  try {
    const reviews = await ChatbotReviewsModel.findById(req.params.id);
    if (reviews) {
      ChatbotReviewsModel.findByIdAndUpdate(req.params.id, req.body, (err) => {
        if (!err) {
          res.status(200).send(
            successResponse({
              message: "Review Updated Successfully!",
            })
          );
        }
      });
    }
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Review Not Updated!",
      })
    );
  }
};

module.exports = {
  deleteReview,
  createReview,
  updateReview,
  getAllReviews,
  getAllReviewsByUserId
};
