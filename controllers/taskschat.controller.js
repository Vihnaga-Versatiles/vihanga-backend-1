const CommentsModel = require("../models/tasksChat.model");

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

const createComment = async (req, res) => {
  // #swagger.tags = ['Task Comments']
  try {
    let requestBody = {
      employeeId: req.body.employeeId,
      employeeName: req.body.employeeName,
      comment: req.body.comment,
      referenceId: req.body.referenceId,
      attachment: req.body.attachment,
    };
    const newKeyResult = new CommentsModel(requestBody);
    await newKeyResult.save();
    res.status(200).send(
      successResponse({
        message: "Comment Added Successfully!",
      })
    );
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Comment Not Added!",
      })
    );
  }
};
const getAllComments = async (req, res) => {
  // #swagger.tags = ['Task Comments']
  try {
    const Comments = await CommentsModel.find({}).sort({ _id: -1 });
    res.status(200).send(
      successResponse({
        message: "Comments Retrieved Successfully!",
        data: Comments,
      })
    );
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Comments Not Fetched!",
      })
    );
  }
};
const getAllCommentsByReferenceId = async (req, res) => {
  // #swagger.tags = ['Task Comments']
  try {
    const Comments = await CommentsModel.find({ referenceId: req.params.id }).sort({ _id: -1 });
    res.status(200).send(
      successResponse({
        message: "Comments Retrieved Successfully!",
        data: Comments,
      })
    );
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Comments Not Fetched!",
      })
    );
  }
};
const deleteComment = (req, res) => {
  // #swagger.tags = ['Task Comments']
  CommentsModel.findByIdAndRemove({ _id: req.params.id }, (err) => {
    if (!err) {
      res.status(200).send(
        successResponse({
          message: "Comment Deleted Successfully!",
        })
      );
    } else {
      res.status(500).send(
        failResponse({
          message: err ? err.message : "Comment Not Deleted!",
        })
      );
    }
  });
};



const updateComment = async (req, res) => {
  // #swagger.tags = ['Task Comments']
  try {
    const comments = await CommentsModel.findById(req.params.id);
    if (comments) {

      CommentsModel.findByIdAndUpdate(req.params.id, req.body, (err) => {
        if (!err) {
          res.status(200).send(
            successResponse({
              message: "Comment Updated Successfully!",
            })
          );
        }
      });
    }
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Comment Not Updated!",
      })
    );
  }
};

module.exports = {
  deleteComment,
  createComment,
  updateComment,
  getAllCommentsByReferenceId,
  getAllComments,
};
