const ObjectivesModel = require("../models/goals.model");
const EmployeesModel = require("../models/employee.model");
const RewardsModel = require("../models/rewardManagement.model");
const PrivilegesModel = require("../models/privileges.model");
const AuditTrailModel = require("../models/AuditTrail");
const getRandom = require('../middlewares/randomNumber');
const { totalSum, totalRewardPoints, isValidDate } = require("../helpers/percentageCalculation");

const successResponse = ({ message, data, ...rest }) => ({
  success: true,
  data: data ? data : null,
  message,
  ...rest
});
const failResponse = ({ message, data, ...rest }) => ({
  success: false,
  data: data ? data : null,
  message,
  ...rest
});

const createGoal = async (req, res) => {
  // #swagger.tags = ['Goals']
  try {
    if (req.body.weight <= 100) {
      const employee = await EmployeesModel.findOne({ _id: req.body.employeeReferenceId }).select("employmentInformation.employeeNumber");
      let requestBody = {
        employeeName: req.body.employeeName,
        okrPeriod: req.body.okrPeriod,
        okrYear: req.body.okrYear,
        goal: req.body.goal,
        dueDate: isValidDate(req.body.dueDate) ? req.body.dueDate : null,
        weight: req.body.weight,
        owner: req.body.owner,
        successMetrics: req.body.successMetrics,
        progressStatus: req.body.progressStatus,
        feedAttachment: req.body.feedAttachment,
        comments: req.body.comments,
        dimension: req.body.dimension,
        objective: req.body.objective,
        employeeReferenceId: req.body.employeeReferenceId,
        employeeNumber: employee.employmentInformation.employeeNumber,
        objectiveID: "OBJ_" + getRandom(7),
        isAlignedToCompany: req.body.isAlignedToCompany,
        frequency: req.body.frequency,
        uom: req.body.uom,
        polarity: req.body.polarity ? req.body.polarity : "Positive",
        msc: req.body.msc ? req.body.msc : "",
        targetDate: isValidDate(req.body.targetDate) ? req.body.targetDate : null,
        actualDate: isValidDate(req.body.actualDate) ? req.body.actualDate : null,
        target: req.body.target,
        actual: req.body.actual,
        basevalue: req.body.basevalue
      };
      const rewards = await RewardsModel.find({}).sort({ _id: -1 });
      let objectivesAchievementPercent = rewards.length > 0 ? rewards[0].objectivesAchievementPercent : 0;
      let objectivesAchievementPoints = rewards.length > 0 ? rewards[0].objectivesAchievementPoints : 0;
      let rewardPoints = totalRewardPoints(requestBody.progressStatus, objectivesAchievementPercent, objectivesAchievementPoints, requestBody);
      const newObjective = new ObjectivesModel(requestBody);
      await newObjective.save().then(async (result, error) => {
        if (!error) {
          let auditId = req.auditId.toString();
          await AuditTrailModel.findByIdAndUpdate(auditId, { recordId: result._doc._id }, (err, doc) => {
            if (!err) {
              res.status(200).send(
                successResponse({
                  message: "Goal Created Successfully!",
                  data: {
                    ...result._doc,
                    rewardPoints
                  }
                })
              );
            } else {
              res.status(500).send(
                failResponse({
                  message: "Goal Not Created" + err,
                })
              );
            }
          });
        } else {
          res.status(500).send(
            failResponse({
              message: "Goal Not Created" + error,
            })
          );
        }
      })
    } else {
      res.status(500).send(
        failResponse({
          message: "Weight Should be Less Than Or Equal To 100",
        })
      );
    }
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Goal Not Created!",
      })
    );
  }
};

const cascadeGoal = async (req, res) => {
  // #swagger.tags = ['Goals']
  try {
    let requestBody = req.body;
    let employeeIds = requestBody.map(item => item.employeeReferenceId);
    const employees = await EmployeesModel.find({ _id: { $in: employeeIds } }).select("employmentInformation.employeeNumber").sort({ _id: -1 });
    requestBody = requestBody.map((item) => {
      let obj = { ...item };
      obj.cascaded = true;
      obj.objectiveID = "GOAL_" + getRandom(7);
      obj.employeeNumber = employees.find(employee => employee._id == obj.employeeReferenceId).employmentInformation.employeeNumber;
      //obj.cascadedType = "type1";
      return obj;
    });
    ObjectivesModel.insertMany(requestBody, (err, result) => {
      if (!err) {
        res.status(200).send(
          successResponse({
            message: "Goal Cascaded Successfully!",
            data: result,
          })
        );
      } else {
        res.status(500).send(
          failResponse({
            message: err ? err.message : "Goal Not Cascaded!",
          })
        );
      }
    });
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Goal Not Created!",
      })
    );
  }
};

