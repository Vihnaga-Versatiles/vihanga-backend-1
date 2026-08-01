const ObjectivesModel = require("../models/objectives.model");
const KeyResultsModel = require("../models/keyResults.model");
const EmployeesModel = require("../models/employee.model");
const RewardsModel = require("../models/rewardManagement.model");
const AuditTrailModel = require("../models/AuditTrail");
const TasksModel = require("../models/tasks2.model");
const RedemptionsModel = require("../models/redemptions.model");
const RewardPointsModel = require("../models/rewardpoints.model");
const PrivilegesModel = require("../models/privileges.model");
const { percentageCalculation, totalSum, totalRewardPoints, isValidDate, totalRewardPointsTask } = require("../helpers/percentageCalculation");
const { sendEmail } = require("../middlewares/recruitment/sendMail");
const { objectiveApprovalTemplate } = require("../templatees/objectiveApprovalTemplate");
const { CLIENTURL, JWT_SECRET } = require("../config/environment");
const jwt = require("jsonwebtoken");

const buildEmailLoginLink = ({ emailId, redirectPath }) => {
  const cleanEmail = (emailId || "").toString().replace(/[\r\n]/g, "").trim().toLowerCase();
  const safeRedirect = (redirectPath || "/admin/dashboard").toString().trim();
  const token = jwt.sign(
    { email: cleanEmail, fromEmail: true, purpose: "email_link_login" },
    process.env.JWT_SECRET || JWT_SECRET,
    { expiresIn: "2d" }
  );
  return `${CLIENTURL}/auth/login?fromEmail=true&emailId=${encodeURIComponent(
    cleanEmail
  )}&token=${encodeURIComponent(token)}&redirect=${encodeURIComponent(safeRedirect)}`;
};

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

