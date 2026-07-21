const KeyResults = require("../models/keyResults.model");
const Objectives = require("../models/objectives.model");
const TasksModel = require("../models/tasks2.model");
const RewardsModel = require("../models/rewardManagement.model");
const RewardPointsModel = require("../models/rewardpoints.model");
const EmployeesModel = require("../models/employee.model");
const { totalRewardPoints, isValidDate } = require("../helpers/percentageCalculation");

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

const getRewardPoints = async (req, res) => {
  // #swagger.tags = ['Reward Points']
  try {
    const myUsers = await EmployeesModel.find({ "employmentInformation.lineManager": req.params.managerId, "employmentInformation.status": "Active" }).sort({ _id: -1 });
    if (myUsers.length === 0) return res.status(200).json(successResponse({ message: "No users found", data: [] }));
    const myUserIds = myUsers.map(item => item._doc._id);
    const allRewardPoints = await RewardPointsModel.find({ employeeReferenceId: { $in: myUserIds } }).sort({ _id: -1 });
    const objectives = allRewardPoints.filter(item => item.type === "Objective");
    const objectiveIds = objectives.map(item => item._doc.referenceID);
    const keyResults = allRewardPoints.filter(item => item.type === "Key Result");
    const keyResultIds = keyResults.map(item => item._doc.referenceID);
    const objectivesData = await Objectives.find({ _id: { $in: objectiveIds } }).sort({ _id: -1 });
    const keyResultsData = await KeyResults.find({ _id: { $in: keyResultIds } }).sort({ _id: -1 });
    let finalResult = allRewardPoints.map(item => {
      let title = "";
      if (item.type === "Objective") {
        title = objectivesData.filter(itemm => itemm._id == item.referenceID).length > 0 ? objectivesData.filter(itemm => itemm._id == item.referenceID)[0].objective : "";
      } else if (item.type === "Key Result") {
        title = keyResultsData.filter(itemm => itemm._id == item.referenceID).length > 0 ? keyResultsData.filter(itemm => itemm._id == item.referenceID)[0].keyResultName : "";
      }
      return {
        _id: item._id,
        title,
        type: item.type,
        employeeName: myUsers.filter(itemm => itemm._id == item.employeeReferenceId).length > 0 ? myUsers.filter(itemm => itemm._id == item.employeeReferenceId)[0].personalInformation.firstName + " " + myUsers.filter(itemm => itemm._id == item.employeeReferenceId)[0].personalInformation.lastName : "",
        rewardPoints: item.rewardPoints,
        isApproved: item.isApproved,
        referenceID: item.referenceID,
      }
    });

    res.status(200).send(
      successResponse({
        message: "Reward Points Retrieved Successfully!",
        data: finalResult,
      })
    );
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Reward Points Not Fetched!",
      })
    );
  }
};

const updateRewardPoints = async (req, res) => {
  // #swagger.tags = ['Reward Points']
  try {
    const rewardpoint = await RewardPointsModel.findById(req.params.id);
    if (rewardpoint) {
      let approveStatus = req.body.isApproved === "approved" ? false : true;
      
      // If approving pending reward points, add them to existing approved total
      if (req.body.isApproved === "approved" && rewardpoint.isApproved === "pending") {
        // Find the existing approved reward points for the same reference
        const existingApprovedPoints = await RewardPointsModel.findOne({
          referenceID: rewardpoint.referenceID,
          employeeReferenceId: rewardpoint.employeeReferenceId,
          type: rewardpoint.type,
          isApproved: "approved"
        });
        
        if (existingApprovedPoints) {
          // Add pending points to existing approved points
          const newTotal = existingApprovedPoints.rewardPoints + rewardpoint.rewardPoints;
          console.log(`Approving pending points: Adding ${rewardpoint.rewardPoints} to existing ${existingApprovedPoints.rewardPoints} = ${newTotal}`);
          
          await RewardPointsModel.findByIdAndUpdate(existingApprovedPoints._id, {
            rewardPoints: newTotal
          });
          
          // Delete the pending record
          await RewardPointsModel.findByIdAndDelete(req.params.id);
        } else {
          // No existing approved points, just update this one to approved
          let data = {
            isApproved: req.body.isApproved,
          };
          await RewardPointsModel.findByIdAndUpdate(req.params.id, data);
        }
      } else if (req.body.isApproved === "rejected") {
        // If rejecting, just delete the pending record
        await RewardPointsModel.findByIdAndDelete(req.params.id);
      } else {
        // For other status changes, just update
        let data = {
          isApproved: req.body.isApproved,
        };
        await RewardPointsModel.findByIdAndUpdate(req.params.id, data);
      }
      
      // Handle objective/key result approval status updates
      if (req.body.type === "Objective") {
        let data = {
          approvalRequired: approveStatus
        }
        Objectives.findByIdAndUpdate(req.body.referenceID, data, async (err2, result) => {
          if (!err2) {
            KeyResults.updateMany({ objectiveId: req.body.referenceID }, { $set: data }, async (err3, result) => {
              if (!err3) {
                res.status(200).send(
                  successResponse({
                    message: "Reward Points Updated Successfully!",
                  })
                );
              } else {
                res.status(500).send(
                  failResponse({
                    message: "Reward Points Not Updated!",
                  })
                );
              }
            });
          } else {
            res.status(500).send(
              failResponse({
                message: "Reward Points Not Updated!",
              })
            );
          }
        });
      } else if (req.body.type === "Key Result") {
        let data = {
          approvalRequired: approveStatus
        }
        KeyResults.findByIdAndUpdate(req.body.referenceID, data, async (err2, result) => {
          if (!err2) {
            res.status(200).send(
              successResponse({
                message: "Reward Points Updated Successfully!",
              })
            );
          } else {
            res.status(500).send(
              failResponse({
                message: "Reward Points Not Updated!",
              })
            );
          }
        });
      } else if (req.body.type === "Task") {
        // For tasks, just send success response
        res.status(200).send(
          successResponse({
            message: "Task Reward Points Updated Successfully!",
          })
        );
      } else {
        res.status(200).send(
          successResponse({
            message: "Reward Points Updated Successfully!",
          })
        );
      }
    } else {
      res.status(500).send(
        failResponse({
          message: "Reward Points Not Found!",
        })
      );
    }
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Reward Points Not Updated!",
      })
    );
  }
};


const deleteRewardPoints = async (req, res) => {
  // #swagger.tags = ['Reward Points']
  RewardPointsModel.findByIdAndRemove({ _id: req.params.id }, (err) => {
    if (!err) {
      res.status(200).send(
        successResponse({
          message: "Reward Points Deleted Successfully!",
        })
      );
    } else {
      res.status(500).send(
        failResponse({
          message: err ? err.message : "Reward Points Not Deleted!",
        })
      );
    }
  });
};

module.exports = {
  getRewardPoints,
  updateRewardPoints,
  deleteRewardPoints
};
