const OkrLibraryModel = require("../models/rewardManagement.model");

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

const createOkrLibrary = async (req, res) => {
  // #swagger.tags = ['Rewards Management']
  try {
    let requestBody = {
      rewardSchemeName: req.body.rewardSchemeName,
      rewardCategory: req.body.rewardCategory,
      rewardType: req.body.rewardType,
      rewardPoints: req.body.rewardPoints,
      rewardPoints2: req.body.rewardPoints2,
      rewardPoints3: req.body.rewardPoints3,
      kudosEnabled: req.body.kudosEnabled,
      birthdayWishesEnabled: req.body.birthdayWishesEnabled,
      approvalRequired: req.body.approvalRequired,
      anniversaryWishesEnabled: req.body.anniversaryWishesEnabled,
      objectivesAchievementPercent: req.body.objectivesAchievementPercent,
      objectivesAchievementPoints: req.body.objectivesAchievementPoints,
      okrTemplate: req.body.okrTemplate,
      krAchievementPercent: req.body.krAchievementPercent,
      krAchievementPoints: req.body.krAchievementPoints,
      taskAchievementPercent: req.body.taskAchievementPercent,
      taskAchievementPoints: req.body.taskAchievementPoints,
      subTaskAchievementPercent: req.body.subTaskAchievementPercent,
      subTaskAchievementPoints: req.body.subTaskAchievementPoints,
      eligibilityGroup: req.body.eligibilityGroup,
      companyId: req.body.companyId
    };
    const newOkrLibraryModel = new OkrLibraryModel(requestBody);
    await newOkrLibraryModel.save().then((result, err) => {
      if (!err) {
        res.status(200).send(
          successResponse({
            message: "Reward Created Successfully!",
            data: result,
          })
        );
      } else {
        res.status(500).send(
          failResponse({
            message: "Reward Not Created!",
          })
        );
      }
    });
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Reward Not Created!",
      })
    );
  }
};

const getAllOkrLibrary = async (req, res) => {
  // #swagger.tags = ['Rewards Management']
  try {
    const searchQuery = req.query.search || ""; 
    const filter = {
      companyId: req.params.companyId,
      rewardSchemeName: { $regex: searchQuery, $options: "i" }
    };
    const Tasks = await OkrLibraryModel.find(filter).sort({ _id: -1 });
    res.status(200).send(
      successResponse({
        message: "Rewards Retrieved Successfully!",
        data: Tasks,
      })
    );
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Rewards Not Fetched!",
      })
    );
  }
};

const deleteOkrLibrary = (req, res) => {
  // #swagger.tags = ['Rewards Management']
  OkrLibraryModel.findByIdAndRemove({ _id: req.params.id }, (err) => {
    if (!err) {
      res.status(200).send(
        successResponse({
          message: "Reward Deleted Successfully!",
        })
      );
    } else {
      res.status(500).send(
        failResponse({
          message: err ? err.message : "Reward Not Deleted!",
        })
      );
    }
  });
};

const deleteOkrLibraries = (req, res) => {
  // #swagger.tags = ['Rewards Management']
  OkrLibraryModel.deleteMany({ _id: { $in: req.body.data } }, (err) => {
    if (!err) {
      res.status(200).send(
        successResponse({
          message: "Rewards Deleted Successfully!",
        })
      );
    } else {
      res.status(500).send(
        failResponse({
          message: err ? err.message : "Rewards Not Deleted!",
        })
      );
    }
  });
};

const okrLibaryUpdate = async (req, res) => {
  // #swagger.tags = ['Rewards Management']
  try {
    const tasks = await OkrLibraryModel.findById(req.params.id);
    if (tasks) {
      OkrLibraryModel.findByIdAndUpdate(req.params.id, req.body, (err) => {
        if (!err) {
          res.status(200).send(
            successResponse({
              message: "Reward Updated Successfully!",
            })
          );
        }
      });
    }
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Reward Not Updated!",
      })
    );
  }
};

module.exports = {
  deleteOkrLibraries,
  deleteOkrLibrary,
  createOkrLibrary,
  okrLibaryUpdate,
  getAllOkrLibrary,
};
