const KeyResults = require("../models/keyResults.model");
const Objectives = require("../models/objectives.model");
const TasksModel = require("../models/tasks2.model");
const PrivilegesModel = require("../models/privileges.model");
const RewardsManagementModel = require("../models/rewardManagement.model");
const AuditTrailModel = require("../models/AuditTrail");
const RewardPointsModel = require("../models/rewardpoints.model");
const getRandom = require('../middlewares/randomNumber');
const EmployModel = require("../models/employee.model");
const objectivesModel = require("../models/objectives.model");


const moment = require("moment");
const mongoose = require("mongoose");
const { totalRewardPoints, isValidDate } = require("../helpers/percentageCalculation");

/**
 * Sum of KR weights for this user in this company.
 * When scopeObjectiveId is set, only KRs under objectives in the same OKR cycle
 * (same companyId + okrYear + employee as that objective) are counted — aligned with the dashboard.
 */
const sumKrWeightsForUserCompany = async (userId, companyId, excludeKrId = null, scopeObjectiveId = null) => {
  if (!userId || !companyId) return 0;

  let objectiveIds = null;
  if (scopeObjectiveId) {
    const anchor = await Objectives.findById(scopeObjectiveId).lean();
    if (anchor) {
      const comp = String(anchor.companyId || companyId || "")
        .replace(/^"|"$/g, "")
        .trim();
      const related = await Objectives.find({
        companyId: comp,
        okrYear: anchor.okrYear,
        $or: [{ employeeReferenceId: anchor.employeeReferenceId }, { owner: anchor.owner }],
      })
        .select("_id")
        .lean();
      objectiveIds = related.map((o) => o._id.toString());
      if (objectiveIds.length === 0) {
        objectiveIds = [String(anchor._id)];
      }
    }
  }

  const q = {
    userId: String(userId),
    companyId: String(companyId),
  };

  if (excludeKrId) {
    if (mongoose.Types.ObjectId.isValid(String(excludeKrId))) {
      q._id = { $ne: new mongoose.Types.ObjectId(String(excludeKrId)) };
    } else {
      q._id = { $ne: excludeKrId };
    }
  }

  if (objectiveIds && objectiveIds.length > 0) {
    q.objectiveId = { $in: objectiveIds };
  }

  const krs = await KeyResults.find(q).lean();
  return krs.reduce((sum, kr) => sum + (Number(kr.weight) || 0), 0);
};

// Recalculate objective weight as sum of all its KR weights and update
const recalculateObjectiveWeight = async (objectiveId) => {
  try {
    const objIdStr = objectiveId.toString();
    const krs = await KeyResults.find({ objectiveId: objIdStr }).lean();
    const totalKrWeight = krs.reduce((sum, kr) => sum + (Number(kr.weight) || 0), 0);
    const updated = await Objectives.findByIdAndUpdate(
      objIdStr,
      { weight: totalKrWeight },
      { new: true }
    );
    if (!updated) {
      console.error("recalculateObjectiveWeight: objective not found for id", objIdStr);
    }
  } catch (err) {
    console.error("Error recalculating objective weight:", err);
  }
};

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

