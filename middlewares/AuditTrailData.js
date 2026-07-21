const AuditTrailModel = require("../models/AuditTrail");

const saveChangedTasks = async (req, res, next) => {
  let url = req.route.path;
  let commonData = {
    dataDocument: req.body,
    collectionName: "tasks2",
    userId: req.body.userId,
    featureName: "Tasks",
  }
  if (url === "/tasks2/createTask") {
    saveData("Create", commonData, next, req)
  } else if (url === "/tasks2/updateTask/:id") {
    saveData("Update", commonData, next, req)
  } else if (url === "/tasks2/deleteTask/:id") {
    saveData("Delete", commonData, next, req)
  }
}

const saveChangedObjectives = async (req, res, next) => {
  let url = req.route.path;
  let commonData = {
    dataDocument: req.body,
    collectionName: "Objectives",
    userId: req.body.employeeReferenceId,
    featureName: "Objectives",
  }
  if (url === "/objectives/createObjective") {
    saveData("Create", commonData, next, req)
  } else if (url === "/objectives/updateObjective/:id") {
    saveData("Update", commonData, next, req)
  } else if (url === "/objectives/deleteObjective/:id") {
    saveData("Delete", commonData, next, req)
  }
}
const saveChangedGoals = async (req, res, next) => {
  let url = req.route.path;
  let commonData = {
    dataDocument: req.body,
    collectionName: "Goals",
    userId: req.body.employeeReferenceId,
    featureName: "Goals",
  }
  if (url === "/goals/createObjective") {
    saveData("Create", commonData, next, req)
  } else if (url === "/goals/updateObjective/:id") {
    saveData("Update", commonData, next, req)
  } else if (url === "/goals/deleteObjective/:id") {
    saveData("Delete", commonData, next, req)
  }
}
const saveChangedKeyResults = async (req, res, next) => {
  let url = req.route.path;
  let commonData = {
    dataDocument: req.body,
    collectionName: "KeyResults",
    userId: req.body.userId,
    featureName: "KeyResults",
  }
  if (url === "/keyresults/createkeyResult") {
    saveData("Create", commonData, next, req)
  } else if (url === "/keyresults/updatekeyResult/:id") {
    saveData("Update", commonData, next, req)
  } else if (url === "/keyresults/deletekeyResult/:id") {
    saveData("Delete", commonData, next, req)
  }
}
async function saveData(operation = "Unknown", commonData, next, req) {
  let newChangeData = await AuditTrailModel({
    ...commonData,
    operation
  })
  newChangeData.save().then((res, err) => {
    if (!err) {
      req.auditId = res._id;
      next();
    } else {
      console.log("audit trail error", err);
      next();
    }
  })
}


module.exports = {
  saveChangedTasks,
  saveChangedObjectives,
  saveChangedKeyResults,
  saveChangedGoals
}