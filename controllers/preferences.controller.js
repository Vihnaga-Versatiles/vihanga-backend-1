const ReviewFormModel = require("../models/preferences.model");

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

const createpreference = async (req, res) => {
  // #swagger.tags = ['Preferences']
  try {
    let requestBody = req.body;
    const newpreference = new ReviewFormModel(requestBody);
    await newpreference.save();
    res.status(200).send(
      successResponse({
        message: "preference Saved Successfully!",
      })
    );
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "preference Not Saved!",
      })
    );
  }
};
const getAllpreferences = async (req, res) => {
  // #swagger.tags = ['Preferences']
  try {
    const Reviews = await ReviewFormModel.find({}).sort({ _id: -1 });
    res.status(200).send(
      successResponse({
        message: "preference Retrieved Successfully!",
        data: Reviews,
      })
    );
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "preference Not Fetched!",
      })
    );
  }
};
const getAllpreferencesById = async (req, res) => {
  // #swagger.tags = ['Preferences']
  try {
    const Reviews = await ReviewFormModel.findOne({ _id: req.params.id }).sort({ _id: -1 });
    res.status(200).send(
      successResponse({
        message: "preference Retrieved Successfully!",
        data: Reviews,
      })
    );
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "preference Not Fetched!",
      })
    );
  }
};
const deletepreference = (req, res) => {
  // #swagger.tags = ['Preferences']
  ReviewFormModel.findByIdAndRemove({ _id: req.params.id }, (err) => {
    if (!err) {
      res.status(200).send(
        successResponse({
          message: "preference Deleted Successfully!",
        })
      );
    } else {
      res.status(500).send(
        failResponse({
          message: err ? err.message : "preference Not Deleted!",
        })
      );
    }
  });
};

const updatepreference = async (req, res) => {
  // #swagger.tags = ['Preferences']
  try {
    const reviews = await ReviewFormModel.findById(req.params.id);
    if (reviews) {
      ReviewFormModel.findByIdAndUpdate(req.params.id, req.body, (err) => {
        if (!err) {
          res.status(200).send(
            successResponse({
              message: "preference Updated Successfully!",
            })
          );
        }
      });
    }
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "preference Not Updated!",
      })
    );
  }
};

module.exports = {
  deletepreference,
  updatepreference,
  getAllpreferencesById,
  createpreference,
  getAllpreferences,
};
