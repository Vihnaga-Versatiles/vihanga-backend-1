const mongoose = require("mongoose");
const ObjectivesModel = require("../models/objectives.model");
const KeyResultsModel = require("../models/keyResults.model");
const EmployeesModel = require("../models/employee.model");
const RewardsModel = require("../models/rewardManagement.model");
const PrivilegesModel = require("../models/privileges.model");
const AuditTrailModel = require("../models/AuditTrail");
const TasksModel = require("../models/tasks2.model");
const Tasks2Model = require("../models/tasks2.model");
const getRandom = require('../middlewares/randomNumber');
const RedemptionsModel = require("../models/redemptions.model");
const RewardPointsModel = require("../models/rewardpoints.model");
const OkrTabModel = require("../models/okrTab.model");
const { percentageCalculation, totalSum, totalRewardPoints, isValidDate, totalRewardPointsTask } = require("../helpers/percentageCalculation");
const { getObjectivePercentage } = require("../helpers/objectivePercentage");
const moment = require("moment");

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

const createObjective = async (req, res) => {
  // #swagger.tags = ['Objectives']
  try {
    if (req.body.weight <= 100) {
      const employee = await EmployeesModel.findOne({ _id: req.body.employeeReferenceId }).select("employmentInformation.employeeNumber");
      const rewards = await RewardsModel.find({}).sort({ _id: -1 });
      let requestBody = {
        employeeName: req.body.employeeName,
        okrPeriod: req.body.okrPeriod,
        okrYear: req.body.okrYear,
        objective: req.body.objective,
        dueDate: isValidDate(req.body.dueDate) ? req.body.dueDate : null,
        weight: req.body.weight,
        owner: req.body.owner,
        successMetrics: req.body.successMetrics,
        progressStatus: req.body.progressStatus,
        feedAttachment: req.body.feedAttachment,
        comments: req.body.comments,
        dimension: req.body.dimension,
        employeeReferenceId: req.body.employeeReferenceId,
        employeeNumber: employee.employmentInformation.employeeNumber,
        objectiveID: "OBJ_" + getRandom(7),
        approvalRequired: rewards.length > 0 ? rewards[0].approvalRequired : false,
        companyId: req.body.companyId
      };
      let objectivesAchievementPercent = rewards.length > 0 ? rewards[0].objectivesAchievementPercent : 0;
      let objectivesAchievementPoints = rewards.length > 0 ? rewards[0].objectivesAchievementPoints : 0;
      let rewardPoints = totalRewardPoints(requestBody.progressStatus, objectivesAchievementPercent, objectivesAchievementPoints, requestBody);
      const newObjective = new ObjectivesModel(requestBody);
      await newObjective.save().then(async (result, error) => {
        if (!error) {
          let auditId = req.auditId.toString();
          await AuditTrailModel.findByIdAndUpdate(auditId, { recordId: result._doc._id }, async (err, doc) => {
            if (!err) {
              if (rewardPoints > 0 && requestBody.approvalRequired) {
                let rewardRequestBody = {
                  referenceID: result._doc._id,
                  employeeReferenceId: result._doc.employeeReferenceId,
                  type: "Objective",
                  rewardPoints: rewardPoints,
                }
                const newRewardPoints = new RewardPointsModel(rewardRequestBody);
                await newRewardPoints.save().then(async (result2, err2) => {
                  if (!err2) {
                    res.status(200).send(
                      successResponse({
                        message: "Objective Created Successfully!",
                        data: {
                          ...result._doc,
                          rewardPoints,
                          approvalRequired: rewards.length > 0 ? rewards[0].approvalRequired : false
                        }
                      })
                    );
                  } else {
                    res.status(500).send(
                      failResponse({
                        message: "Object Not Created" + err2,
                      })
                    );
                  }
                })
              } else {
                res.status(200).send(
                  successResponse({
                    message: "Objective Created Successfully!",
                    data: {
                      ...result._doc,
                      rewardPoints,
                      approvalRequired: rewards.length > 0 ? rewards[0].approvalRequired : false
                    }
                  })
                );
              }
            } else {
              res.status(500).send(
                failResponse({
                  message: "Object Not Created" + err,
                })
              );
            }
          });
        } else {
          res.status(500).send(
            failResponse({
              message: "Object Not Created" + error,
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
        message: err ? err.message : "Objective Not Created!",
      })
    );
  }
};

const cascadeObjective = async (req, res) => {
  // #swagger.tags = ['Objectives']
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    let requestBody = req.body;
    let employeeIds = requestBody.map(item => item.employeeReferenceId);

    // Step 1: Validate KR weights for ALL employees before cascading
    for (const item of requestBody) {
      const employeeId = item.employeeReferenceId;
      const companyId = item.companyId;

      // Get employee name for better error messages
      const employee = await EmployeesModel.findById(employeeId).select("personalInformation");
      const employeeName = employee 
        ? `${employee.personalInformation.firstName} ${employee.personalInformation.lastName || ''}`.trim()
        : 'Unknown Employee';

      // Step 1: Fetch all existing objectives for this employee
      const existingObjectives = await ObjectivesModel.find({
        employeeReferenceId: employeeId,
        companyId: companyId
      }).select("_id");

      console.log(`[Validation] Employee: ${employeeName} (${employeeId})`);
      console.log(`[Validation] Found ${existingObjectives.length} objectives`);

      // Step 2: Get objective IDs as strings (KeyResults.objectiveId is stored as string)
      const objectiveIds = existingObjectives.map(obj => obj._id.toString());
console.log(objectiveIds,'objectiveIds');
      // Step 3: Fetch all KeyResults for these objectives
      let existingKeyResults = [];
      if (objectiveIds.length > 0) {
        existingKeyResults = await KeyResultsModel.find({
          objectiveId: { $in: objectiveIds }
        });
      }

      console.log(`[Validation] Found ${existingKeyResults.length} key results for ${employeeName}'s objectives`);
      console.log(`[Validation] KR weights:`, existingKeyResults.map(kr => ({ 
        id: kr._id, 
        weight: kr.weight, 
        objectiveId: kr.objectiveId
      })));

      // Step 4: Calculate total existing KR weight
      let totalExistingWeight = 0;
      existingKeyResults.forEach(kr => {
        totalExistingWeight += parseFloat(kr.weight || 0);
      });

      // Step 5: Calculate new KR weight from incoming request
      let newKRWeight = 0;
      if (Array.isArray(item.keyResults)) {
        item.keyResults.forEach(kr => {
          newKRWeight += parseFloat(kr.weight || 0);
        });
      }

      console.log(`[Validation] ${employeeName}: Existing weight: ${totalExistingWeight}%, New weight: ${newKRWeight}%, Total: ${totalExistingWeight + newKRWeight}%`);

      // Step 6: Validate that total weight should not exceed 100
      if (totalExistingWeight + newKRWeight > 100) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).send(
          failResponse({
            message: `KR weight exceeds 100% for ${employeeName}. Current weight: ${totalExistingWeight}%, Attempting to add: ${newKRWeight}%. Cascade aborted.`,
          })
        );
      }
    }

    // Step 2: If all validations pass, proceed with cascade
    const employees = await EmployeesModel.find({ _id: { $in: employeeIds } })
      .select("employmentInformation.employeeNumber")
      .sort({ _id: -1 })
      .session(session);

    const rewards = await RewardsModel.find({}).sort({ _id: -1 }).session(session);

    requestBody = requestBody.map((item) => {
      let obj = { ...item };
      const foundEmployee = employees.find(employee => employee._id.toString() === (obj.employeeReferenceId || "").toString());
      obj.cascaded = true;
      obj.objectiveID = "OBJ_" + getRandom(7);
      obj.employeeNumber = foundEmployee?.employmentInformation?.employeeNumber || "";
      obj.approvalRequired = rewards.length > 0 ? rewards[0].approvalRequired : false;
      obj.isAlignedToCompany = item.isAlignedToCompany || "Yes";
      obj.cascadeAssigneeType = item.cascadeAssigneeType || "employees";
      obj.isApproved = "";
      obj.pending = null;
      if (Array.isArray(obj.keyResults)) {
        obj.keyResults = obj.keyResults.map((kr) => ({
          ...kr,
          actual: 0,
          actualDate: null,
        }));
      }
      return obj;
    });

    // Insert objectives within transaction
    const result = await ObjectivesModel.insertMany(requestBody, { session });

    let finalData = result.map((item) => {
      let obj = { ...item._doc };
      let keyResults = obj.keyResults.map((keyResult) => {
        let resultKeyResult = {
          ...keyResult,
          objectiveId: item._id,
          approvalRequired: rewards.length > 0 ? rewards[0].approvalRequired : false,
          isAlignedToCompany: keyResult.isAlignedToCompany || obj.isAlignedToCompany || "Yes",
          cascadeAssigneeType: obj.cascadeAssigneeType || "employees",
          actual: 0,
          actualDate: null,
        };
        delete resultKeyResult._id;
        return resultKeyResult;
      });
      obj.keyResults = keyResults;
      return obj;
    });

    let finalKeyResults = [];
    finalData.forEach((item) => {
      finalKeyResults.push(...item.keyResults);
    });

    // Commit transaction if everything succeeds
    await session.commitTransaction();
    session.endSession();

    res.status(200).send(
      successResponse({
        message: "Objective Cascaded Successfully!",
        data: finalKeyResults,
      })
    );
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Objective Not Created!",
      })
    );
  }
};