const getEmpWithRewards = async (req, res) => {
  // #swagger.tags = ['Objectives']
  try {
    const userTab = req.params.usertab;
    const userId = req.params.id;
    const myTeam = await EmployeesModel.find({ "employmentInformation.lineManager": userId, "employmentInformation.status": "Active" }, {
      _id: 1
    });
    let myTeamIds = myTeam.length > 0 ? myTeam.map(item => item._id.toString()) : [];
    let obj = {};
    if (userTab === "company") {
      obj.companyId = req.params.companyId;
    } else {
      if (myTeamIds.length > 0) {
        obj.mainTask = { $eq: "" };
        obj.assignTo = { $in: myTeamIds }
      } else {
        obj.mainTask = { $eq: "" };
        obj.assignTo = { $in: [userId] }
      }
    }
    const tasks = await TasksModel.find({ ...obj, assignTo: { $ne: null } }, {
      assignTo: 1,
      progressStatus: 1,
      mainTask: 1,
    }).sort({ _id: -1 });
    const allMainTasks = tasks.filter(task => task.mainTask !== "");
    const employees = await EmployeesModel.find({ companyId: req.params.companyId, "employmentInformation.status": "Active" }, {
      "employmentInformation.department": 1,
      "employmentInformation.employeeNumber": 1,
      "personalInformation.firstName": 1,
      "personalInformation.lastName": 1,
      "contactInformation.email": 1,
      "personalInformation.profilePicture": 1,
      "employmentInformation.designation": 1,
      status: 1,
      createdAt: 1,
    }).sort({ _id: -1 });
    const employeeIds = employees.map(item => item._id);

    const object = await ObjectivesModel.find({ employeeReferenceId: { $in: employeeIds } }, {
      employeeReferenceId: 1,
      objective: 1,
      weight: 1,
      approvalRequired: 1,
      progressStatus: 1,
    }).sort({ _id: -1 });
    const objectiveIds = object.map(item => item._id);

    const keyResults = await KeyResultsModel.find({ objectiveId: { $in: objectiveIds } }, {
      objectiveId: 1,
      approvalRequired: 1,
      target: 1,
      actual: 1,
      polarity: 1,
    }).sort({ _id: -1 });
    const redemptionPoints = await RedemptionsModel.find({ userId: userId, status: "approved" }).sort({ _id: -1 });
    let totalPoints = totalSum(redemptionPoints, "rewardPoints")

    const rewards = await RewardsModel.findOne({ companyId: req.params.companyId });
    let krAchievementPercent = !!rewards ? rewards.krAchievementPercent : 0;
    let krAchievementPoints = !!rewards ? rewards.krAchievementPoints : 0;
    let taskAchievementPercent = !!rewards ? rewards.taskAchievementPercent : 0;
    let taskAchievementPoints = !!rewards ? rewards.taskAchievementPoints : 0;
    let subTaskAchievementPercent = !!rewards ? rewards.subTaskAchievementPercent : 0;
    let subTaskAchievementPoints = !!rewards ? rewards.subTaskAchievementPoints : 0;
    let objectivesAchievementPercent = !!rewards ? rewards.objectivesAchievementPercent : 0;
    let objectivesAchievementPoints = !!rewards ? rewards.objectivesAchievementPoints : 0;

    const finalData = employees.map((eachEmployee) => {
      const objectives = object.filter(eachObjective => {
        return eachObjective.employeeReferenceId !== undefined &&
          eachEmployee._id.toString() === eachObjective.employeeReferenceId.toString();
      });
      let tasksResult = tasks.length > 0 ? tasks.filter(mainTask => mainTask.assignTo.findIndex(itemAssign => itemAssign == eachEmployee._id.toString()) > -1).map((task) => {
        let newObj = { taskPoints: 0, subTaskPoints: 0, assignTo: task.assignTo ? task.assignTo : [] };
        let taskrewardPoints = totalRewardPointsTask(task.progressStatus, taskAchievementPercent, taskAchievementPoints);
        let subTasks = allMainTasks.filter(item => item.mainTask == task._id.toString());
        let subTaskPoints = subTasks.length > 0 ? subTasks.reduce((prev, current) => {
          return prev + totalRewardPointsTask(current.progressStatus, subTaskAchievementPercent, subTaskAchievementPoints);
        }, 0) : 0;
        newObj.taskPoints = taskrewardPoints;
        newObj.subTaskPoints = subTaskPoints;
        return newObj;
      }) : [];

      let result = objectives.map((objective) => {
        let newObj = { _id: objective._id, objective: objective.objective, employeeReferenceId: objective.employeeReferenceId, weight: objective.weight, approvalRequired: objective.approvalRequired };
        newObj.employeeNumber = eachEmployee.employmentInformation.employeeNumber;
        let filteredKeyResults = keyResults
          .filter((item) => item.objectiveId == objective._id.toString());
        let keyResultsPoints = filteredKeyResults.length > 0 ? filteredKeyResults.reduce((prev, current) => {
          let percent = percentageCalculation(current);
          return prev + current.approvalRequired ? 0 : totalRewardPoints(percent, krAchievementPercent, krAchievementPoints, newObj);
        }, 0) : 0;
        newObj.keyResultsPoints = keyResultsPoints;
        newObj.children = filteredKeyResults
          .map((item) => {
            let percent = percentageCalculation(item);
            return {
              percent: (percent == "NaN" || percent == null) ? 0 : percent,
              weight: newObj.weight
            };
          });
        newObj.progressStatus =
          newObj.children.length > 0
            ? Math.min(100, Math.round(totalSum(newObj.children, "percent") / newObj.children.length))
            : (newObj.progressStatus > 0 ? Math.min(100, newObj.progressStatus) : "0");

        newObj.objectivePoints = newObj.approvalRequired ? 0 : totalRewardPoints(newObj.progressStatus, objectivesAchievementPercent, objectivesAchievementPoints, newObj);
        return newObj;
      });
      let totalObjectivesPoints = totalSum(result, "objectivePoints");
      let totalKeyResultsPoints = totalSum(result, "keyResultsPoints");
      let totalTaskPoints = tasksResult.length > 0 ? totalSum(tasksResult, "taskPoints") : 0;
      let totalSubTaskPoints = tasksResult.length > 0 ? totalSum(tasksResult, "subTaskPoints") : 0;
      let totRewards = parseFloat(Number(!isNaN(totalObjectivesPoints) ? totalObjectivesPoints : 0) + Number(!isNaN(totalKeyResultsPoints) ? totalKeyResultsPoints : 0) + Number(totalTaskPoints) + Number(totalSubTaskPoints)).toFixed(1);
      return {
        ...eachEmployee._doc,
        empRewards: totRewards,
        rewardPoints: totRewards > 0 ? (Number(totRewards) - Number(totalPoints)).toFixed(1) : totRewards
      }
    }).sort((a, b) => {
      return b.empRewards - a.empRewards;
    });
    const slicedArray = finalData.filter(item => item.rewardPoints > 0).map(item => {
      let obj = { ...item };
      obj.empRewards = item._id == userId ? obj.empRewards - totalPoints : obj.empRewards;
      return obj;
    })
    res.status(200).send(
      successResponse({
        message: "Objectives Reward Points Retrieved Successfully!",
        data: slicedArray
      })
    );
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Objectives Not Fetched!",
      })
    );
  }
};

