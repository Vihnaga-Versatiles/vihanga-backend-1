const ReviewFormModel = require("../models/sessionScreen.model");

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

const createSessionScreen = async (req, res) => {
  // #swagger.tags = ['Sessions']
  try {
    let requestBody = req.body;
    const newSessionScreen = new ReviewFormModel(requestBody);
    await newSessionScreen.save();
    res.status(200).send(
      successResponse({
        message: "Session Screen Saved Successfully!",
      })
    );
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Session Screen Not Saved!",
      })
    );
  }
};
const getAllSessionScreens = async (req, res) => {
  // #swagger.tags = ['Sessions']
  try {
    const { userId } = req.params;
    const Reviews = await ReviewFormModel.find({ sessionOwners: { $in: userId } }).sort({ _id: -1 });
    res.status(200).send(
      successResponse({
        message: "Session Screen Retrieved Successfully!",
        data: Reviews,
      })
    );
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Session Screen Not Fetched!",
      })
    );
  }
};
const getAllSessionScreensById = async (req, res) => {
  // #swagger.tags = ['Sessions']
  try {
    const Reviews = await ReviewFormModel.findOne({ _id: req.params.sessionId }).sort({ _id: -1 });
    res.status(200).send(
      successResponse({
        message: "Session Screen Retrieved Successfully!",
        data: Reviews,
      })
    );
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Session Screen Not Fetched!",
      })
    );
  }
};
const deleteSessionScreen = (req, res) => {
  // #swagger.tags = ['Sessions']
  ReviewFormModel.findByIdAndRemove({ _id: req.params.id }, (err) => {
    if (!err) {
      res.status(200).send(
        successResponse({
          message: "Session Screen Deleted Successfully!",
        })
      );
    } else {
      res.status(500).send(
        failResponse({
          message: err ? err.message : "Session Screen Not Deleted!",
        })
      );
    }
  });
};

const updateSessionScreen = async (req, res) => {
  // #swagger.tags = ['Sessions']
  try {
    const reviews = await ReviewFormModel.findById(req.params.id);
    if (reviews) {
      ReviewFormModel.findByIdAndUpdate(req.params.id, req.body, (err) => {
        if (!err) {
          res.status(200).send(
            successResponse({
              message: "Session Screen Updated Successfully!",
            })
          );
        }
      });
    }
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Session Screen Not Updated!",
      })
    );
  }
};

module.exports = {
  deleteSessionScreen,
  updateSessionScreen,
  getAllSessionScreensById,
  createSessionScreen,
  getAllSessionScreens,
};