const cascadeObjectiveWithKeyResults = async (req, res) => {
  // #swagger.tags = ['Objectives']
  try {
    let requestBody = req.body;
    const rewards = await RewardsModel.find({}).sort({ _id: -1 });
    requestBody = requestBody.map((item) => {
      let keyResult = { ...item };
      keyResult.krID = "KR_" + getRandom(7);
      keyResult.approvalRequired = rewards.length > 0 ? rewards[0].approvalRequired : false;
      keyResult.isAlignedToCompany = item.isAlignedToCompany || "Yes";
      keyResult.cascadeAssigneeType = item.cascadeAssigneeType || "employees";
      keyResult.actual = 0;
      keyResult.actualDate = null;
      return keyResult;
    });
    KeyResultsModel.insertMany(requestBody, (err, result) => {
      if (!err) {
        res.status(200).send(
          successResponse({
            message: "KeyResults Created Successfully!",
          })
        );
      } else {
        res.status(500).send(
          failResponse({
            message: err ? err.message : "KeyResults Not Created!",
          })
        );
      }
    });
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "KeyResults Not Created!",
      })
    );
  }
};
const getObjectivesAndOKRTab = async (req, res) => {
  // #swagger.tags = ['Objectives']
  try {
    const companyId = req.params.companyId;
    const role = req.params.role;
    //all company employees
    let employeeIds = [];
    let objj = {
      employeeReferenceId: req.params.userId,
      createdAt: {
        "$gte": new Date("2022-01-01"),
        "$lt": new Date()
      }
    };
    const isAdmin = ["Super Admin", "Manager", "HR Admin"].includes(role);
    if (isAdmin) {
      employeeIds = await EmployeesModel.find({ companyId, "employmentInformation.status": "Active" }, {
        _id: 1
      });
      employeeIds = employeeIds.map(item => item._id.toString());
      objj.employeeReferenceId = { $in: employeeIds }
    }

    let objectives = await ObjectivesModel.find(objj, {
      _id: 1
    }).sort({ _id: -1 });
    const objectiveIds = objectives.map(item => item._id.toString());
    const keyResults = await KeyResultsModel.find({ objectiveId: { $in: objectiveIds } }, {
      objectiveId: 1,
      target: 1,
      actual: 1,
      polarity: 1,
    }).sort({ _id: -1 });
    let result = objectives.map((objective) => {
      let newObj = {};
      newObj.children = keyResults
        .filter((item) => item.objectiveId == objective._id.toString())
        .map((item) => {
          let percent = percentageCalculation(item);
          return {
            percent: (percent == "NaN" || percent == null) ? 0 : percent,
          };
        });
      return newObj;
    });

    //create chart data
    let datas = {
      labels: ["Off Track", "At Risk", "On Track"],
      datasets: [
        {
          label: "OKR Progress",
          data: [0, 0, 0],
          backgroundColor: ["tomato", "orange", "green"],
          borderColor: ["tomato", "orange", "green"],
          borderWidth: 1,
        },
      ],
    }
    if (result.length > 0) {
      const currentYear = Number(moment(new Date()).format("YYYY"));
      const OKRTabs = await OkrTabModel.find({ companyId: req.params.companyId, $expr: { $eq: [{ $year: "$endDate" }, currentYear] } }).sort({ _id: -1 });
      //filter by date
      const updateData2 = OKRTabs.length > 0 ? OKRTabs : [];
      let updatedFinal = { ...datas };
      if (updateData2.length > 0) {
        updatedFinal.labels = ["Off Track", "At Risk", "On Track"]

        let completedTasks = 0
        let notstarted = 0
        let inprogress = 0
        result.map((item) => {
          item.children.forEach((itemTask) => {
            if (Number(itemTask.percent) >= Number(updateData2[0].lowValueRange[0].min) && Number(itemTask.percent) <= Number(updateData2[0].lowValueRange[0].max)) {
              notstarted = Number(notstarted) + 1
            }
            else if (Number(itemTask.percent) >= Number(updateData2[0].midValueRange[0].min) && Number(itemTask.percent) <= Number(updateData2[0].midValueRange[0].max)) {
              inprogress = Number(inprogress) + 1
            }
            else if (Number(itemTask.percent) >= Number(updateData2[0].highValueRange[0].min) && Number(itemTask.percent) <= Number(updateData2[0].highValueRange[0].max)) {
              completedTasks = Number(completedTasks) + 1
            }
          })
        })

        updatedFinal.datasets[0].data = [notstarted, inprogress, completedTasks];
        datas = updatedFinal;
      }
    }

    res.status(200).send(
      successResponse({
        message: "Objectives Retrieved Successfully!",
        data: [datas],
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
//const getObjectives = async (req, res) => {
//  // #swagger.tags = ['Objectives']
//  try {
//    let objj = req.params.role == "Super Admin" || req.params.role == "Manager" || req.params.role == "HR Admin" ? {} : { employeeReferenceId: req.params.userId, };
//    objj.createdAt = {
//      "$gte": new Date("2022-01-01"),
//      "$lt": new Date()
//    }
//    let objectives = await ObjectivesModel.find(objj).sort({ _id: -1 });
//    const objectiveIds = objectives.map(item => item._doc._id);
//    let employeeIds = objectives.map(item => item._doc.employeeReferenceId);
//    const keyResults = await KeyResultsModel.find({ objectiveId: { $in: objectiveIds } }).sort({ _id: -1 });
//    const employees = await EmployeesModel.find({ _id: { $in: employeeIds }, companyId: req.params.companyId, "employmentInformation.status": "Active" }).select("employmentInformation.employeeNumber personalInformation").sort({ _id: -1 });
//    const allEmployees = await EmployeesModel.find({ companyId: req.params.companyId, "employmentInformation.status": "Active" }).select("employmentInformation personalInformation").sort({ _id: -1 });
//    const rewards = await RewardsModel.find({ companyId: req.params.companyId }).sort({ _id: -1 });
//    const privileges = await PrivilegesModel.find({ role: req.params.role, companyId: req.params.companyId }).sort({ _id: -1 });
//    const tasks = await TasksModel.find({}).sort({ _id: -1 });
//    let krAchievementPercent = rewards.length > 0 ? rewards[0].krAchievementPercent : 0;
//    let krAchievementPoints = rewards.length > 0 ? rewards[0].krAchievementPoints : 0;
//    let result = objectives.map((objective) => {
//      let newObj = { ...objective._doc };
//      newObj.employeeNumber = employees.find(employee => employee._id == newObj.employeeReferenceId) ?
//        employees.find(employee => employee._id == newObj.employeeReferenceId).employmentInformation.employeeNumber : "";
//      newObj.children = keyResults
//        .filter((item) => item.objectiveId == objective._id.toString())
//        .map((item) => {
//          let percent = percentageCalculation(item);
//          let rewardPoints = item.approvalRequired ? 0 : totalRewardPoints(percent, krAchievementPercent, krAchievementPoints, newObj);
//          return {
//            ...item._doc,
//            percent: (percent == "NaN" || percent == null) ? 0 : percent,
//            owner: objective._doc.employeeName,
//            profilePicture: employees.find(employee => employee.personalInformation.firstName == objective._doc.employeeName.split(" ")[0]) ?
//              employees.find(employee => employee.personalInformation.firstName == objective._doc.employeeName.split(" ")[0]).personalInformation.profilePicture : "https://www.clipartmax.com/png/middle/103-1038880_user-rubber-stamp-female-user-icon.png",
//            rewardPoints,
//            objective: objective._doc.objective,
//            objectiveId: item.objectiveId,
//            children: tasks.filter(itemTask => itemTask._doc.krReferenceId == item._doc._id).map(itemTask => ({
//              ...itemTask._doc,
//              profilePicture: employees.find(employee => employee.personalInformation.firstName == objective._doc.employeeName.split(" ")[0]) ?
//                employees.find(employee => employee.personalInformation.firstName == objective._doc.employeeName.split(" ")[0]).personalInformation.profilePicture : "https://www.clipartmax.com/png/middle/103-1038880_user-rubber-stamp-female-user-icon.png"
//            }))
//          };
//        });
//      newObj.profilePicture = employees.find(employee => employee.personalInformation.firstName == newObj.owner.split(" ")[0]) ?
//        employees.find(employee => employee.personalInformation.firstName == newObj.owner.split(" ")[0]).personalInformation.profilePicture : "https://www.clipartmax.com/png/middle/103-1038880_user-rubber-stamp-female-user-icon.png";
//      newObj.progressStatus =
//        newObj.children.length > 0
//          ? Math.round(totalSum(newObj.children, "percent") / newObj.children.length
//          )
//          : (newObj.progressStatus > 0 ? newObj.progressStatus : "0");
//      let objectivesAchievementPercent = rewards.length > 0 ? rewards[0].objectivesAchievementPercent : 0;
//      let objectivesAchievementPoints = rewards.length > 0 ? rewards[0].objectivesAchievementPoints : 0;
//      let rewardPoints = newObj.approvalRequired ? 0 : totalRewardPoints(newObj.progressStatus, objectivesAchievementPercent, objectivesAchievementPoints, newObj);
//      newObj.rewardPoints = rewardPoints;
//      return newObj;
//    });

//    res.status(200).send(
//      successResponse({
//        message: "Objectives Retrieved Successfully!",
//        data: result,
//        privileges,
//        lineManager: allEmployees.filter(employee => employee._id == req.params.userId).length > 0 ? allEmployees.filter(employee => employee._id == req.params.userId)[0].employmentInformation.lineManager : "",
//        companyHead: allEmployees.filter(employee => employee.employmentInformation.departmentHead === "Yes").length > 0 ? allEmployees.filter(employee => employee.employmentInformation.departmentHead === "Yes")[0]._id : ""
//      })
//    );
//  } catch (err) {
//    res.status(500).send(
//      failResponse({
//        message: err ? err.message : "Objectives Not Fetched!",
//      })
//    );
//  }
//};

const getObjectives = async (req, res) => {
  // #swagger.tags = ['Objectives']
  try {
    const mongoose = require('mongoose');
    let objj = {};

    // When objectiveId is provided, fetch only that objective by _id (match by _id only so objectives without companyId are still retrieved)
    if (req.params.objectiveId && mongoose.Types.ObjectId.isValid(req.params.objectiveId)) {
      objj._id = new mongoose.Types.ObjectId(req.params.objectiveId);
    } else {
      objj.createdAt = {
        "$gte": new Date("2022-01-01"),
        "$lt": new Date()
      };

      // For non-admin users, show objectives they have access to
      if (!(req.params.role == "Super Admin" || req.params.role == "Manager" || req.params.role == "HR Admin")) {
        // Get objectives where user is the employeeReferenceId OR the owner
        objj.$or = [
          { employeeReferenceId: req.params.userId },
          { owner: req.params.userId }
        ];
      }
    }

    //TODO: objectives and keyresults aggregation.
    let objectives = await ObjectivesModel.aggregate([
      {
        $match: objj
      },
      {
        $project: {
          _id: 1,
          objective: "$$ROOT",
          b_id: { "$toString": "$_id" }
        }
      },
      {
        $lookup: {
          from: "keyresults",
          localField: "b_id",
          foreignField: "objectiveId",
          as: "children"
        }
      }
    ]);

    // Extract employee IDs properly - ensure they are ObjectIds, not names
    let employeeIds = objectives.map(singleObjective => singleObjective.objective.employeeReferenceId).filter(id => id);
    let ownerIds = objectives.map(singleObjective => singleObjective.objective.owner).filter(owner => owner);
    let allEmployeeIds = [...new Set([...employeeIds, ...ownerIds])]; // Remove duplicates

    // Filter out any non-ObjectId values (like names that might have been stored incorrectly)
    allEmployeeIds = allEmployeeIds.filter(id => mongoose.Types.ObjectId.isValid(id));

    const employees = await EmployeesModel.find({
      _id: { $in: allEmployeeIds },
      companyId: req.params.companyId,
      "employmentInformation.status": "Active"
    }).select("employmentInformation.employeeNumber personalInformation").sort({ _id: -1 });

    const allEmployees = await EmployeesModel.find({
      companyId: req.params.companyId,
      "employmentInformation.status": "Active"
    }).select("employmentInformation personalInformation").sort({ _id: -1 });

    const rewards = await RewardsModel.find({ companyId: req.params.companyId }).sort({ _id: -1 });
    const privileges = await PrivilegesModel.find({ role: req.params.role, companyId: req.params.companyId }).sort({ _id: -1 });
    const tasks = await TasksModel.find({}).sort({ _id: -1 });

    let krAchievementPercent = rewards.length > 0 ? rewards[0].krAchievementPercent : 0;
    let krAchievementPoints = rewards.length > 0 ? rewards[0].krAchievementPoints : 0;

    let result = objectives.map((singleObjective) => {
      let newObj = { ...singleObjective.objective };

      // Find employee by ID (not by name)
      const employee = employees.find(emp => emp._id.toString() === newObj.employeeReferenceId?.toString());
      newObj.employeeNumber = employee ? employee.employmentInformation.employeeNumber : "";

      // Add ownerName based on owner ID
      const ownerEmployee = employees.find(emp => emp._id.toString() === newObj.owner?.toString());
      newObj.ownerName = ownerEmployee ?
        `${ownerEmployee.personalInformation.firstName} ${ownerEmployee.personalInformation.lastName || ''}`.trim() :
        newObj.owner || '';

      newObj.children = singleObjective.children
        .map((item) => {
          let percent = percentageCalculation(item);
          let rewardPoints = item.approvalRequired ? 0 : totalRewardPoints(percent, krAchievementPercent, krAchievementPoints, newObj);
          return {
            ...item,
            percent: (percent == "NaN" || percent == null) ? 0 : percent,
            owner: newObj.ownerName || singleObjective.objective.employeeName,
            profilePicture: employee?.personalInformation?.profilePicture || "https://www.clipartmax.com/png/middle/103-1038880_user-rubber-stamp-female-user-icon.png",
            rewardPoints,
            objective: singleObjective.objective.objective,
            objectiveId: item.objectiveId,
            children: tasks.filter(itemTask => itemTask._doc.krReferenceId == item._id).map(itemTask => ({
              ...itemTask._doc,
              profilePicture: employee?.personalInformation?.profilePicture || "https://www.clipartmax.com/png/middle/103-1038880_user-rubber-stamp-female-user-icon.png"
            }))
          };
        });

      newObj.profilePicture = employee?.personalInformation?.profilePicture || "https://www.clipartmax.com/png/middle/103-1038880_user-rubber-stamp-female-user-icon.png";

      newObj.progressStatus =
        newObj.children.length > 0
          ? Math.min(100, Math.round(totalSum(newObj.children, "percent") / newObj.children.length))
          : (newObj.progressStatus > 0 ? Math.min(100, newObj.progressStatus) : "0");

      let objectivesAchievementPercent = rewards.length > 0 ? rewards[0].objectivesAchievementPercent : 0;
      let objectivesAchievementPoints = rewards.length > 0 ? rewards[0].objectivesAchievementPoints : 0;
      let rewardPoints = newObj.approvalRequired ? 0 : totalRewardPoints(newObj.progressStatus, objectivesAchievementPercent, objectivesAchievementPoints, newObj);
      newObj.rewardPoints = rewardPoints;
      return newObj;
    });

    // Find user safely
    const currentUser = allEmployees.find(employee => employee._id.toString() === req.params.userId?.toString());
    const departmentHead = allEmployees.find(employee => employee.employmentInformation.departmentHead === "Yes");

    res.status(200).send(
      successResponse({
        message: "Objectives Retrieved Successfully!",
        data: result,
        privileges,
        lineManager: currentUser?.employmentInformation?.lineManager || "",
        companyHead: departmentHead?._id || ""
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

const getObjectivesDashboard = async (req, res) => {
  // #swagger.tags = ['Objectives']
  try {
    const isAdmin = req.params.role == "Super Admin" || req.params.role == "Manager" || req.params.role == "HR Admin";
    const employeeIds = [];
    let objj = {
      employeeReferenceId: req.params.userId,
      createdAt: {
        "$gte": new Date("2022-01-01"),
        "$lt": new Date()
      }
    };

    if (isAdmin) {
      employeeIds = await EmployeesModel.find({ companyId, "employmentInformation.status": "Active" }, {
        _id: 1
      });
      employeeIds = employeeIds.map(item => item._id.toString());
      objj.employeeReferenceId = { $in: req.body.employeeIds }
    }

    //TODO: objectives and keyresults aggregation.
    let objectives = await ObjectivesModel.find(objj, {
      weight: 1
    });

    res.status(200).send(
      successResponse({
        message: "Objectives Retrieved Successfully!",
        data: objectives,
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

const getObjectivesTabs = async (req, res) => {
  // #swagger.tags = ['Objectives']
  try {
    const tabType = req.params.tabType;
    const allEmployees = await EmployeesModel.find({ companyId: req.params.companyId, "employmentInformation.status": "Active" }).select("employmentInformation personalInformation").sort({ _id: -1 });
    const companyHead = allEmployees.filter(employee => employee.employmentInformation.lineManager === "").length > 0 ? allEmployees.filter(employee => employee.employmentInformation.lineManager === "")[0]._id.toString() : "";

    let objj = {};
    objj.createdAt = {
      "$gte": new Date("2022-01-01"),
      "$lt": new Date()
    }

    // For non-admin users, show objectives they have access to
    if (!(req.params.role == "Super Admin" || req.params.role == "Manager" || req.params.role == "HR Admin")) {
      // Get objectives where user is the employeeReferenceId OR the owner
      objj.$or = [
        { employeeReferenceId: req.params.userId },
        { owner: req.params.userId }
      ];
    }
    if (tabType === "Team") {
      objj.cascadedById = { $not: { $eq: companyHead } };
    } else if (tabType === "Company") {
      objj.cascadedById = companyHead;
    }
    let AllObjectives = await ObjectivesModel.find({}).sort({ _id: -1 });
    let objectives = await ObjectivesModel.find(objj).sort({ _id: -1 });
    //filter all cascaded objectives
    let filterCascadedObjs = objectives.filter(item => item._doc.cascadedObjectiveId).map(item => item.cascadedObjectiveId.toString());
    //filter all cascaded objectives ids.
    let filterCascadedIds = AllObjectives.filter(item => item._doc.cascadedObjectiveId).map(item => item._id.toString())

    if ((tabType === "Team" || tabType === "Company") && filterCascadedObjs && filterCascadedObjs.length > 0) {
      //team
      objectives = await ObjectivesModel.find({ _id: { $in: filterCascadedObjs } }).sort({ _id: -1 });
    }
    const objectiveIds = objectives.map(item => item._doc._id);
    let employeeIds = objectives.map(item => item._doc.employeeReferenceId);
    // Also include owner IDs for better employee data access
    let ownerIds = objectives.map(item => item._doc.owner).filter(owner => owner);
    let allEmployeeIds = [...new Set([...employeeIds, ...ownerIds])]; // Remove duplicates

    const keyResults = await KeyResultsModel.find({ objectiveId: { $in: objectiveIds } }).sort({ _id: -1 });
    const keyResultsFilter = await KeyResultsModel.find({ objectiveId: { $in: filterCascadedIds } }).sort({ _id: -1 });

    //TODO: Test all employees filter before pushing.
    const employees = allEmployees.filter(employee => allEmployeeIds.includes(employee._id.toString()));
    //TODO: Test all employees filter before pushing.

    //TODO: combining Employees and Rewards


    const rewards = await RewardsModel.find({ companyId: req.params.companyId }).sort({ _id: -1 });
    const privileges = await PrivilegesModel.find({ role: req.params.role, companyId: req.params.companyId }).sort({ _id: -1 });
    const privilegesManager = await PrivilegesModel.find({ role: "Manager", companyId: req.params.companyId }).sort({ _id: -1 });
    const tasks = await TasksModel.find({}).sort({ _id: -1 });
    let krAchievementPercent = rewards.length > 0 ? rewards[0].krAchievementPercent : 0;
    let krAchievementPoints = rewards.length > 0 ? rewards[0].krAchievementPoints : 0;
    let result = getObjectivePercentage(objectives, allEmployees, tasks, rewards, krAchievementPercent, krAchievementPoints, keyResults, AllObjectives, privilegesManager, keyResultsFilter);
    res.status(200).send(
      successResponse({
        message: "Objectives Retrieved Successfully!",
        data: result,
        privileges,
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
//for testing purpose.
const getSimilarObjectives = async (req, res) => {
  // #swagger.tags = ['Objectives']
  try {
    const objectiveId = req.params.objectiveId;
    const allEmployees = await EmployeesModel.find({ companyId: req.params.companyId, "employmentInformation.status": "Active" }).select("employmentInformation personalInformation").sort({ _id: -1 });
    const lineManager = allEmployees.filter(employee => employee._id == req.params.userId).length > 0 ? allEmployees.filter(employee => employee._id == req.params.userId)[0].employmentInformation.lineManager : "";
    const companyHead = allEmployees.filter(employee => employee.employmentInformation.lineManager === "").length > 0 ? allEmployees.filter(employee => employee.employmentInformation.lineManager === "")[0]._id.toString() : "";
    let objj = { cascadedObjectiveId: objectiveId, };
    objj.createdAt = {
      "$gte": new Date("2022-01-01"),
      "$lt": new Date()
    }
    let objectives = await ObjectivesModel.find(objj).sort({ _id: -1 });
    const objectiveIds = objectives.map(item => item._doc._id);
    let employeeIds = objectives.map(item => item._doc.employeeReferenceId);
    const keyResults = await KeyResultsModel.find({ objectiveId: { $in: objectiveIds } }).sort({ _id: -1 });
    const employees = await EmployeesModel.find({ _id: { $in: employeeIds }, companyId: req.params.companyId, "employmentInformation.status": "Active" }).select("employmentInformation.employeeNumber personalInformation").sort({ _id: -1 });
    const rewards = await RewardsModel.find({ companyId: req.params.companyId }).sort({ _id: -1 });
    const privileges = await PrivilegesModel.find({ role: req.params.role, companyId: req.params.companyId }).sort({ _id: -1 });
    const tasks = await TasksModel.find({}).sort({ _id: -1 });
    let krAchievementPercent = rewards.length > 0 ? rewards[0].krAchievementPercent : 0;
    let krAchievementPoints = rewards.length > 0 ? rewards[0].krAchievementPoints : 0;
    let result = objectives.map((objective) => {
      let newObj = { ...objective._doc };
      newObj.employeeNumber = employees.find(employee => employee._id == newObj.employeeReferenceId) ?
        employees.find(employee => employee._id == newObj.employeeReferenceId).employmentInformation.employeeNumber : "";

      // Add ownerName based on owner ID
      const ownerEmployee = employees.find(employee => employee._id == newObj.owner);
      newObj.ownerName = ownerEmployee ?
        `${ownerEmployee.personalInformation.firstName} ${ownerEmployee.personalInformation.lastName || ''}`.trim() :
        newObj.owner || '';

      newObj.children = keyResults
        .filter((item) => item.objectiveId == objective._id.toString())
        .map((item) => {
          let percent = percentageCalculation(item);
          let rewardPoints = item.approvalRequired ? 0 : totalRewardPoints(percent, krAchievementPercent, krAchievementPoints, newObj);
          return {
            ...item._doc,
            percent: (percent == "NaN" || percent == null) ? 0 : percent,
            owner: objective._doc.employeeName,
            profilePicture: employees.find(employee => employee.personalInformation.firstName == objective._doc.employeeName.split(" ")[0]) ?
              employees.find(employee => employee.personalInformation.firstName == objective._doc.employeeName.split(" ")[0]).personalInformation.profilePicture : "https://www.clipartmax.com/png/middle/103-1038880_user-rubber-stamp-female-user-icon.png",
            rewardPoints,
            objective: objective._doc.objective,
            objectiveId: item.objectiveId,
            children: tasks.filter(itemTask => itemTask._doc.krReferenceId == item._doc._id).map(itemTask => ({
              ...itemTask._doc,
              profilePicture: employees.find(employee => employee.personalInformation.firstName == objective._doc.employeeName.split(" ")[0]) ?
                employees.find(employee => employee.personalInformation.firstName == objective._doc.employeeName.split(" ")[0]).personalInformation.profilePicture : "https://www.clipartmax.com/png/middle/103-1038880_user-rubber-stamp-female-user-icon.png"
            }))
          };
        });
      newObj.profilePicture = employees.find(employee => employee.personalInformation.firstName == newObj.owner.split(" ")[0]) ?
        employees.find(employee => employee.personalInformation.firstName == newObj.owner.split(" ")[0]).personalInformation.profilePicture : "https://www.clipartmax.com/png/middle/103-1038880_user-rubber-stamp-female-user-icon.png";
      newObj.progressStatus =
        newObj.children.length > 0
          ? Math.min(100, Math.round(totalSum(newObj.children, "percent") / newObj.children.length))
          : (newObj.progressStatus > 0 ? Math.min(100, newObj.progressStatus) : "0");

      let objectivesAchievementPercent = rewards.length > 0 ? rewards[0].objectivesAchievementPercent : 0;
      let objectivesAchievementPoints = rewards.length > 0 ? rewards[0].objectivesAchievementPoints : 0;
      let rewardPoints = newObj.approvalRequired ? 0 : totalRewardPoints(newObj.progressStatus, objectivesAchievementPercent, objectivesAchievementPoints, newObj);
      newObj.rewardPoints = rewardPoints;
      return newObj;
    });
    res.status(200).send(
      successResponse({
        message: "Objectives Retrieved Successfully!",
        data: result,
        privileges,
        lineManager,
        companyHead
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

const getObjectivesRewardPoints = async (req, res) => {
  // #swagger.tags = ['Objectives']
  try {
    const objectiveIds = []
    let objectives = []
    const keyResults = await KeyResultsModel.find({}).sort({ _id: -1 });
    const myTeam = req.params.tab === "myteam" && await EmployeesModel.find({ "employmentInformation.lineManager": req.params.id, "employmentInformation.status": "Active" });
    let myTeamIds = myTeam.length > 0 ? myTeam.map(item => item._id.toString()) : [];
    let obj = { companyId: req.params.companyId };
    if (myTeamIds.length > 0) {
      obj.mainTask = { $eq: "" };
      obj.assignTo = { $in: myTeamIds }
    } else {
      obj.mainTask = { $eq: "" };
      obj.assignTo = { $in: [req.params.id] }
    }
    const tasks = await Tasks2Model.find(obj).sort({ _id: -1 });
    //previous week and this week logic.
    let daysGap = 7;
    let previousWeekTasks = tasks.filter(item => moment(item._doc.createdAt).format("YYYY-MM-DD") <= moment(new Date()).subtract(daysGap, 'd').format("YYYY-MM-DD") && moment(item._doc.createdAt).format("YYYY-MM-DD") > moment(new Date()).subtract(daysGap * 2, 'd').format("YYYY-MM-DD"));
    let thisWeekTasks = tasks.filter(item => moment(item._doc.createdAt).format("YYYY-MM-DD") <= moment(new Date()).format("YYYY-MM-DD") && moment(item._doc.createdAt).format("YYYY-MM-DD") > moment(new Date()).subtract(daysGap, 'd').format("YYYY-MM-DD"));
    let percentageTask = ((thisWeekTasks.length - previousWeekTasks.length) / thisWeekTasks.length) * 100;
    //achieved.
    let previousWeekTasksAchieved = tasks.filter(item => moment(item._doc.updatedAt).format("YYYY-MM-DD") <= moment(new Date()).subtract(daysGap, 'd').format("YYYY-MM-DD") && moment(item._doc.updatedAt).format("YYYY-MM-DD") > moment(new Date()).subtract(daysGap * 2, 'd').format("YYYY-MM-DD"));
    let thisWeekTasksAchieved = tasks.filter(item => moment(item._doc.updatedAt).format("YYYY-MM-DD") <= moment(new Date()).format("YYYY-MM-DD") && moment(item._doc.updatedAt).format("YYYY-MM-DD") > moment(new Date()).subtract(daysGap, 'd').format("YYYY-MM-DD"));
    let percentageTaskAchieved = ((thisWeekTasksAchieved.length - previousWeekTasksAchieved.length) / thisWeekTasksAchieved.length) * 100;

    const alltasks = await Tasks2Model.find({ companyId: req.params.companyId, mainTask: { $ne: "" } }).sort({ _id: -1 });
    const employees = await EmployeesModel.find({ companyId: req.params.companyId, "employmentInformation.status": "Active" }).sort({ _id: -1 });
    const redemptionPoints = await RedemptionsModel.find({ userId: req.params.id, status: "approved" }).sort({ _id: -1 });
    let totalPoints = totalSum(redemptionPoints, "rewardPoints");
    if (req.params.tab === 'myteam' && req.params.role !== 'Super Admin') {
      const finalData = employees.filter((item) => {
        if (item.employmentInformation.lineManager !== undefined) {
          if (req.params.id === item.employmentInformation.lineManager) {
            objectiveIds.push(item._id)
            return true;
          }
        }
      });
      objectives = await ObjectivesModel.find({ employeeReferenceId: { $in: objectiveIds } }).sort({ _id: -1 });
    }
    else {
      objectives = req.params.tab === "myteam" && req.params.role == 'Super Admin' ? await ObjectivesModel.find({}).sort({ _id: -1 }) : await ObjectivesModel.find({ employeeReferenceId: req.params.id }).sort({ _id: -1 });
    }
    const rewards = await RewardsModel.find({ companyId: req.params.companyId }).sort({ _id: -1 });
    let krAchievementPercent = rewards.length > 0 ? rewards[0].krAchievementPercent : 0;
    let krAchievementPoints = rewards.length > 0 ? rewards[0].krAchievementPoints : 0;
    let taskAchievementPercent = rewards.length > 0 ? rewards[0].taskAchievementPercent : 0;
    let taskAchievementPoints = rewards.length > 0 ? rewards[0].taskAchievementPoints : 0;
    let subTaskAchievementPercent = rewards.length > 0 ? rewards[0].subTaskAchievementPercent : 0;
    let subTaskAchievementPoints = rewards.length > 0 ? rewards[0].subTaskAchievementPoints : 0;
    let rewardPoints = rewards.length > 0 ? rewards[0].rewardPoints : 0;
    let rewardPoints2 = rewards.length > 0 ? rewards[0].rewardPoints2 : 0;
    let rewardPoints3 = rewards.length > 0 ? rewards[0].rewardPoints3 : 0;

    let tasksResult = tasks.map((task) => {
      let newObj = { taskPoints: 0, subTaskPoints: 0 };
      let taskrewardPoints = totalRewardPointsTask(task.progressStatus, taskAchievementPercent, taskAchievementPoints);
      let subTasks = alltasks.filter(item => item.mainTask === task._id.toString());
      let subTaskPoints = subTasks.length > 0 ? subTasks.reduce((prev, current) => {
        return prev + totalRewardPointsTask(current.progressStatus, subTaskAchievementPercent, subTaskAchievementPoints);
      }, 0) : 0;
      newObj.taskPoints = taskrewardPoints;
      newObj.subTaskPoints = subTaskPoints;
      newObj.achievedDate = task._doc.updatedAt;
      newObj.points = taskrewardPoints + subTaskPoints;
      return newObj;
    });

    //reward points percentage
    let previousWeekPointsAchieved = tasksResult.length > 0 ? tasksResult.filter(item => moment(item.achievedDate).format("YYYY-MM-DD") <= moment(new Date()).subtract(daysGap, 'd').format("YYYY-MM-DD") && moment(item.achievedDate).format("YYYY-MM-DD") > moment(new Date()).subtract(daysGap * 2, 'd').format("YYYY-MM-DD")) : 0
    previousWeekPointsAchieved = totalSum(previousWeekPointsAchieved, "points");
    let thisWeekPointsAchieved = tasksResult.length > 0 ? tasksResult.filter(item => moment(item.achievedDate).format("YYYY-MM-DD") <= moment(new Date()).format("YYYY-MM-DD") && moment(item.achievedDate).format("YYYY-MM-DD") > moment(new Date()).subtract(daysGap, 'd').format("YYYY-MM-DD")) : 0;
    thisWeekPointsAchieved = totalSum(thisWeekPointsAchieved, "points");
    let percentagePointsAchieved = ((thisWeekPointsAchieved - previousWeekPointsAchieved) / thisWeekPointsAchieved) * 100;

    let result = objectives.map((objective) => {
      let newObj = { _id: objective._doc._id, objective: objective._doc.objective, employeeReferenceId: objective._doc.employeeReferenceId, weight: objective._doc.weight, approvalRequired: objective._doc.approvalRequired };
      newObj.employeeNumber = employees.filter(employee => employee._id == newObj.employeeReferenceId).length > 0 ?
        employees.filter(employee => employee._id == newObj.employeeReferenceId)[0].employmentInformation.employeeNumber : "";

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

      let objectivesAchievementPercent = rewards.length > 0 ? rewards[0].objectivesAchievementPercent : 0;
      let objectivesAchievementPoints = rewards.length > 0 ? rewards[0].objectivesAchievementPoints : 0;
      let objectivePoints = newObj.approvalRequired ? 0 : totalRewardPoints(newObj.progressStatus, objectivesAchievementPercent, objectivesAchievementPoints, newObj);
      newObj.objectivePoints = objectivePoints;
      return newObj;
    });
    let totalObjectivesPoints = totalSum(result, "objectivePoints");
    let totalKeyResultsPoints = totalSum(result, "keyResultsPoints");
    let totalTaskPoints = totalSum(tasksResult, "taskPoints");
    let totalSubTaskPoints = totalSum(tasksResult, "subTaskPoints");
    let earnedPoints = parseFloat(Number(!isNaN(totalObjectivesPoints) ? totalObjectivesPoints : 0) + Number(!isNaN(totalKeyResultsPoints) ? totalKeyResultsPoints : 0) + Number(totalTaskPoints) + Number(totalSubTaskPoints)).toFixed(2)
    let redeemPoints = totalPoints;
    res.status(200).send(
      successResponse({
        message: "Objectives Reward Points Retrieved Successfully!",
        data: {
          totalObjectivesPoints: Number(!isNaN(totalObjectivesPoints) ? totalObjectivesPoints : 0).toFixed(2), totalKeyResultsPoints: Number(!isNaN(totalKeyResultsPoints) ? totalKeyResultsPoints : 0).toFixed(2), totalTaskPoints: Number(totalTaskPoints).toFixed(2), totalSubTaskPoints: Number(totalSubTaskPoints).toFixed(2), earnedPoints, redeemPoints, remainingPoints: earnedPoints > redeemPoints ? earnedPoints - redeemPoints : earnedPoints, rewardPoints, rewardPoints2, rewardPoints3,
          percentageTask,
          percentageTaskAchieved,
          percentagePointsAchieved
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


module.exports = {
  cascadeObjectiveWithKeyResults,
  createObjective,
  cascadeObjective,
  getObjectivesRewardPoints,
  getSimilarObjectives,
  getObjectivesTabs,
  getObjectivesAndOKRTab,
  getObjectivesDashboard,
  getObjectives,
};