const getObjectivesChartOCR = async (req, res) => {
  // #swagger.tags = ['Objectives']
  try {
    let tab = req.params.tab;
    let employeeIds = await EmployeesModel.find({ $or: [{ _id: req.params.id, "employmentInformation.status": "Active" }, { "employmentInformation.lineManager": req.params.id, "employmentInformation.status": "Active" }] }).sort({ _id: -1 })
    employeeIds = employeeIds.length > 0 ? employeeIds.map(item => item._id) : [];
    let objj = tab === "myteam" ? { employeeReferenceId: { $in: employeeIds } } : { employeeReferenceId: req.params.id }
    const objectives = await ObjectivesModel.find(objj).sort({ _id: -1 });
    let employeeIdss = objectives.map(item => item.employeeReferenceId);
    let objIds = objectives.map(item => item._id);
    const keyResults = await KeyResultsModel.find({ objectiveId: { $in: objIds } }).sort({ _id: -1 });
    let objectives2 = await ObjectivesModel.find(objj).sort({ _id: -1 });
    const employees = await EmployeesModel.find({ _id: { $in: employeeIdss }, companyId: req.params.companyId, "employmentInformation.status": "Active" }).sort({ _id: -1 });
    const tasks = await TasksModel.find({}).sort({ _id: -1 });
    let filteredTasks = tasks.filter(item => item._doc.assignTo.includes(req.params.id));

    objectives2 = objectives2.map(objective => {
      let newObj = { ...objective._doc }
      newObj.children = keyResults
        .filter((item) => item.objectiveId == newObj._id.toString())
        .map((item) => {
          let percent = percentageCalculation(item);
          return {
            ...item._doc,
            percent: (percent == "NaN" || percent == null) ? 0 : percent,
            owner: objective._doc.employeeName,
            profilePicture: employees.find(employee => employee.personalInformation.firstName == objective._doc.employeeName.split(" ")[0]) ?
              employees.find(employee => employee.personalInformation.firstName == objective._doc.employeeName.split(" ")[0]).personalInformation.profilePicture : "https://www.clipartmax.com/png/middle/103-1038880_user-rubber-stamp-female-user-icon.png",
            rewardPoints: 0,
            objective: objective._doc.objective,
            objectiveId: item.objectiveId,
            children: tasks.filter(itemTask => itemTask._doc.krReferenceId == item._doc._id)
          };
        });
      newObj.progressStatus =
        newObj.children.length > 0
          ? Math.min(100, Math.round(totalSum(newObj.children, "percent") / newObj.children.length))
          : (newObj.progressStatus > 0 ? Math.min(100, newObj.progressStatus) : "0");
      return newObj;
    })

    let resultTasks = filteredTasks.map((item) => {
      let newObj = { ...item._doc };
      let completed = newObj.estimationEffort;
      let remaining = newObj.actualEffort;
      newObj.completed = completed;
      newObj.remaining = remaining;
      return newObj;
    });
    let estimated = resultTasks.length > 0 ? resultTasks.reduce((prev, current) => {
      return prev + Number(current.completed);
    }, 0) : 0;
    let actual = resultTasks.length > 0 ? resultTasks.reduce((prev, current) => {
      return prev + Number(current.remaining);
    }, 0) : 0;
    resultTasks = [{ completed: estimated, remaining: actual }]
    let result = objectives.map((objective) => {
      let newObj = { _id: objective._doc._id, objective: objective._doc.objective, employeeReferenceId: objective._doc.employeeReferenceId, employeeName: objective._doc.employeeName, createdAt: objective._doc.createdAt, updatedAt: objective._doc.updatedAt };
      newObj.employeeNumber = employees.filter(employee => employee._id == newObj.employeeReferenceId).length > 0 ?
        employees.filter(employee => employee._id == newObj.employeeReferenceId)[0].employmentInformation.employeeNumber : "";
      let filteredKeyResults = keyResults
        .filter((item) => item.objectiveId == objective._id.toString());
      let completed = filteredKeyResults.length > 0 ? filteredKeyResults.reduce((prev, current) => {
        let percent = percentageCalculation(current);
        return prev + (percent >= 100 ? 1 : 0);
      }, 0) : 0;
      let remaining = filteredKeyResults.length > 0 ? filteredKeyResults.reduce((prev, current) => {
        let percent = percentageCalculation(current);
        return prev + (percent < 100 ? 1 : 0);
      }, 0) : 0;
      newObj.completed = completed;
      newObj.remaining = remaining;
      return newObj;
    });
    res.status(200).send(
      successResponse({
        message: "Objectives Retrieved Successfully!",
        data: {
          result,
          resultTasks,
          objectives2
        }
      })
    );
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Objectives Not Fetched!",
      })
    );
  }
};
const updateObjective = async (req, res) => {
  // #swagger.tags = ['Objectives']
  try {
    if (req.body.weight <= 100) {
      const objective = await ObjectivesModel.findById(req.params.id);
      const rewards = await RewardsModel.find({}).sort({ _id: -1 });

      let objectivesAchievementPercent = rewards.length > 0 ? rewards[0].objectivesAchievementPercent : 0;
      let objectivesAchievementPoints = rewards.length > 0 ? rewards[0].objectivesAchievementPoints : 0;

      if (objective) {
        // Only overwrite dueDate when a valid date is provided; otherwise keep existing
        if (Object.prototype.hasOwnProperty.call(req.body, "dueDate")) {
          if (isValidDate(req.body.dueDate)) {
            req.body.dueDate = req.body.dueDate;
          } else {
            delete req.body.dueDate;
          }
        }
        let dynamicRewardPoints = Number(req.body.dynamicRewardPoints) || 0;
        let weight = Number(req.body.weight) || 0;

        let rewardPoints = (dynamicRewardPoints * weight) / 100;



        let rewardApprovalRequired = req.body.approvalRequired || false;

        // Handle isGifShown logic properly
        let isGifShownValue;
        if (req.body?.isGifShown === true && objective.isGifShown === false) {
          // This is the first time setting to true, set to true
          isGifShownValue = true;
        } else if (objective.isGifShown === true) {
          // Already true, keep it true
          isGifShownValue = true;
        } else {
          // Keep the existing value (false)
          isGifShownValue = objective.isGifShown;
        }

        let updateData = {
          ...req.body,
          objectiveStatus: "Create",
          isGifShown: isGifShownValue,
          approvalRequired: rewardApprovalRequired,
          progressStatus: req.body.progressStatus
        };

        console.log("Backend update - isGifShown from frontend:", req.body?.isGifShown);
        console.log("Backend update - existing isGifShown:", objective.isGifShown);
        console.log("Backend update - setting isGifShown to:", isGifShownValue);
        console.log("Backend update - isApproved status:", req.body.isApproved);
        console.log("Backend update - pending data:", req.body.pending);

        // First, update the objective with basic data
        ObjectivesModel.findByIdAndUpdate(req.params.id, updateData, async (err, result) => {
          console.log("Update result:", result);
          if (!err) {
            let auditId = req.auditId.toString();
            await AuditTrailModel.findByIdAndUpdate(auditId, { recordId: req.params.id }, async (error, doc) => {
              if (!error) {
                // Handle weight-based approval logic (when isApproved is explicitly set)
                if (req.body.isApproved === "pending" && req.body.pending) {
                  // Objective submitted for approval based on weight
                  console.log("Setting objective to pending approval (weight-based)");

                  // Send email notification to manager
                  try {
                    const employee = await EmployeesModel.findById(objective.employeeReferenceId);
                    if (employee && employee.employmentInformation && employee.employmentInformation.lineManager) {
                      const manager = await EmployeesModel.findById(employee.employmentInformation.lineManager);
                      if (manager && manager.contactInformation && manager.contactInformation.email) {
                        const emailData = {
                          managerName: `${manager.personalInformation.firstName} ${manager.personalInformation.lastName || ''}`.trim(),
                          employeeName: `${employee.personalInformation.firstName} ${employee.personalInformation.lastName || ''}`.trim(),
                          objectiveTitle: req.body.objective || objective.objective,
                          weight: req.body.weight || objective.weight,
                          dueDate: req.body.dueDate ? new Date(req.body.dueDate).toLocaleDateString() : (objective.dueDate ? new Date(objective.dueDate).toLocaleDateString() : 'N/A'),
                          viewUrl: buildEmailLoginLink({
                            emailId: manager.contactInformation.email,
                            redirectPath: "/admin/objectives?tab=myteam"
                          })
                        };

                        await sendEmail(
                          manager.contactInformation.email,
                          "Objective Approval Required",
                          emailData,
                          true,
                          objectiveApprovalTemplate
                        );
                        console.log(`Email sent to manager: ${manager.contactInformation.email}`);
                      }
                    }
                  } catch (emailErr) {
                    console.error("Error sending approval email:", emailErr);
                  }
                } else if (req.body.isApproved === "approved") {
                  // Manager approved the objective
                  console.log("Manager approved objective");
                  if (rewardPoints > 0) {
                    try {
                      const existingRewardPoints = await RewardPointsModel.findOne({
                        referenceID: result._doc._id,
                        type: "Objective",
                        isApproved: "approved"
                      });

                      if (existingRewardPoints) {
                        const updatedRewardPoints = existingRewardPoints.rewardPoints + rewardPoints;
                        await RewardPointsModel.findByIdAndUpdate(existingRewardPoints._id, {
                          rewardPoints: updatedRewardPoints,
                          employeeReferenceId: result._doc.employeeReferenceId,
                          isApproved: "approved"
                        });
                      } else {
                        const newRewardPoints = new RewardPointsModel({
                          referenceID: result._doc._id,
                          employeeReferenceId: result._doc.employeeReferenceId,
                          type: "Objective",
                          rewardPoints: rewardPoints,
                          isApproved: "approved"
                        });
                        await newRewardPoints.save();
                      }
                    } catch (rewardErr) {
                      console.error('Error adding reward points:', rewardErr);
                    }
                  }
                } else if (req.body.isApproved === "rejected") {
                  // Manager rejected the objective
                  console.log("Manager rejected objective");
                  // Clear pending data, set to rejected
                  await ObjectivesModel.findByIdAndUpdate(req.params.id, {
                    pending: null
                  });
                }
                // Legacy logic: Handle progress-based approval for backward compatibility
                else if (req.body.progressStatus == 100 && rewardPoints > 0 && !req.body.isApproved) {
                  if (rewardApprovalRequired === false) {
                    // No approval required - add reward points and mark as approved
                    try {
                      const existingRewardPoints = await RewardPointsModel.findOne({
                        referenceID: result._doc._id,
                        type: "Objective",
                        isApproved: "approved"
                      });

                      if (existingRewardPoints) {
                        const updatedRewardPoints = existingRewardPoints.rewardPoints + rewardPoints;
                        await RewardPointsModel.findByIdAndUpdate(existingRewardPoints._id, {
                          rewardPoints: updatedRewardPoints,
                          employeeReferenceId: result._doc.employeeReferenceId,
                          isApproved: "approved"
                        });
                      } else {
                        const newRewardPoints = new RewardPointsModel({
                          referenceID: result._doc._id,
                          employeeReferenceId: result._doc.employeeReferenceId,
                          type: "Objective",
                          rewardPoints: rewardPoints,
                          isApproved: "approved"
                        });
                        await newRewardPoints.save();
                      }
                    } catch (rewardErr) {
                      console.error('Error adding reward points:', rewardErr);
                    }

                    // Update objective with approval status
                    await ObjectivesModel.findByIdAndUpdate(req.params.id, {
                      isApproved: "approved"
                    });
                  } else {
                    // Approval required - store in pending object and don't add reward points
                    const pendingData = {
                      dynamicRewardPoints: rewardPoints,
                      approvalRequired: rewardApprovalRequired,
                      progressStatus: req.body.progressStatus,
                      timestamp: new Date()
                    };
                    await ObjectivesModel.findByIdAndUpdate(req.params.id, {
                      pending: pendingData,
                      isApproved: "pending"
                    });
                  }
                }

                // Send response after all processing is complete
                // Fetch the updated document to get the correct progressStatus
                const updatedObjective = await ObjectivesModel.findById(req.params.id);
                res.status(200).send(
                  successResponse({
                    message: "Objective Updated Successfully!",
                    data: {
                      ...updatedObjective._doc,
                      rewardPoints: req.body.progressStatus == 100 && rewardPoints > 0 ? rewardPoints : 0,
                      approvalRequired: rewardApprovalRequired,
                      isGifShown: isGifShownValue,
                      pendingApproval: req.body.progressStatus == 100 && rewardPoints > 0 && rewardApprovalRequired
                    }
                  })
                );
              } else {
                res.status(500).send(
                  failResponse({
                    message: error ? error.message : "Objective Not Updated!",
                  })
                );
              }
            });
          } else {
            res.status(500).send(
              failResponse({
                message: err ? err.message : "Objective Not Updated!",
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
        message: err ? err.message : "Objective Not Updated!",
      })
    );
  }
};

const updateObjectiveCascaded = async (req, res) => {
  // #swagger.tags = ['Objectives']
  try {
    const objectiveId = req.params.id;
    const companyId = req.params.companyId;
    const progressStatus = req.body.progressStatus;

    const privilegesManager = await PrivilegesModel.find({ role: "Manager", companyId }).sort({ _id: -1 });
    if (privilegesManager.length > 0) {
      const allPrivileges = privilegesManager.map(item => item.privileges);
      const managerCascadedPrivilege = allPrivileges.length > 0
        ? allPrivileges[0].find(item => item.category === "Goals" && item.page === "Update Manager Progress For Cascaded")
        : null;
      const managerPrivilege = managerCascadedPrivilege?.edit || false;
      // Get similar objectives
      const similarObjectives = await ObjectivesModel.find({ cascadedObjectiveId: objectiveId });
      if (managerPrivilege && similarObjectives.length > 0) {
        ObjectivesModel.updateMany({ cascadedObjectiveId: objectiveId }, {
          progressStatus
        }, async (err, result) => {
          if (!err) {
            //update all key results
            const objectiveIds = similarObjectives.map(item => item._id);
            const keyResults = await KeyResultsModel.find({ objectiveId: { $in: objectiveIds } });
            if (keyResults.length > 0) {
              const items = keyResults.map(item => {
                let obj = {
                  ...item._doc,
                }
                let actual = parseFloat(obj.polarity === "Positive" ? (obj.target * (progressStatus / 100)) : ((obj.target) / (progressStatus / 100))).toFixed(2);
                let percent = progressStatus;
                obj.actual = +actual;
                obj.percent = percent;
                return {
                  _id: item._id,
                  actual: obj.actual,
                  target: obj.target,
                  polarity: obj.polarity,
                  percent: obj.percent
                };
              });
              const ops = [];
              items.forEach(item => {
                if (item._id) {
                  ops.push(
                    {
                      updateOne: {
                        filter: { _id: item._id },
                        update: {
                          $set: {
                            ...item,
                            approvalRequired: false
                          },
                        },
                        upsert: true
                      }
                    }
                  );
                }
              })
              await KeyResultsModel.bulkWrite(ops, { ordered: false });

              res.status(200).send(
                successResponse({
                  message: "Objectives and Key Results Updated Successfully!"
                })
              );
            } else {
              res.status(200).send(
                successResponse({
                  message: "Objectives Updated Successfully!"
                })
              );
            }

          } else {
            res.status(500).send(
              failResponse({
                message: err ? err.message : "Objective Not Updated!",
              })
            );
          }
        });
      } else {
        res.status(500).send(
          failResponse({
            message: "Objectives Not Found OR Permission Not Provided to Cascade!",
          })
        );
      }
    } else {
      res.status(500).send(
        failResponse({
          message: "Privileges Not Found!",
        })
      );
    }
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Objective Not Updated!",
      })
    );
  }
};

const deleteObjective = async (req, res) => {
  // #swagger.tags = ['Objectives']
  let auditId = req.auditId.toString();
  await AuditTrailModel.findByIdAndUpdate(auditId, { recordId: req.params.id }, (err, doc) => {
    if (!err) {
      ObjectivesModel.findByIdAndRemove({ _id: req.params.id }, async (err) => {
        if (!err) {
          let keyResultIds = await KeyResultsModel.find({ objectiveId: req.params.id });
          keyResultIds = keyResultIds.map(item => item._id);
          RewardPointsModel.deleteMany({ referenceID: { $in: [req.params.id, ...keyResultIds] } }, (err) => {
            if (!err) {
              KeyResultsModel.deleteMany({ objectiveId: req.params.id }, (err) => {
                if (!err) {
                  res.status(200).send(
                    successResponse({
                      message: "Objective Deleted Successfully!",
                    })
                  );
                } else {
                  res.status(500).send(
                    failResponse({
                      message: err ? err.message : "Objective Not Deleted!",
                    })
                  );
                }
              });
            } else {
              res.status(500).send(
                failResponse({
                  message: err ? err.message : "Objective Not Deleted!",
                })
              );
            }
          });
        } else {
          res.status(500).send(
            failResponse({
              message: err ? err.message : "Objective Not Deleted!",
            })
          );
        }
      });
    } else {
      res.status(500).send(
        failResponse({
          message: err ? err.message : "Objective Not Deleted!",
        })
      );
    }
  });
};


const deleteObjectives = async (req, res) => {
  // #swagger.tags = ['Objectives']
  try {
    console.log('Raw request body:', JSON.stringify(req.body, null, 2));

    // Normalize input to array format
    let items = [];
    if (Array.isArray(req.body)) {
      items = req.body;
    } else if (typeof req.body === 'object' && req.body !== null) {
      if (req.body.id && req.body.type) {
        items = [req.body]; // Single item
      } else {
        items = Object.values(req.body); // {0:{...}, 1:{...}} format
      }
    }

    if (items.length === 0) {
      return res.status(400).send(
        failResponse({
          message: "Invalid request format",
          suggestion: "Please provide items with 'id' and 'type' fields"
        })
      );
    }

    console.log('Normalized items:', JSON.stringify(items, null, 2));

    // Process all items and their children recursively
    const objectivesToDelete = new Set();
    const keyResultsToDelete = new Set();
    const tasksToDelete = new Set();

    const processItem = (item) => {
      if (!item.id || !item.type) return;

      const type = item.type.toLowerCase();
      switch (type) {
        case 'objective':
          objectivesToDelete.add(item.id);
          if (item.children) {
            item.children.forEach(processItem);
          }
          break;
        case 'keyresult':
          keyResultsToDelete.add(item.id);
          if (item.children) {
            item.children.forEach(processItem);
          }
          break;
        case 'task':
          tasksToDelete.add(item.id);
          break;
      }
    };

    items.forEach(processItem);

    console.log('Identified for deletion:', {
      objectives: Array.from(objectivesToDelete),
      keyResults: Array.from(keyResultsToDelete),
      tasks: Array.from(tasksToDelete)
    });

    // Execute deletions
    const deletionResults = {
      objectives: 0,
      keyResults: 0,
      tasks: 0
    };

    // Delete objectives and all their relationships
    if (objectivesToDelete.size > 0) {
      const objectiveIds = Array.from(objectivesToDelete);

      // Find all related key results and tasks
      const relatedKeyResults = await KeyResultsModel.find({
        objectiveId: { $in: objectiveIds }
      });
      const relatedKeyResultIds = relatedKeyResults.map(kr => kr._id);

      const relatedTasks = await TasksModel.find({
        $or: [
          { objectiveId: { $in: objectiveIds } },
          { keyResultId: { $in: relatedKeyResultIds } }
        ]
      });
      const relatedTaskIds = relatedTasks.map(t => t._id);

      // Add to deletion sets
      relatedKeyResults.forEach(kr => keyResultsToDelete.add(kr._id));
      relatedTasks.forEach(t => tasksToDelete.add(t._id));

      // Execute deletions
      const objResult = await ObjectivesModel.deleteMany({
        _id: { $in: objectiveIds }
      });
      deletionResults.objectives = objResult.deletedCount;
    }

    // Delete key results and their tasks
    if (keyResultsToDelete.size > 0) {
      const keyResultIds = Array.from(keyResultsToDelete);

      // Find related tasks
      const relatedTasks = await TasksModel.find({
        keyResultId: { $in: keyResultIds }
      });
      relatedTasks.forEach(t => tasksToDelete.add(t._id));

      const krResult = await KeyResultsModel.deleteMany({
        _id: { $in: keyResultIds }
      });
      deletionResults.keyResults = krResult.deletedCount;
    }

    // Delete tasks
    if (tasksToDelete.size > 0) {
      const taskIds = Array.from(tasksToDelete);
      const taskResult = await TasksModel.deleteMany({
        _id: { $in: taskIds }
      });
      deletionResults.tasks = taskResult.deletedCount;
    }

    // Clean up reward points
    const allDeletedIds = [
      ...Array.from(objectivesToDelete),
      ...Array.from(keyResultsToDelete),
      ...Array.from(tasksToDelete)
    ];
    await RewardPointsModel.deleteMany({
      referenceID: { $in: allDeletedIds }
    });

    // Prepare response
    const responseParts = [];
    if (deletionResults.objectives > 0) {
      responseParts.push(`${deletionResults.objectives} objective(s)`);
    }
    if (deletionResults.keyResults > 0) {
      responseParts.push(`${deletionResults.keyResults} key result(s)`);
    }
    if (deletionResults.tasks > 0) {
      responseParts.push(`${deletionResults.tasks} task(s)`);
    }

    const message = responseParts.length > 0
      ? `Successfully deleted: ${responseParts.join(', ')}`
      : 'No items were deleted';

    res.status(200).send(
      successResponse({
        message,
        details: {
          ...deletionResults,
          timestamp: new Date().toISOString()
        }
      })
    );

  } catch (err) {
    console.error('Deletion error:', err);
    res.status(500).send(
      failResponse({
        message: "Deletion operation failed",
        error: process.env.NODE_ENV === 'development' ? {
          message: err.message,
          stack: err.stack
        } : undefined,
        suggestion: "Please verify the request data and try again. Contact support if the issue persists."
      })
    );
  }
};

const approveAllObjectives = async (req, res) => {
  // #swagger.tags = ['Objectives']
  try {
    const { managerId, companyId } = req.params;

    // Find all employees managed by this manager in this company
    const myTeam = await EmployeesModel.find({
      "employmentInformation.lineManager": managerId,
      companyId: companyId,
      "employmentInformation.status": "Active"
    }, { _id: 1 });

    const teamIds = myTeam.map(emp => emp._id.toString());

    if (teamIds.length === 0) {
      return res.status(200).send(successResponse({
        message: "No team members found for this manager",
        data: []
      }));
    }

    // Find all pending objectives for those employees
    const pendingObjectives = await ObjectivesModel.find({
      employeeReferenceId: { $in: teamIds },
      isApproved: "pending"
    });

    if (pendingObjectives.length === 0) {
      return res.status(200).send(successResponse({
        message: "No pending objectives found for approval",
        data: []
      }));
    }

    const rewards = await RewardsModel.find({}).sort({ _id: -1 });
    // let objectivesAchievementPercent = rewards.length > 0 ? rewards[0].objectivesAchievementPercent : 0;
    // let objectivesAchievementPoints = rewards.length > 0 ? rewards[0].objectivesAchievementPoints : 0;

    const results = [];
    for (const objective of pendingObjectives) {
      let dynamicRewardPoints = Number(objective.dynamicRewardPoints) || 0;
      let weight = Number(objective.weight) || 0;
      let rewardPoints = (dynamicRewardPoints * weight) / 100;

      // Update objective to approved
      const updatedObj = await ObjectivesModel.findByIdAndUpdate(objective._id, {
        isApproved: "approved",
        pending: null
      }, { new: true });

      // Add reward points
      if (rewardPoints > 0) {
        try {
          const existingRewardPoints = await RewardPointsModel.findOne({
            referenceID: objective._id,
            type: "Objective",
            isApproved: "approved"
          });

          if (existingRewardPoints) {
            const updatedRewardPointsValue = existingRewardPoints.rewardPoints + rewardPoints;
            await RewardPointsModel.findByIdAndUpdate(existingRewardPoints._id, {
              rewardPoints: updatedRewardPointsValue,
              employeeReferenceId: objective.employeeReferenceId,
              isApproved: "approved"
            });
          } else {
            const newRewardPoints = new RewardPointsModel({
              referenceID: objective._id,
              employeeReferenceId: objective.employeeReferenceId,
              type: "Objective",
              rewardPoints: rewardPoints,
              isApproved: "approved"
            });
            await newRewardPoints.save();
          }
        } catch (rewardErr) {
          console.error(`Error adding reward points for objective ${objective._id}:`, rewardErr);
        }
      }
      results.push(updatedObj);
    }

    res.status(200).send(successResponse({
      message: `Successfully approved ${results.length} objective(s)`,
      data: results
    }));

  } catch (err) {
    res.status(500).send(failResponse({
      message: err ? err.message : "Failed to approve all objectives",
    }));
  }
};

module.exports = {
  deleteObjective,
  updateObjectiveCascaded,
  updateObjective,
  deleteObjectives,
  getEmpWithRewards,
  getObjectivesChartOCR,
  approveAllObjectives
};