const createkeyResult = async (req, res) => {
  // #swagger.tags = ['Key Results']
  try {
    const rewards = await RewardsManagementModel.find({}).sort({ _id: -1 });
    let requestBody = {
      comments: req.body.comments ? req.body.comments : "",
      okrName: req.body.okrName,
      dimension: req.body.dimension ? req.body.dimension : "",
      isAlignedToCompany: req.body.isAlignedToCompany,
      keyResultName: req.body.keyResultName,
      frequency: req.body.frequency,
      uom: req.body.uom,
      polarity: req.body.polarity ? req.body.polarity : "Positive",
      msc: req.body.msc ? req.body.msc : "",
      targetDate: isValidDate(req.body.targetDate) ? req.body.targetDate : null,
      actualDate: isValidDate(req.body.actualDate) ? req.body.actualDate : null,
      target: req.body.target,
      actual: req.body.actual,
      basevalue: req.body.basevalue,
      feedAttachment: req.body.feedAttachment,
      objectiveId: req.body.objectiveId,
      krID: "KR_" + getRandom(7),
      userId: req.body.userId,
      approvalRequired: rewards.length > 0 ? rewards[0].approvalRequired : false,
      source: req.body.source || "",
      kpiId: req.body.kpiId || "",
      query: req.body.query || "",
      kpiName: req.body.kpiName || "",
      status: req.body.status || "",
      unit: req.body.unit || "",
      jiraKey: req.body.jiraKey || "",
      jiraStatus: req.body.jiraStatus || "",
      companyId: req.body.companyId || req.user?.companyId || "",
      weight: Number(req.body.weight) || 0
    };
    // Validate total KR weights for this user in this OKR cycle (cap 100%)
    if (requestBody.weight > 0) {
      const existingTotalWeight = await sumKrWeightsForUserCompany(
        requestBody.userId,
        requestBody.companyId,
        null,
        requestBody.objectiveId
      );
      if (existingTotalWeight + requestBody.weight > 100) {
        return res.status(400).send(
          failResponse({
            message: `Total KR weight across all objectives would exceed 100%. Current total: ${existingTotalWeight}%, adding: ${requestBody.weight}%. Remaining allowed: ${100 - existingTotalWeight}%.`
          })
        );
      }
    }

    const newKeyResult = new KeyResults(requestBody);
    const objectivesData = await Objectives.find({}).sort({ _id: -1 });
    let krAchievementPercent = rewards.length > 0 ? rewards[0].krAchievementPercent : 0;
    let krAchievementPoints = rewards.length > 0 ? rewards[0].krAchievementPoints : 0;
    let targetProgress = requestBody.target;
    let actualProgress = requestBody.actual;
    let percent = requestBody.polarity === "Positive" ? (targetProgress > 0 ? Math.min(100, Number((actualProgress / targetProgress) * 100).toFixed(2)) : 0) : (actualProgress > 0 ? Math.min(100, Number((targetProgress / actualProgress) * 100).toFixed(2)) : 0);
    let objectivesDataFiltered = objectivesData.filter(items => items._id == requestBody.objectiveId);
    let rewardPoints = totalRewardPoints(percent, krAchievementPercent, krAchievementPoints, objectivesDataFiltered.length > 0 ? objectivesDataFiltered[0] : { weight: 0 });
    await newKeyResult.save().then(async (result, err) => {
      if (!err) {
        let auditId = req.auditId.toString();
        await AuditTrailModel.findByIdAndUpdate(auditId, { recordId: result._doc._id }, async (err, doc) => {
          if (!err) {
            if (rewardPoints > 0 && requestBody.approvalRequired) {
              let rewardRequestBody = {
                referenceID: result._doc._id,
                employeeReferenceId: objectivesDataFiltered[0].employeeReferenceId,
                type: "Key Result",
                rewardPoints: rewardPoints,
              }
              const newRewardPoints = new RewardPointsModel(rewardRequestBody);
              await newRewardPoints.save().then(async (result2, err2) => {
                if (!err2) {
                  await recalculateObjectiveWeight(requestBody.objectiveId);
                  res.status(200).send(
                    successResponse({
                      message: "KeyResult Created Successfully!",
                      data: {
                        ...result._doc,
                        status: result._doc.status || "",
                        unit: result._doc.unit || "",
                        rewardPoints,
                        approvalRequired: rewards.length > 0 ? rewards[0].approvalRequired : false
                      }
                    })
                  );
                } else {
                  res.status(500).send(
                    failResponse({
                      message: "KeyResult Not Created!",
                    })
                  );
                }
              });
            } else {
              await recalculateObjectiveWeight(requestBody.objectiveId);
              res.status(200).send(
                successResponse({
                  message: "KeyResult Created Successfully!",
                  data: {
                    ...result._doc,
                    status: result._doc.status || "",
                    unit: result._doc.unit || "",
                    rewardPoints,
                    approvalRequired: rewards.length > 0 ? rewards[0].approvalRequired : false
                  }
                })
              );
            }
          } else {
            res.status(500).send(
              failResponse({
                message: "KeyResult Not Created!",
              })
            );
          }
        });
      } else {
        res.status(500).send(
          failResponse({
            message: "KeyResult Not Created!",
          })
        );
      }
    })
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "KeyResult Not Created!",
      })
    );
  }
};
const predictData = async (req, res) => {
  // #swagger.tags = ['Key Results']
  try {
    const { createdAt, updatedAt, targetDate, progress } = req.body;

    const startDate = new Date(createdAt);
    const endDate = new Date(updatedAt);
    const daysElapsed = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)); // calculate the number of days elapsed since createdAt

    const remainingDays = Math.ceil((new Date(targetDate) - endDate) / (1000 * 60 * 60 * 24)); // calculate the number of days remaining until targetDate

    const averageDailyProgress = daysElapsed > 0 ? progress / daysElapsed : 0; // calculate the average daily progress

    const expectedProgress = progress + averageDailyProgress * remainingDays; // estimate the expected progress towards the target by the targetDate

    const expectedPercentage = expectedProgress >= 100 ? 100 : expectedProgress.toFixed(2); // calculate the expected percentage, limiting it to 100% if the expected progress exceeds 100%

    res.status(200).send(
      successResponse({
        message: "Prediction Found!",
        data: {
          probability: expectedPercentage + "%"
        }
      })
    );
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Prediction Not Found!",
      })
    );
  }
};
const getKeyResultSingle = async (req, res) => {
  // #swagger.tags = ['Key Results']
  try {
    const objectivesData = await Objectives.find({}).sort({ _id: -1 });
    const keyResults = await KeyResults.find({ _id: req.params.id }).sort({ _id: -1 });
    // const keyResults = await KeyResults.find({}).sort({ _id: -1 });
    const tasks = await TasksModel.find({}).sort({ _id: -1 });
    const privileges = await PrivilegesModel.find({ role: req.params.role }).sort({ _id: -1 });
    let finalKeyResults = keyResults.map(item => {
      let targetProgress = item._doc.target;
      let actualProgress = item._doc.actual;
      let percent = item._doc.polarity === "Positive" ? (targetProgress > 0 ? Math.min(100, Number((actualProgress / targetProgress) * 100).toFixed(2)) : 0) : (actualProgress > 0 ? Math.min(100, Number((targetProgress / actualProgress) * 100).toFixed(2)) : 0);
      let objectivesDataFiltered = objectivesData.filter(items => items._doc._id == item._doc.objectiveId);
      let weight = 0;
      let children = tasks.filter(task => task._doc.krReferenceId == item._doc._id).map(task => {
        return { ...task._doc, objectiveStatus: objectivesDataFiltered.length > 0 ? objectivesDataFiltered[0].objectiveStatus : "Unlock", owner: objectivesDataFiltered.length > 0 ? objectivesDataFiltered[0].owner : "" }
      })
      let objectiveStatus = "Unlock";
      let employeeReferenceId = "";
      let employeeName = "";
      let objective = "";
      let objectiveIsApproved = "";
      if (objectivesDataFiltered.length > 0) {
        weight = objectivesDataFiltered[0].weight;
        objectiveStatus = objectivesDataFiltered[0].objectiveStatus;
        employeeReferenceId = objectivesDataFiltered[0].employeeReferenceId;
        employeeName = objectivesDataFiltered[0].employeeName;
        objective = objectivesDataFiltered[0].objective;
        objectiveIsApproved = objectivesDataFiltered[0].isApproved || "";
      }
      return { ...item._doc, objectiveStatus, employeeReferenceId, employeeName, objective, objectiveIsApproved, progress: percent === "NaN" ? 0 : percent, objectiveWeight: weight, children, privileges: privileges[0].privileges }
    })
    res.status(200).send(
      successResponse({
        message: "KeyResults Retrieved Successfully!",
        data: finalKeyResults,
      })
    );
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "KeyResults Not Fetched!",
      })
    );
  }
};