const getGoals = async (req, res) => {
  // #swagger.tags = ['Goals']
  try {
    let objj = req.params.role == "Super Admin" || req.params.role == "Manager" || req.params.role == "HR Admin" ? {} : { employeeReferenceId: req.params.userId };
    objj.createdAt = {
      "$gte": new Date("2022-01-01"),
      "$lt": new Date()
    }
    const objectives = await ObjectivesModel.find(objj).sort({ _id: -1 });
    let employeeIds = objectives.map(item => item._doc.employeeReferenceId);
    const employees = await EmployeesModel.find({ _id: { $in: employeeIds }, companyId: req.params.companyId, "employmentInformation.status": "Active" }).select("employmentInformation.employeeNumber personalInformation").sort({ _id: -1 });
    const rewards = await RewardsModel.find({ companyId: req.params.companyId }).sort({ _id: -1 });
    const privileges = await PrivilegesModel.find({ role: req.params.role, companyId: req.params.companyId }).sort({ _id: -1 });
    let result = objectives.map((objective) => {
      let newObj = { ...objective._doc };
      newObj.employeeNumber = employees.find(employee => employee._id == newObj.employeeReferenceId) ?
        employees.find(employee => employee._id == newObj.employeeReferenceId).employmentInformation.employeeNumber : "";
      newObj.profilePicture = employees.find(employee => employee.personalInformation.firstName == newObj.owner.split(" ")[0]) ?
        employees.find(employee => employee.personalInformation.firstName == newObj.owner.split(" ")[0]).personalInformation.profilePicture : "https://www.clipartmax.com/png/middle/103-1038880_user-rubber-stamp-female-user-icon.png";
      newObj.progressStatus = newObj.progressStatus > 0 ? newObj.progressStatus : "0";
      let objectivesAchievementPercent = rewards.length > 0 ? rewards[0].objectivesAchievementPercent : 0;
      let objectivesAchievementPoints = rewards.length > 0 ? rewards[0].objectivesAchievementPoints : 0;
      let rewardPoints = totalRewardPoints(newObj.progressStatus, objectivesAchievementPercent, objectivesAchievementPoints, newObj);
      newObj.rewardPoints = rewardPoints;
      return newObj;
    });
    res.status(200).send(
      successResponse({
        message: "Goals Retrieved Successfully!",
        data: result,
        privileges
      })
    );
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Goals Not Fetched!",
      })
    );
  }
};

const updateGoal = async (req, res) => {
  // #swagger.tags = ['Goals']
  try {
    if (req.body.weight <= 100) {
      const objective = await ObjectivesModel.findById(req.params.id);
      const rewards = await RewardsModel.find({}).sort({ _id: -1 });
      let objectivesAchievementPercent = rewards.length > 0 ? rewards[0].objectivesAchievementPercent : 0;
      let objectivesAchievementPoints = rewards.length > 0 ? rewards[0].objectivesAchievementPoints : 0;
      if (objective) {
        req.body.dueDate = isValidDate(req.body.dueDate) ? req.body.dueDate : null;
        let rewardPoints = totalRewardPoints(req.body.progressStatus, objectivesAchievementPercent, objectivesAchievementPoints, req.body);
        ObjectivesModel.findByIdAndUpdate(req.params.id, { ...req.body, objectiveStatus: "Create" }, async (err, result) => {
          if (!err) {
            let auditId = req.auditId.toString();
            await AuditTrailModel.findByIdAndUpdate(auditId, { recordId: req.params.id }, (error, doc) => {
              if (!error) {
                res.status(200).send(
                  successResponse({
                    message: "Goal Updated Successfully!",
                    data: {
                      ...result._doc,
                      rewardPoints
                    }
                  })
                );
              } else {
                res.status(500).send(
                  failResponse({
                    message: error ? error.message : "Goal Not Updated!",
                  })
                );
              }
            });
          } else {
            res.status(500).send(
              failResponse({
                message: err ? err.message : "Goal Not Updated!",
              })
            );
          }
        });
      }
    } else {
      res.status(500).send(
        failResponse({
          message: "Weight Should Be Less Than Or Equal To 100",
        })
      );
    }
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Goal Not Updated!",
      })
    );
  }
};

const deleteGoal = async (req, res) => {
  // #swagger.tags = ['Goals']
  let auditId = req.auditId.toString();
  await AuditTrailModel.findByIdAndUpdate(auditId, { recordId: req.params.id }, (err, doc) => {
    if (!err) {
      ObjectivesModel.findByIdAndRemove({ _id: req.params.id }, (err) => {
        if (!err) {
          res.status(200).send(
            successResponse({
              message: "Goal Deleted Successfully!",
            })
          );
        } else {
          res.status(500).send(
            failResponse({
              message: err ? err.message : "Goal Not Deleted!",
            })
          );
        }
      });
    } else {
      res.status(500).send(
        failResponse({
          message: err ? err.message : "Goal Not Deleted!",
        })
      );
    }
  });
};

const deleteGoals = (req, res) => {
  // #swagger.tags = ['Goals']
  ObjectivesModel.deleteMany({ _id: { $in: req.body } }, (err) => {
    if (!err) {
      res.status(200).send(
        successResponse({
          message: "Goal Deleted Successfully!",
        })
      );
    } else {
      res.status(500).send(
        failResponse({
          message: err ? err.message : "Goals Not Deleted!",
        })
      );
    }
  });
};

module.exports = {
  deleteGoal,
  createGoal,
  cascadeGoal,
  updateGoal,
  getGoals,
  deleteGoals,
};
