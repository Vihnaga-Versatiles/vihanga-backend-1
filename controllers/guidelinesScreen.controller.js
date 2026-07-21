const ReviewFormModel = require("../models/guidelinesScreen.model");

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

const createGuidelinesScreen = async (req, res) => {
  // #swagger.tags = ['Review Guidelines']
  try {
    let requestBody = req.body;
    const newGuidelinesScreen = new ReviewFormModel(requestBody);
    await newGuidelinesScreen.save();
    res.status(200).send(
      successResponse({
        message: "Guidelines Screen Saved Successfully!",
      })
    );
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Guidelines Screen Not Saved!",
      })
    );
  }
};
const getAllGuidelinesScreens = async (req, res) => {
  // #swagger.tags = ['Review Guidelines']
  try {
    const Reviews = await ReviewFormModel.find({}).sort({ _id: -1 });
    res.status(200).send(
      successResponse({
        message: "Guidelines Screen Retrieved Successfully!",
        data: Reviews,
      })
    );
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Guidelines Screen Not Fetched!",
      })
    );
  }
};
const getAllGuidelinesScreensById = async (req, res) => {
  // #swagger.tags = ['Review Guidelines']
  try {
    const Reviews = await ReviewFormModel.findOne({ _id: req.params.guidelineId }).sort({ _id: -1 });
    res.status(200).send(
      successResponse({
        message: "Guidelines Screen Retrieved Successfully!",
        data: Reviews,
      })
    );
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Guidelines Screen Not Fetched!",
      })
    );
  }
};
const deleteGuidelinesScreen = (req, res) => {
  // #swagger.tags = ['Review Guidelines']
  ReviewFormModel.findByIdAndRemove({ _id: req.params.id }, (err) => {
    if (!err) {
      res.status(200).send(
        successResponse({
          message: "Guidelines Screen Deleted Successfully!",
        })
      );
    } else {
      res.status(500).send(
        failResponse({
          message: err ? err.message : "Guidelines Screen Not Deleted!",
        })
      );
    }
  });
};

const updateGuidelinesScreen = async (req, res) => {
  // #swagger.tags = ['Review Guidelines']
  try {
    const reviews = await ReviewFormModel.findById(req.params.id);
    if (reviews) {
      ReviewFormModel.findByIdAndUpdate(req.params.id, req.body, (err) => {
        if (!err) {
          res.status(200).send(
            successResponse({
              message: "Guidelines Screen Updated Successfully!",
            })
          );
        }
      });
    }
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Guidelines Screen Not Updated!",
      })
    );
  }
};

module.exports = {
  deleteGuidelinesScreen,
  updateGuidelinesScreen,
  getAllGuidelinesScreensById,
  createGuidelinesScreen,
  getAllGuidelinesScreens,
};