const getKeyResults = async (req, res) => {
  // #swagger.tags = ['Key Results']
  try {
    const { companyId, id } = req.params;
    const { type = 'me', page = 0, limit = 100, search = '' } = req.query;
    const normalizedType = (type || 'me').toString().trim().toLowerCase();

    // Convert page and limit to numbers
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = pageNum * limitNum;
    let employeeFilter = {};

    if (normalizedType === 'me') {
      employeeFilter.employeeReferenceId = id;
    } else if (normalizedType === 'team' || normalizedType === 'myteam') {
      const teamMembers = await EmployModel.find({
        companyId,
        "employmentInformation.lineManager": id
      }).select('_id');
      const teamMemberIds = teamMembers.map(member => member._id.toString());
      teamMemberIds.push(id); // Include the manager's own KRs
      employeeFilter.employeeReferenceId = { $in: teamMemberIds };
    } else if (normalizedType === 'function' || normalizedType === 'myfunction') {
      const currentUser = await EmployModel.findById(id).select('employmentInformation.department');
      if (currentUser && currentUser.employmentInformation && currentUser.employmentInformation.department) {
        const functionMembers = await EmployModel.find({
          companyId,
          "employmentInformation.department": currentUser.employmentInformation.department,
          "employmentInformation.status": "Active"
        }).select('_id');
        const functionMemberIds = functionMembers.map(member => member._id.toString());
        employeeFilter.employeeReferenceId = { $in: functionMemberIds };
      } else {
        employeeFilter.employeeReferenceId = id;
      }
    } else if (normalizedType === 'company' || normalizedType === 'mycompany') {
      // Company-wide filter handled by companyId; no employeeReferenceId restriction
    } else {
      employeeFilter.employeeReferenceId = id;
    }


    let searchFilter = {};
    if (search && search.trim() !== '') {
      searchFilter = {
        $or: [
          { 'objectiveName': { $regex: search, $options: 'i' } },
        ]
      };
    }

    // Combine filters
    const objectiveFilter = { ...employeeFilter, ...searchFilter };

    // Get objectives with pagination
    const objectivesData = await Objectives.find(objectiveFilter)
      .select('_id employeeReferenceId weight owner objectiveStatus companyId objectiveName')
      .sort({ _id: -1 })
      .lean()
      .exec();

    if (objectivesData.length === 0) {
      return res.status(200).send(
        successResponse({
          message: "No objectives found for the specified criteria!",
          data: [],
          pagination: {
            page: pageNum,
            limit: limitNum,
            total: 0,
            totalPages: 0
          }
        })
      );
    }

    const objectiveIds = objectivesData.map(item => item._id);

    // Get key results for these objectives with search filter
    let krSearchFilter = {};
    if (search && search.trim() !== '') {
      krSearchFilter = {
        $or: [
          { 'keyResultName': { $regex: search, $options: 'i' } },
          { 'okrName': { $regex: search, $options: 'i' } },
          // Add other searchable fields as needed
        ]
      };
    }

    const keyResultsFilter = {
      objectiveId: { $in: objectiveIds },
      ...krSearchFilter
    };

    // Get total count for pagination
    const totalKeyResults = await KeyResults.countDocuments(keyResultsFilter);

    // Get paginated key results
    const keyResults = await KeyResults.find(keyResultsFilter)
      .sort({ _id: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean()
      .exec();

    const krIds = keyResults.map(item => item._id);

    // Get tasks for these key results
    const tasks = await TasksModel.find({ krReferenceId: { $in: krIds } })
      .sort({ _id: -1 })
      .lean()
      .exec();

    // Get rewards configuration
    const rewards = await RewardsManagementModel.findOne(
      { companyId, krAchievementPercent: { $ne: null } },
      { krAchievementPercent: 1, krAchievementPoints: 1 }
    );

    let krAchievementPercent = !!rewards ? rewards.krAchievementPercent : 0;
    let krAchievementPoints = !!rewards ? rewards.krAchievementPoints : 0;

    // Process key results
    let finalKeyResults = keyResults.map(item => {
      let targetProgress = item.target;
      let actualProgress = item.actual || 0;

      let percent = 0;
      if (item.polarity === "Positive") {
        percent = targetProgress > 0 ? Math.min(100, Number((actualProgress / targetProgress) * 100).toFixed(2)) : 0;
      } else {
        percent = actualProgress > 0 ? Math.min(100, Number((targetProgress / actualProgress) * 100).toFixed(2)) : 0;
      }

      // Find corresponding objective data
      let objectivesDataFiltered = objectivesData.find(objItem => objItem._id.toString() === item.objectiveId.toString());

      let weight = 0;
      let objectiveStatus = "Unlock";
      let owner = "";

      if (objectivesDataFiltered) {
        weight = objectivesDataFiltered.weight || 0;
        objectiveStatus = objectivesDataFiltered.objectiveStatus || "Unlock";
        owner = objectivesDataFiltered.owner || "";
      }

      // Calculate reward points
      let rewardPoints = item.approvalRequired ? 0 : totalRewardPoints(
        percent,
        krAchievementPercent,
        krAchievementPoints,
        { weight: weight }
      );

      // Get related tasks
      let children = tasks.filter(task => task.krReferenceId.toString() === item._id.toString()).map(task => {
        return {
          ...task,
          objectiveStatus,
          owner
        };
      });

      return {
        ...item,
        objectiveStatus,
        progress: isNaN(percent) ? 0 : percent,
        objectiveWeight: weight,
        // item.weight (the KR's own weight) is preserved via the spread above
        children,
        rewardPoints,
        employeeReferenceId: objectivesDataFiltered ? objectivesDataFiltered.employeeReferenceId : null
      };
    });

    // Filter out any null results
    const finalResult = finalKeyResults.filter(item => item !== null);

    // Calculate pagination info
    const totalPages = Math.ceil(totalKeyResults / limitNum);

    res.status(200).send(
      successResponse({
        message: "Key Results Retrieved Successfully!",
        data: finalResult,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: totalKeyResults,
          totalPages: totalPages,
          hasNextPage: pageNum < totalPages - 1,
          hasPrevPage: pageNum > 0
        }
      })
    );

  } catch (err) {
    console.error('Error in getKeyResults:', err);
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Key Results Not Fetched!",
      })
    );
  }
};

