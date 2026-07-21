const ReviewFormModel = require("../models/apm.model");

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

const createApm = async (req, res) => {
  // #swagger.tags = ['Rating Scale']
  try {
    let requestBody = req.body;
    const newApm = new ReviewFormModel({ ratingScale: requestBody, companyId: requestBody.companyId });
    await newApm.save();
    res.status(200).send(
      successResponse({
        message: "Rating Scale Saved Successfully!",
      })
    );
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Rating Scale Not Saved!",
      })
    );
  }
};
const getAllApms = async (req, res) => {
  // #swagger.tags = ['Rating Scale']
  try {
    const Reviews = await ReviewFormModel.find({ companyId: req.params.companyId }).sort({ _id: -1 });
    res.status(200).send(
      successResponse({
        message: "Rating Scale Retrieved Successfully!",
        data: Reviews,
      })
    );
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Rating Scale Not Fetched!",
      })
    );
  }
};
const getAllApmsById = async (req, res) => {
  // #swagger.tags = ['Rating Scale']
  try {
    const Reviews = await ReviewFormModel.findOne({ _id: req.params.id }).sort({ _id: -1 });
    res.status(200).send(
      successResponse({
        message: "Rating Scale Retrieved Successfully!",
        data: Reviews,
      })
    );
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Rating Scale Not Fetched!",
      })
    );
  }
};
const deleteApm = (req, res) => {
  // #swagger.tags = ['Rating Scale']
  ReviewFormModel.findByIdAndRemove({ _id: req.params.id }, (err) => {
    if (!err) {
      res.status(200).send(
        successResponse({
          message: "Rating Scale Deleted Successfully!",
        })
      );
    } else {
      res.status(500).send(
        failResponse({
          message: err ? err.message : "Rating Scale Not Deleted!",
        })
      );
    }
  });
};

const updateApm = async (req, res) => {
  // #swagger.tags = ['Rating Scale']
  try {
    const reviews = await ReviewFormModel.findById(req.params.id);
    if (reviews) {
      ReviewFormModel.findByIdAndUpdate(req.params.id, { ratingScale: req.body }, (err) => {
        if (!err) {
          res.status(200).send(
            successResponse({
              message: "Rating Scale Updated Successfully!",
            })
          );
        }
      });
    }
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Rating Scale Not Updated!",
      })
    );
  }
};

module.exports = {
  deleteApm,
  updateApm,
  getAllApmsById,
  createApm,
  getAllApms,
};
