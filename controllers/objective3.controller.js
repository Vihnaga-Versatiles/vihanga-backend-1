const ObjectivesModel = require("../models/objectives.model");
const KeyResultsModel = require("../models/keyResults.model");
const EmployeesModel = require("../models/employee.model");
const RewardsModel = require("../models/rewardManagement.model");
const AuditTrailModel = require("../models/AuditTrail");
const TasksModel = require("../models/tasks2.model");
const Tasks2Model = require("../models/tasks2.model");
const RedemptionsModel = require("../models/redemptions.model");
const RewardPointsModel = require("../models/rewardpoints.model");
const PrivilegesModel = require("../models/privileges.model");
const mongoose = require("mongoose");
const { percentageCalculation, totalSum, totalRewardPoints, isValidDate, totalRewardPointsTask } = require("../helpers/percentageCalculation");

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
const getCompanyObjectives = async (req, res) => {
  try {
    const { userId, companyId, type, empId = '', okrYear = '' } = req.query;
    const normalizedType = (type || "").toString().trim().toLowerCase();
    let objj = {};

    // Always get currentUser from userId (empId is only for filtering)
    const currentUser = await EmployeesModel.findById(userId).select("employmentInformation personalInformation companyId");
    if (!currentUser) {
      return res.status(404).send(
        failResponse({
          message: "User not found!",
        })
      );
    }

    const correctCompanyId = (companyId || currentUser.companyId || "")
      .toString()
      .replace(/^"|"$/g, "")
      .trim();
    const userRole = currentUser.employmentInformation.role;

    // Use the normalized type as-is. The empId will be used for filtering within each type
    const effectiveType = normalizedType;

    switch (effectiveType) {
      case 'me':
        // Use empId if provided and not "all", otherwise use userId
        const targetUserId = empId && empId.trim() && empId.trim().toLowerCase() !== 'all' ? empId : userId;
        objj.$or = [
          { employeeReferenceId: targetUserId },
          { owner: targetUserId }
        ];
        break;

      case 'team':
      case 'myteam':
        // If empId is 'all', show all team members under current user
        if (empId && empId.trim() && empId.trim().toLowerCase() === 'all') {
          const teamEmployeesAll = await EmployeesModel.find({
            companyId: correctCompanyId,
            "employmentInformation.lineManager": currentUser._id,
            $or: [
              { "employmentInformation.status": "Active" },
              { "employmentInformation.status": "active" },
              { "employmentInformation.status": { $exists: false } }
            ]
          }).select("_id");
          const teamEmployeeIdsAll = teamEmployeesAll
            .map(emp => emp && emp._id && emp._id.toString())
            .filter(Boolean);
          const teamEmployeeObjectIdsAll = teamEmployeesAll
            .map(emp => emp && emp._id)
            .filter(Boolean);
          objj.$or = [
            { employeeReferenceId: { $in: teamEmployeeIdsAll } },
            // Match owner whether stored as string id or ObjectId
            { owner: { $in: teamEmployeeIdsAll } },
            { owner: { $in: teamEmployeeObjectIdsAll } }
          ];
        } else if (empId && empId.trim()) {
          // If a specific employee is selected, show only that employee's records
          objj.$or = [
            { employeeReferenceId: empId },
            { owner: empId }
          ];
        } else {
          // Default: show only team members under current user
          const teamEmployees = await EmployeesModel.find({
            companyId: correctCompanyId,
            "employmentInformation.lineManager": currentUser._id,
            $or: [
              { "employmentInformation.status": "Active" },
              { "employmentInformation.status": "active" },
              { "employmentInformation.status": { $exists: false } }
            ]
          }).select("_id");

          const teamEmployeeIds = teamEmployees.map(emp => emp._id.toString());
          const teamEmployeeObjectIds = teamEmployees.map(emp => emp._id);
          objj.$or = [
            { employeeReferenceId: { $in: teamEmployeeIds } },
            // Match owner whether stored as string id or ObjectId
            { owner: { $in: teamEmployeeIds } },
            { owner: { $in: teamEmployeeObjectIds } }
          ];
        }
        break;

      case 'function':
      case 'myfunction':
        // Handle department scoping and specific employee selection
        if (empId && empId.trim() && empId.trim().toLowerCase() !== 'all') {
          // Specific employee within the function
          objj.$or = [
            { employeeReferenceId: empId },
            { owner: empId }
          ];
        } else {
          // 'all' or empty: Find all employees in the same function(s) as the current user
          let userFunctions = [];
          if (currentUser && currentUser.employmentInformation) {
            // Add primary department
            if (currentUser.employmentInformation.department) {
              userFunctions.push(currentUser.employmentInformation.department);
            }
            // Add functions from legal entity mappings
            if (currentUser.employmentInformation.legalEntityMappings && Array.isArray(currentUser.employmentInformation.legalEntityMappings)) {
              currentUser.employmentInformation.legalEntityMappings.forEach(mapping => {
                if (mapping.function) {
                  userFunctions.push(mapping.function);
                }
              });
            }
          }
          // Remove duplicates
          userFunctions = [...new Set(userFunctions)];

          if (userFunctions.length > 0) {
            const functionEmployees = await EmployeesModel.find({
              companyId: correctCompanyId,
              $or: [
                { "employmentInformation.department": { $in: userFunctions } },
                { "employmentInformation.legalEntityMappings.function": { $in: userFunctions } }
              ],
              $and: [
                {
                  $or: [
                    { "employmentInformation.status": "Active" },
                    { "employmentInformation.status": "active" },
                    { "employmentInformation.status": { $exists: false } }
                  ]
                }
              ]
            }).select("_id");
            const functionEmployeeIds = functionEmployees
              .map(emp => emp && emp._id && emp._id.toString())
              .filter(Boolean);
            const functionEmployeeObjectIds = functionEmployees
              .map(emp => emp && emp._id)
              .filter(Boolean);
            objj.$or = [
              { employeeReferenceId: { $in: functionEmployeeIds } },
              { owner: { $in: functionEmployeeIds } },
              { owner: { $in: functionEmployeeObjectIds } }
            ];
          } else {
            // Fallback to just current user if department not found
            objj.$or = [
              { employeeReferenceId: currentUser._id.toString() },
              { owner: currentUser._id.toString() }
            ];
          }
        }
        break;

      case 'company':
      case 'mycompany':
        // If empId is 'all' or empty, show all company employees
        if (!empId || !empId.trim() || empId.trim().toLowerCase() === 'all') {
          const companyEmployees = await EmployeesModel.find({
            companyId: correctCompanyId,
            $or: [
              { "employmentInformation.status": "Active" },
              { "employmentInformation.status": "active" },
              { "employmentInformation.status": { $exists: false } }
            ]
          }).select("_id");
          const companyEmployeeIds = companyEmployees
            .map(emp => emp && emp._id && emp._id.toString())
            .filter(Boolean);
          objj.$or = [
            { employeeReferenceId: { $in: companyEmployeeIds } }
          ];
        } else {
          // If a specific employee is selected, show only that employee's records
          objj.$or = [
            { employeeReferenceId: empId },
            { owner: empId }
          ];
        }
        break;

      default:
        return res.status(400).send(
          failResponse({
            message: "Invalid type parameter. Use 'me', 'myteam', 'myfunction', or 'mycompany'.",
          })
        );
    }

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
      },
      {
        $sort: { "objective.createdAt": -1 }
      }
    ]);
    const allEmployees = await EmployeesModel.find({
      companyId: correctCompanyId,
      $or: [
        { "employmentInformation.status": "Active" },
        { "employmentInformation.status": "active" },
        { "employmentInformation.status": { $exists: false } }
      ]
    }).select("employmentInformation personalInformation").sort({ _id: -1 }).lean();

    let employeeIds = objectives
      .map(singleObjective => singleObjective?.objective?.employeeReferenceId)
      .filter(id => !!id);
    let ownerIds = objectives
      .map(singleObjective => singleObjective?.objective?.owner)
      .filter(owner => !!owner && mongoose.Types.ObjectId.isValid(owner));
    let allEmployeeIdsString = [...new Set([...employeeIds, ...ownerIds])]
      .filter(id => !!id)
      .map(id => id.toString());

    const employees = allEmployees.filter(employee =>
      allEmployeeIdsString.includes(employee._id.toString())
    );

    const rewards = await RewardsModel.find({ companyId: correctCompanyId }).sort({ _id: -1 }).lean();
    const privileges = await PrivilegesModel.find({ role: userRole, companyId: correctCompanyId }).sort({ _id: -1 }).lean();

    // Only the key-results attached to the matched objectives can have related
    // tasks, so scope the tasks query to those KR ids instead of loading the
    // entire tasks collection. This yields the same matched set as the previous
    // in-memory filter (tasks.krReferenceId === keyResult._id).
    const keyResultIds = [];
    objectives.forEach(singleObjective => {
      (singleObjective.children || []).forEach(kr => {
        if (kr && kr._id) keyResultIds.push(kr._id.toString());
      });
    });
    const tasks = keyResultIds.length > 0
      ? await TasksModel.find({ krReferenceId: { $in: keyResultIds } }).sort({ dueDate: 1 }).lean()
      : [];

    // Pre-index tasks by key-result id (preserving dueDate sort order) to avoid
    // scanning the whole tasks array for every key-result.
    const tasksByKrId = new Map();
    tasks.forEach(task => {
      const key = (task.krReferenceId || "").toString();
      if (!tasksByKrId.has(key)) tasksByKrId.set(key, []);
      tasksByKrId.get(key).push(task);
    });

    // Lookup maps for exact id-based employee resolution (replaces repeated
    // linear Array.find scans inside the nested maps below).
    const allEmployeesById = new Map();
    allEmployees.forEach(emp => allEmployeesById.set(emp._id.toString(), emp));
    const employeesById = new Map();
    employees.forEach(emp => employeesById.set(emp._id.toString(), emp));

    let krAchievementPercent = rewards.length > 0 ? rewards[0].krAchievementPercent : 0;
    let krAchievementPoints = rewards.length > 0 ? rewards[0].krAchievementPoints : 0;

    // Calculate total weight per employee for weight-based approval logic
    const employeeWeights = {};
    objectives.forEach(singleObjective => {
      const empId = singleObjective.objective.employeeReferenceId;
      if (empId) {
        if (!employeeWeights[empId]) {
          employeeWeights[empId] = 0;
        }
        employeeWeights[empId] += Number(singleObjective.objective.weight) || 0;
      }
    });

    let result = objectives.map((singleObjective) => {
      let newObj = { ...singleObjective.objective };
      const referenceEmployee = employeesById.get(String(newObj.employeeReferenceId));
      newObj.employeeNumber = referenceEmployee ?
        referenceEmployee.employmentInformation.employeeNumber : "";

      let ownerEmployee;
      if (mongoose.Types.ObjectId.isValid(newObj.owner)) {
        ownerEmployee = employeesById.get(String(newObj.owner));
      } else {
        ownerEmployee = allEmployees.find(employee =>
          `${employee.personalInformation.firstName} ${employee.personalInformation.lastName || ''}`.trim() === newObj.owner
        );
      }

      newObj.ownerName = ownerEmployee ?
        `${ownerEmployee.personalInformation.firstName} ${ownerEmployee.personalInformation.lastName || ''}`.trim() :
        (typeof newObj.owner === 'string' ? newObj.owner : '');

      // Add Function Name and Designation from owner employee
      const primaryMapping = ownerEmployee?.employmentInformation?.legalEntityMappings?.find(m => m.type === 'PRIMARY');
      newObj.functionName = primaryMapping?.function || ownerEmployee?.employmentInformation?.department || '';
      newObj.designation = ownerEmployee?.employmentInformation?.designation || '';
      
      // Add total weight for this employee's objectives
      newObj.employeeTotalWeight = employeeWeights[newObj.employeeReferenceId] || 0;

      // Invariant across this objective's key-results and tasks; compute once.
      // Preserves original semantics: when an employee matches, use its
      // profilePicture as-is (even if empty); otherwise use the default.
      const employeeNameMatch = employees.find(employee =>
        singleObjective.objective.employeeName?.includes(employee.personalInformation.firstName));
      const employeeNameProfilePicture = employeeNameMatch ?
        employeeNameMatch?.personalInformation?.profilePicture :
        "https://www.clipartmax.com/png/middle/103-1038880_user-rubber-stamp-female-user-icon.png";

      newObj.children = singleObjective.children
        .map((item) => {
          let percent = percentageCalculation(item);
          let rewardPoints = item.approvalRequired ? 0 : totalRewardPoints(percent, krAchievementPercent, krAchievementPoints, newObj);
          return {
            ...item,
            percent: (percent == "NaN" || percent == null) ? 0 : percent,
            owner: singleObjective.objective.employeeName,
            ownerName: ownerEmployee ?
              `${ownerEmployee.personalInformation.firstName} ${ownerEmployee.personalInformation.lastName || ''}`.trim() :
              singleObjective.objective.employeeName || '',
            functionName: newObj.functionName,
            designation: newObj.designation,
            profilePicture: employeeNameProfilePicture,
            rewardPoints,
            objective: singleObjective.objective.objective,
            objectiveId: item.objectiveId,
            children: (tasksByKrId.get(item._id.toString()) || []).map(itemTask => {
              const assigneeNames = itemTask.assignTo ?
                itemTask.assignTo.map(assigneeId => {
                  const assignee = allEmployeesById.get((assigneeId || '').toString());
                  return assignee ?
                    `${assignee.personalInformation.firstName} ${assignee.personalInformation.lastName || ''}`.trim() :
                    assigneeId;
                }) : [];

              const userEmployee = allEmployeesById.get((itemTask.userId || '').toString());
              const userName = userEmployee ?
                `${userEmployee.personalInformation.firstName} ${userEmployee.personalInformation.lastName || ''}`.trim() :
                (typeof itemTask.userId === 'string' ? itemTask.userId : '');

              const taskOwnerId = (itemTask.assignTo?.[0] || itemTask.userId || newObj.employeeReferenceId || '').toString();
              const taskOwnerEmp = allEmployeesById.get(taskOwnerId);
              const taskPrimaryMapping = taskOwnerEmp?.employmentInformation?.legalEntityMappings?.find(m => m.type === 'PRIMARY');
              const taskFunctionName = taskPrimaryMapping?.function || taskOwnerEmp?.employmentInformation?.department || newObj.functionName || '';
              const taskDesignation = taskOwnerEmp?.employmentInformation?.designation || newObj.designation || '';

              return {
                ...itemTask,
                assignee: assigneeNames,
                userName,
                functionName: taskFunctionName,
                designation: taskDesignation,
                profilePicture: employeeNameProfilePicture
              };
            })
          };
        });

      const ownerNameMatch = employees.find(employee => newObj.owner && newObj.owner?.includes(employee?.personalInformation?.firstName));
      newObj.profilePicture = ownerNameMatch ?
        ownerNameMatch?.personalInformation?.profilePicture :
        "https://www.clipartmax.com/png/middle/103-1038880_user-rubber-stamp-female-user-icon.png";

      let avgPercent = 0;
      if (newObj.children.length > 0) {
        const totalWeight = newObj.children.reduce((sum, kr) => sum + (Number(kr.weight) || 0), 0);
        if (totalWeight > 0) {
          // Weighted average: sum(percent * weight) / totalWeight
          avgPercent = newObj.children.reduce((sum, kr) => sum + (Number(kr.percent) || 0) * (Number(kr.weight) || 0), 0) / totalWeight;
        } else {
          // Fallback to simple average when no weights are set
          avgPercent = totalSum(newObj.children, "percent") / newObj.children.length;
        }
      } else {
        avgPercent = parseFloat(newObj.progressStatus) || 0;
      }
      newObj.progressStatus =
        newObj.children.length > 0
          ? Math.min(100, Math.trunc(avgPercent * 100) / 100)
          : (newObj.progressStatus > 0 ? Math.min(100, Math.trunc(avgPercent * 100) / 100) : "0");

      let objectivesAchievementPercent = rewards.length > 0 ? rewards[0].objectivesAchievementPercent : 0;
      let objectivesAchievementPoints = rewards.length > 0 ? rewards[0].objectivesAchievementPoints : 0;
      let rewardPoints = newObj.approvalRequired ? 0 : totalRewardPoints(newObj.progressStatus, objectivesAchievementPercent, objectivesAchievementPoints, newObj);
      newObj.rewardPoints = rewardPoints;

      newObj.IndividualProgress = [];
      newObj.eachPercentage = [];
      newObj.IndividualNames = [];
      newObj.randomColors = [];

      return newObj;
    });

    res.status(200).send(
      successResponse({
        message: "Objectives Retrieved Successfully!",
        data: result,
        privileges,
        lineManager: allEmployees.filter(employee => employee._id == userId).length > 0 ? allEmployees.filter(employee => employee._id == userId)[0].employmentInformation.lineManager : "",
        companyHead: allEmployees.filter(employee => employee.employmentInformation.departmentHead === "Yes").length > 0 ? allEmployees.filter(employee => employee.employmentInformation.departmentHead === "Yes")[0]._id : "",
        type: normalizedType
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
  getCompanyObjectives
};