const getKeyResultsAll = async (req, res) => {
  // #swagger.tags = ['Key Results']
  try {
    //TODO: need to check for companyId.
    const { companyId } = req.params;
    const objectivesData = await Objectives.find({})
      .select('_id employeeReferenceId weight owner objectiveStatus companyId')
      .sort({ _id: -1 })
      .lean()
      .exec();
    const objectiveIds = objectivesData.map(item => item._id);

    const keyResults = await KeyResults.find({ objectiveId: { $in: objectiveIds } }).sort({ _id: -1 });
    const krIds = keyResults.map(item => item._id);
    const tasks = await TasksModel.find({ krReferenceId: { $in: krIds } }).sort({ _id: -1 });
    const rewards = await RewardsManagementModel.findOne({ companyId, krAchievementPercent: { $ne: null } }, {
      krAchievementPercent: 1,
      krAchievementPoints: 1
    })
    let krAchievementPercent = !!rewards ? rewards.krAchievementPercent : 0;
    let krAchievementPoints = !!rewards ? rewards.krAchievementPoints : 0;
    let finalKeyResults = keyResults.map(item => {
      let targetProgress = item._doc.target;
      let actualProgress = item._doc.actual;
      let percent = item._doc.polarity === "Positive" ? (targetProgress > 0 ? Math.min(100, Number((actualProgress / targetProgress) * 100).toFixed(2)) : 0) : (actualProgress > 0 ? Math.min(100, Number((targetProgress / actualProgress) * 100).toFixed(2)) : 0);
      let objectivesDataFiltered = objectivesData.find(items => items._id == item._doc.objectiveId);
      let weight = 0;
      let rewardPoints = item._doc.approvalRequired ? 0 : totalRewardPoints(percent, krAchievementPercent, krAchievementPoints, !!objectivesDataFiltered ? { weight: objectivesDataFiltered } : { weight: 0 });
      let children = tasks.filter(task => task._doc.krReferenceId == item._doc._id).map(task => {
        return {
          ...task._doc, objectiveStatus: !!objectivesDataFiltered ? objectivesDataFiltered.objectiveStatus : "Unlock", owner: !!objectivesDataFiltered ? objectivesDataFiltered.owner : ""
        }
      })
      let objectiveStatus = "Unlock";
      if (!!objectivesDataFiltered) {
        weight = objectivesDataFiltered.weight;
        objectiveStatus = objectivesDataFiltered.objectiveStatus;
      }
      return { ...item._doc, objectiveStatus, progress: percent === "NaN" ? 0 : percent, objectiveWeight: weight, children, rewardPoints }
    });
    const finalResult = finalKeyResults.filter(item => item !== null);
    res.status(200).send(
      successResponse({
        message: "KeyResults All Retrieved Successfully!",
        data: finalResult,
      })
    );
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "KeyResults Not Fetched!",
      })
    );
  }
};


const deletekeyResult = async (req, res) => {
  // #swagger.tags = ['Key Results']
  let auditId = req.auditId.toString();
  await AuditTrailModel.findByIdAndUpdate(auditId, { recordId: req.params.id }, (err, doc) => {
    if (!err) {
      KeyResults.findByIdAndRemove(req.params.id, (err) => {
        if (!err) {
          RewardPointsModel.findOneAndDelete({ referenceID: req.params.id }, (err) => {
            if (!err) {
              res.status(200).send(
                successResponse({
                  message: "Key Results Deleted Successfully!",
                })
              );
            } else {
              res.status(500).send(
                failResponse({
                  message: err ? err.message : "Key Results Not Deleted!",
                })
              );
            }
          });
        } else {
          res.status(500).send(
            failResponse({
              message: err ? err.message : "Key Results Not Deleted!",
            })
          );
        }
      });
    } else {
      res.status(500).send(
        failResponse({
          message: err ? err.message : "Key Results Not Deleted!",
        })
      );
    }
  });
};



const updatekeyResult = async (req, res) => {
  // #swagger.tags = ['Key Results']
  try {
    const keyResult = await KeyResults.findById(req.params.id);
    const rewards = await RewardsManagementModel.find({}).sort({ _id: -1 });
    if (keyResult) {

      let rewardPoints = 0;
      if (req.body.actual >= req.body.target) {
        const { objectiveId } = keyResult;

        const objective = await objectivesModel.findById(objectiveId);
        if (!objective) {
          return res.status(404).json({ message: "No Linked Objective found" });
        }

        const weight = Number(objective?.weight) || 0;

        rewardPoints = ((Number(req.body.dynamicRewardPoints) || 0) * weight) / 100;


      }



      let data = {
        comments: req.body.comments ? req.body.comments : "",
        okrName: req.body.okrName,
        dimension: req.body.dimension ? req.body.dimension : "",
        isAlignedToCompany: req.body.isAlignedToCompany,
        keyResultName: req.body.keyResultName,
        frequency: req.body.frequency,
        uom: req.body.uom,
        polarity: req.body.polarity,
        msc: req.body.msc ? req.body.msc : "",
        targetDate: isValidDate(req.body.targetDate) ? req.body.targetDate : null,
        actualDate: isValidDate(req.body.actualDate) ? req.body.actualDate : null,
        target: req.body.target,
        actual: req.body.actual,
        basevalue: req.body.basevalue,
        feedAttachment: req.body.feedAttachment,
        objectiveId: req.body.objectiveId,
        userId: req.body.userId,
        approvalRequired: rewards.length > 0 ? rewards[0].approvalRequired : false,
        source: req.body.source || "",
        kpiId: req.body.kpiId || "",
        query: req.body.query || "",
        kpiName: req.body.kpiName || "",
        status: req.body.status || "",
        unit: req.body.unit || "",
        jiraKey: req.body.jiraKey || "",
        jiraStatus: req.body.jiraStatus || "",
        companyId: req.body.companyId || req.user?.companyId || "",
        weight: Number(req.body.weight) || 0
      };

      // Handle isGifShown logic properly
      let isGifShownValue;
      if (req.body?.isGifShown === true && keyResult.isGifShown === false) {
        // This is the first time setting to true, set to true
        isGifShownValue = true;
      } else if (keyResult.isGifShown === true) {
        // Already true, keep it true
        isGifShownValue = true;
      } else {
        // Keep the existing value (false)
        isGifShownValue = keyResult.isGifShown;
      }

      // Add isGifShown to the data object
      data.isGifShown = isGifShownValue;

      // Validate total KR weights for this user in this OKR cycle (excluding this KR)
      if (data.weight > 0) {
        const otherKrsTotalWeight = await sumKrWeightsForUserCompany(
          data.userId,
          data.companyId,
          req.params.id,
          data.objectiveId || keyResult.objectiveId
        );
        if (otherKrsTotalWeight + data.weight > 100) {
          return res.status(400).send(
            failResponse({
              message: `Total KR weight across all objectives would exceed 100%. Other KRs total: ${otherKrsTotalWeight}%, this KR: ${data.weight}%. Remaining allowed: ${100 - otherKrsTotalWeight}%.`
            })
          );
        }
      }

      const objectivesData = await Objectives.find({}).sort({ _id: -1 });
      let objectivesDataFiltered = objectivesData.filter(items => items._id == data.objectiveId);



      let rewardApprovalRequired = req.body.approvalRequired || false;

      console.log("Backend update KR - isGifShown from frontend:", req.body?.isGifShown);
      console.log("Backend update KR - existing isGifShown:", keyResult.isGifShown);
      console.log("Backend update KR - setting isGifShown to:", isGifShownValue);

      KeyResults.findByIdAndUpdate(req.params.id, data, { new: true }, async (err, result) => {
        if (!err) {
          let auditId = req.auditId.toString();
          await AuditTrailModel.findByIdAndUpdate(auditId, { recordId: result._doc._id }, async (error, doc) => {
            if (!error) {
              // Recalculate objective weight as sum of all KR weights
              await recalculateObjectiveWeight(data.objectiveId || result._doc.objectiveId);

              // Handle approval flow for target/actual comparison
              const actualValue = req.body.actual || result._doc.actual || 0;
              const targetValue = req.body.target || result._doc.target || 0;
              const isTargetAchieved = actualValue >= targetValue;

              if (isTargetAchieved && rewardPoints > 0) {
                if (rewardApprovalRequired === false) {
                  // No approval required - add reward points and mark as approved
                  try {
                    const existingRewardPoints = await RewardPointsModel.findOne({
                      referenceID: result._doc._id,
                      type: "Key Result",
                      isApproved: "approved"
                    });

                    if (existingRewardPoints) {
                      const updatedRewardPoints = existingRewardPoints.rewardPoints + rewardPoints;
                      await RewardPointsModel.findByIdAndUpdate(existingRewardPoints._id, {
                        rewardPoints: updatedRewardPoints,
                        employeeReferenceId: objectivesDataFiltered.length > 0 ? objectivesDataFiltered[0].employeeReferenceId : result._doc.userId,
                        isApproved: "approved"
                      });
                    } else {
                      const newRewardPoints = new RewardPointsModel({
                        referenceID: result._doc._id,
                        employeeReferenceId: objectivesDataFiltered.length > 0 ? objectivesDataFiltered[0].employeeReferenceId : result._doc.userId,
                        type: "Key Result",
                        rewardPoints: rewardPoints,
                        isApproved: "approved"
                      });
                      await newRewardPoints.save();
                    }
                  } catch (rewardErr) {
                    console.error('Error adding reward points:', rewardErr);
                  }

                  await KeyResults.findByIdAndUpdate(req.params.id, {
                    isApproved: "approved"
                  });

                  res.status(200).send(
                    successResponse({
                      message: "KeyResults Updated Successfully!",
                      data: {
                        ...result._doc,
                        status: result._doc.status || "",
                        unit: result._doc.unit || "",
                        rewardPoints,
                        approvalRequired: rewards.length > 0 ? rewards[0].approvalRequired : false,
                        isGifShown: isGifShownValue
                      }
                    })
                  );
                } else {
                  // Approval required - store in pending object and don't add reward points
                  const pendingData = {
                    dynamicRewardPoints: rewardPoints,
                    approvalRequired: rewardApprovalRequired,
                    actualValue: actualValue,
                    targetValue: targetValue,
                    timestamp: new Date()
                  };
                  await KeyResults.findByIdAndUpdate(req.params.id, {
                    pending: pendingData,
                    isApproved: "pending"
                  });

                  res.status(200).send(
                    successResponse({
                      message: "KeyResults Updated Successfully! Reward points pending approval.",
                      data: {
                        ...result._doc,
                        status: result._doc.status || "",
                        unit: result._doc.unit || "",
                        rewardPoints,
                        approvalRequired: rewards.length > 0 ? rewards[0].approvalRequired : false,
                        isGifShown: isGifShownValue,
                        pendingApproval: true
                      }
                    })
                  );
                }
              } else {
                // For non-target-achieved status, just update without handling reward points
                res.status(200).send(
                  successResponse({
                    message: "KeyResults Updated Successfully!",
                    data: {
                      ...result._doc,
                      status: result._doc.status || "",
                      unit: result._doc.unit || "",
                      rewardPoints: 0,
                      approvalRequired: rewards.length > 0 ? rewards[0].approvalRequired : false,
                      isGifShown: isGifShownValue
                    }
                  })
                );
              }
            } else {
              res.status(500).send(
                failResponse({
                  message: error ? error.message : "KeyResults Not Updated!",
                })
              );
            }
          });
        } else {
          res.status(500).send(
            failResponse({
              message: err ? err.message : "KeyResults Not Updated!",
            })
          );
        }
      });
    }
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "KeyResults Not Updated!",
      })
    );
  }
};


const createOrUpdateMultipleKeyResults = async (req, res) => {
  // #swagger.tags = ['Key Results']
  try {
    const items = req.body.data;
    const rewards = await RewardsManagementModel.find({}).sort({ _id: -1 });
    var ops = [];
    items.forEach(item => {
      if (item._id) {
        ops.push(
          {
            updateOne: {
              filter: { _id: item._id },
              update: {
                $set: {
                  ...item,
                  approvalRequired: rewards.length > 0 ? rewards[0].approvalRequired : false
                },
              },
              upsert: true
            }
          }
        );
      }
    })
    await KeyResults.bulkWrite(ops, { ordered: false });
    res.status(200).send(
      successResponse({
        message: 'Progress Updated Successfully!',
      })
    );
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Progress Not Updated!"
      })
    );
  }
};



const getEmployeeKeyResults = async (req, res) => {
  try {
    const { userId, companyId } = req.params;
    const { type = 'me', page = 0, limit = 10, search = '' } = req.query;
    const normalizedType = (type || 'me').toString().trim().toLowerCase();

    // Convert page and limit to numbers
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = pageNum * limitNum;

    let employeeFilter = {};

    // Determine employee filter based on type
    if (normalizedType === 'me') {
      employeeFilter.employeeReferenceId = userId;
    } else if (normalizedType === 'team' || normalizedType === 'myteam') {
      // For team type, get employees under this line manager
      // You might need to adjust this based on your Employee/User model structure
      const teamMembers = await EmployModel.find({
        companyId,
        "employmentInformation.lineManager": userId
      }).select('_id');
      const teamMemberIds = teamMembers.map(member => member._id.toString());
      teamMemberIds.push(userId); // Include the manager's own KRs
      employeeFilter.employeeReferenceId = { $in: teamMemberIds };
    } else if (normalizedType === 'function' || normalizedType === 'myfunction') {
      const currentUser = await EmployModel.findById(userId).select('employmentInformation.department');
      if (currentUser && currentUser.employmentInformation && currentUser.employmentInformation.department) {
        const functionMembers = await EmployModel.find({
          companyId,
          "employmentInformation.department": currentUser.employmentInformation.department,
          "employmentInformation.status": "Active"
        }).select('_id');
        const functionMemberIds = functionMembers.map(member => member._id.toString());
        employeeFilter.employeeReferenceId = { $in: functionMemberIds };
      } else {
        employeeFilter.employeeReferenceId = userId;
      }
    } else if (normalizedType === 'company' || normalizedType === 'mycompany') {
      // Company-wide filter handled by companyId; no employeeReferenceId restriction
    } else {
      // If type is neither 'me' nor 'team', default to 'me'
      employeeFilter.employeeReferenceId = userId;
    }

    // Add company filter
    employeeFilter.companyId = companyId;

    // Build search filter for objectives if search is provided
    let searchFilter = {};
    if (search && search.trim() !== '') {
      searchFilter = {
        $or: [
          { 'objectiveName': { $regex: search, $options: 'i' } },
          // Add other searchable fields as needed
        ]
      };
    }

    // Combine filters
    const objectiveFilter = { ...employeeFilter, ...searchFilter };

    // Get objectives with pagination
    const objectivesData = await Objectives.find(objectiveFilter)
      .select('_id employeeReferenceId weight owner objectiveStatus companyId objectiveName')
      .sort({ _id: -1 })
      .lean()
      .exec();

    if (objectivesData.length === 0) {
      return res.status(200).send(
        successResponse({
          message: "No objectives found for the specified criteria!",
          data: [],
          pagination: {
            page: pageNum,
            limit: limitNum,
            total: 0,
            totalPages: 0
          }
        })
      );
    }

    const objectiveIds = objectivesData.map(item => item._id);

    // Get key results for these objectives with search filter
    let krSearchFilter = {};
    if (search && search.trim() !== '') {
      krSearchFilter = {
        $or: [
          { 'keyResultName': { $regex: search, $options: 'i' } },
          { 'okrName': { $regex: search, $options: 'i' } },
          // Add other searchable fields as needed
        ]
      };
    }

    const keyResultsFilter = {
      objectiveId: { $in: objectiveIds },
      ...krSearchFilter
    };

    // Get total count for pagination
    const totalKeyResults = await KeyResults.countDocuments(keyResultsFilter);

    // Get paginated key results
    const keyResults = await KeyResults.find(keyResultsFilter)
      .sort({ _id: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean()
      .exec();

    const krIds = keyResults.map(item => item._id);

    // Get tasks for these key results
    const tasks = await TasksModel.find({ krReferenceId: { $in: krIds } })
      .sort({ _id: -1 })
      .lean()
      .exec();

    // Get rewards configuration
    const rewards = await RewardsManagementModel.findOne(
      { companyId, krAchievementPercent: { $ne: null } },
      { krAchievementPercent: 1, krAchievementPoints: 1 }
    );

    let krAchievementPercent = !!rewards ? rewards.krAchievementPercent : 0;
    let krAchievementPoints = !!rewards ? rewards.krAchievementPoints : 0;

    // Process key results
    let finalKeyResults = keyResults.map(item => {
      let targetProgress = item.target;
      let actualProgress = item.actual || 0;

      let percent = 0;
      if (item.polarity === "Positive") {
        percent = targetProgress > 0 ? Math.min(100, Number((actualProgress / targetProgress) * 100).toFixed(2)) : 0;
      } else {
        percent = actualProgress > 0 ? Math.min(100, Number((targetProgress / actualProgress) * 100).toFixed(2)) : 0;
      }

      // Find corresponding objective data
      let objectivesDataFiltered = objectivesData.find(objItem => objItem._id.toString() === item.objectiveId.toString());

      let weight = 0;
      let objectiveStatus = "Unlock";
      let owner = "";

      if (objectivesDataFiltered) {
        weight = objectivesDataFiltered.weight || 0;
        objectiveStatus = objectivesDataFiltered.objectiveStatus || "Unlock";
        owner = objectivesDataFiltered.owner || "";
      }

      // Calculate reward points
      let rewardPoints = item.approvalRequired ? 0 : totalRewardPoints(
        percent,
        krAchievementPercent,
        krAchievementPoints,
        { weight: weight }
      );

      // Get related tasks
      let children = tasks.filter(task => task.krReferenceId.toString() === item._id.toString()).map(task => {
        return {
          ...task,
          objectiveStatus,
          owner
        };
      });

      return {
        ...item,
        objectiveStatus,
        progress: isNaN(percent) ? 0 : percent,
        objectiveWeight: weight,
        // item.weight (the KR's own weight) is preserved via the spread above
        children,
        rewardPoints,
        employeeReferenceId: objectivesDataFiltered ? objectivesDataFiltered.employeeReferenceId : null
      };
    });

    // Filter out any null results
    const finalResult = finalKeyResults.filter(item => item !== null);

    // Calculate pagination info
    const totalPages = Math.ceil(totalKeyResults / limitNum);

    res.status(200).send(
      successResponse({
        message: "Key Results Retrieved Successfully!",
        data: finalResult,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: totalKeyResults,
          totalPages: totalPages,
          hasNextPage: pageNum < totalPages - 1,
          hasPrevPage: pageNum > 0
        }
      })
    );

  } catch (err) {
    console.error('Error in getEmployeeKeyResults:', err);
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Key Results Not Fetched!",
      })
    );
  }
};

module.exports = {
  deletekeyResult,
  createkeyResult,
  updatekeyResult,
  getKeyResultSingle,
  getKeyResultsAll,
  getKeyResults,
  createOrUpdateMultipleKeyResults,
  predictData,
  getEmployeeKeyResults
};
