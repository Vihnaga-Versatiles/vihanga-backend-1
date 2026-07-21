const OkrLibraryModel = require("../models/okrLibraryTab.model");
const ObjectivesModel = require("../models/objectives.model");
const GoalsModel = require("../models/goals.model");
const KeyResultsModel = require("../models/keyResults.model");
const EmployeesModel = require("../models/employee.model");
const TasksModel = require("../models/tasks2.model");
const { isValidDate } = require("../helpers/percentageCalculation");
const getRandom = require('../middlewares/randomNumber');

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
  // #swagger.tags = ['OKR Library Management']
  try {
    let requestBody = {
      okrIndustry: req.body.okrIndustry,
      okrFunction: req.body.okrFunction,
      okrCategory: req.body.okrCategory,
      objectiveKeyResults: req.body.objectiveKeyResults,
      isActive: req.body.isActive,
      exportOKRLibrary: req.body.exportOKRLibrary,
      companyId: req.body.companyId
    };
    const newOkrLibraryModel = new OkrLibraryModel(requestBody);
    await newOkrLibraryModel.save().then((result, err) => {
      if (!err) {
        res.status(200).send(
          successResponse({
            message: "Okr Library Created Successfully!",
            data: result,
          })
        );
      } else {
        res.status(500).send(
          failResponse({
            message: "Task Not Created!",
          })
        );
      }
    });
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Task Not Created!",
      })
    );
  }
};


const createObjectives = async (req, res) => {
  // #swagger.tags = ['OKR Library Management']
  try {
    const items = Array.isArray(req.body.objectiveKeyResults) ? req.body.objectiveKeyResults : [];
    let objectives = items.filter(item => item.type === "obj");
    // Support both nested (obj.keyResults[]) and flat (type==='kr') payloads
    let keyResults = [];
    const hasFlatKrs = items.some(item => item.type === "kr");
    if (hasFlatKrs) {
      const objectiveIdToName = new Map(objectives.map(o => [o.objectiveID, o.name ?? o.title ?? o.objective]));
      keyResults = items
        .filter(item => item.type === "kr")
        .map(kr => ({
          ...kr,
          // normalize objective name for downstream okrName/objectiveId mapping
          objective: objectiveIdToName.get(kr.objectiveID) || kr.objective || "",
        }));
    } else {
      items.forEach(obj => {
        if (Array.isArray(obj.keyResults)) {
          keyResults = [...keyResults, ...obj.keyResults]
        }
      });
    }
    // Collect tasks from flat payload (type==='task') if present
    const tasksLib = items.filter(item => item.type === "task");
    // Collect tasks nested under KRs (support keys: tasks or children)
    const nestedTasks = [];
    items.forEach(obj => {
      const objectiveName = obj?.name || obj?.objective || "";
      const krsArr = Array.isArray(obj?.keyResults) ? obj.keyResults : [];
      krsArr.forEach(kr => {
        const krName = kr?.name ?? kr?.keyResultName ?? kr?.title ?? "";
        const tArr = Array.isArray(kr?.tasks) ? kr.tasks : (Array.isArray(kr?.children) ? kr.children : []);
        tArr.forEach(task => nestedTasks.push({ objectiveName, krName, task }));
      });
    });
    const employees = await EmployeesModel.find({ "employmentInformation.status": "Active" }).sort({ _id: -1 });
    let updatedObjectives = objectives.map(item => {
      return {
        employeeName: req.body.employeeName,
        okrPeriod: req.body.okrPeriod,
        okrYear: req.body.okrYear,
        objective: item.name ?? item.title ?? item.objective,
        weight: 1,
        dimension: req.body.dimension,
        owner: req.body.owner,
        employeeReferenceId: req.body.employeeReferenceId,
        employeeNumber: employees.filter(employee => employee._id == req.body.employeeReferenceId)[0].employmentInformation.employeeNumber,
        objectiveID: "OBJ_" + getRandom(7)
      }
    })
    await ObjectivesModel.insertMany(updatedObjectives).then(async (result, err) => {
      if (result.length > 0) {
        let finalObjectives = result.map((objective) => ({ _id: objective._id, objective: objective.objective }));
        finalObjectives = finalObjectives.map((item) => {
          let obj = { ...item };
          obj.objectiveID = objectives.filter(obj => obj.name === item.objective)[0].objectiveID;
          return obj;
        });
        let updatedKeyResults = keyResults.map((item) => {
          let okrName = finalObjectives.filter(itemm => itemm.objective == item.objective)[0].objective;
          let objectiveId = finalObjectives.filter(itemm => itemm.objective == item.objective)[0]._id;
          return {
            okrName,
            dimension: req.body.dimension,
            isAlignedToCompany: "No",
            keyResultName: item.name ?? item.title ?? item.keyResultName,
            target: "",
            actual: "",
            basevalue: 0,
            objectiveId,
            polarity: 'Positive',
            krID: "KR_" + getRandom(7),
          }
        })
        await KeyResultsModel.insertMany(updatedKeyResults).then(async (results, errr) => {
          if (!errr) {
            // Build a map of created KR by composite key okrName__keyResultName
            const createdKrMap = new Map(results.map(r => [`${r.okrName}__${r.keyResultName}`, r._id.toString()]));
            // Map library KR id -> { name, objectiveName }
            const krLibById = new Map();
            keyResults.forEach(kr => {
              if (kr.keyresultID) {
                krLibById.set(kr.keyresultID, { keyResultName: kr.name ?? kr.title ?? kr.keyResultName, objectiveName: kr.objective });
              }
            });
            // Build tasks from both flat and nested shapes
            const tasksToInsert = [];
            // Flat list tasks (type==='task')
            tasksLib.forEach(task => {
              const parentKr = krLibById.get(task.keyresultID);
              if (!parentKr) return;
              const composite = `${parentKr.objectiveName}__${parentKr.keyResultName}`;
              const krReferenceId = createdKrMap.get(composite);
              if (!krReferenceId) return;
              const start = isValidDate(task.startDate) ? task.startDate : (isValidDate(task.dueDate) ? task.dueDate : (req.body.startDate || req.body.dueDate || new Date()));
              const due = isValidDate(task.dueDate) ? task.dueDate : start;
              const actual = isValidDate(task.actualCompletionDate) ? task.actualCompletionDate : null;
              tasksToInsert.push({
                title: task.title ?? task.name ?? task.taskName,
                description: task.description || '',
                startDate: start,
                dueDate: due,
                actualCompletionDate: actual,
                linkToKR: task.linkToKR || '',
                assignTo: Array.isArray(task.assignTo) && task.assignTo.length > 0 ? task.assignTo : [req.body.employeeReferenceId],
                priority: task.priority || 'High Level',
                comments: task.comments || '',
                attachments: task.attachments || '',
                krReferenceId,
                estimationEffort: task.estimationEffort || '',
                actualEffort: task.actualEffort || '',
                status: task.status || 'notstarted',
                recurrence: !!task.recurrence,
                recurrenceDetails: task.recurrenceDetails || null,
                mainTask: task.mainTask || null,
                progressStatus: typeof task.progressStatus === 'number' ? task.progressStatus : 0,
                companyId: task.companyId || req.body.companyId,
                userId: task.userId || req.body.employeeReferenceId,
              });
            });
            // Nested tasks under each KR in the library payload
            nestedTasks.forEach(({ objectiveName, krName, task }) => {
              const composite = `${objectiveName}__${krName}`;
              const krReferenceId = createdKrMap.get(composite);
              if (!krReferenceId) return;
              const start = isValidDate(task.startDate) ? task.startDate : (isValidDate(task.dueDate) ? task.dueDate : (req.body.startDate || req.body.dueDate || new Date()));
              const due = isValidDate(task.dueDate) ? task.dueDate : start;
              const actual = isValidDate(task.actualCompletionDate) ? task.actualCompletionDate : null;
              tasksToInsert.push({
                title: task.title ?? task.name ?? task.taskName,
                description: task.description || '',
                startDate: start,
                dueDate: due,
                actualCompletionDate: actual,
                linkToKR: task.linkToKR || '',
                assignTo: Array.isArray(task.assignTo) && task.assignTo.length > 0 ? task.assignTo : [req.body.employeeReferenceId],
                priority: task.priority || 'High Level',
                comments: task.comments || '',
                attachments: task.attachments || '',
                krReferenceId,
                estimationEffort: task.estimationEffort || '',
                actualEffort: task.actualEffort || '',
                status: task.status || 'notstarted',
                recurrence: !!task.recurrence,
                recurrenceDetails: task.recurrenceDetails || null,
                mainTask: task.mainTask || null,
                progressStatus: typeof task.progressStatus === 'number' ? task.progressStatus : 0,
                companyId: task.companyId || req.body.companyId,
                userId: task.userId || req.body.employeeReferenceId,
              });
            });
            if (tasksToInsert.length > 0) {
              await TasksModel.insertMany(tasksToInsert);
            }
            res.status(200).send(
              successResponse({
                message: "Objectives, Key Results, and Tasks Created Successfully!",
                data: results,
              })
            );
          } else {
            res.status(500).send(
              failResponse({
                message: "Objectives and Key Results Not Created!",
              })
            );
          }
        })
      }
    });
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Objectives and Key Results Not Created!",
      })
    );
  }
};

const createGoals = async (req, res) => {
  // #swagger.tags = ['OKR Library Management']
  try {
    let objectives = req.body.objectiveKeyResults.filter(item => item.type === "obj");
    let keyResults = [];
    req.body.objectiveKeyResults.forEach(obj => {
      keyResults = [...keyResults, ...obj.keyResults]
    })
    const employees = await EmployeesModel.find({ "employmentInformation.status": "Active" }).sort({ _id: -1 });
    let updatedObjectives = objectives.map(item => {
      return {
        employeeName: req.body.employeeName,
        okrPeriod: req.body.okrPeriod,
        okrYear: req.body.okrYear,
        objective: item.name ?? item.title ?? item.objective,
        weight: 1,
        dimension: req.body.dimension,
        owner: req.body.owner,
        employeeReferenceId: req.body.employeeReferenceId,
        employeeNumber: employees.filter(employee => employee._id == req.body.employeeReferenceId)[0].employmentInformation.employeeNumber,
        uom: "",
        target: 0,
        actual: 0,
        polarity: "Positive",
        objectiveID: "GOAL_" + getRandom(7)
      }
    })
    await GoalsModel.insertMany(updatedObjectives).then(async (result, err) => {
      if (result.length > 0) {
        res.status(200).send(
          successResponse({
            message: "Goals Created Successfully!",
            data: result,
          })
        );
      }
    });
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Goals Not Created!",
      })
    );
  }
};
const getAllOkrLibrary = async (req, res) => {
  // #swagger.tags = ['OKR Library Management']
  try {
    const Tasks = await OkrLibraryModel.find(req?.params?.id?{companyId:req.params.id}:{}).sort({ _id: -1 });
    res.status(200).send(
      successResponse({
        message: "OkrLibrary Retrieved Successfully!",
        data: Tasks,
      })
    );
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "OkrLibrary Not Fetched!",
      })
    );
  }
};

const deleteOkrLibrary = (req, res) => {
  // #swagger.tags = ['OKR Library Management']
  OkrLibraryModel.findByIdAndRemove({ _id: req.params.id }, (err) => {
    if (!err) {
      res.status(200).send(
        successResponse({
          message: "OkrLibrary Deleted Successfully!",
        })
      );
    } else {
      res.status(500).send(
        failResponse({
          message: err ? err.message : "OkrLibrary Not Deleted!",
        })
      );
    }
  });
};

const deleteOkrLibraries = (req, res) => {
  // #swagger.tags = ['OKR Library Management']
  OkrLibraryModel.deleteMany({ _id: { $in: req.body.data } }, (err) => {
    if (!err) {
      res.status(200).send(
        successResponse({
          message: "OkrLibraries Deleted Successfully!",
        })
      );
    } else {
      res.status(500).send(
        failResponse({
          message: err ? err.message : "OkrLibraries Not Deleted!",
        })
      );
    }
  });
};

const okrLibaryUpdate = async (req, res) => {
  // #swagger.tags = ['OKR Library Management']
  try {
    const tasks = await OkrLibraryModel.findById(req.params.id);
    if (tasks) {
      OkrLibraryModel.findByIdAndUpdate(req.params.id, req.body, (err) => {
        if (!err) {
          res.status(200).send(
            successResponse({
              message: "OkrLibrary Updated Successfully!",
            })
          );
        }
      });
    }
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "OkrLIbrary Not Updated!",
      })
    );
  }
};

module.exports = {
  createObjectives,
  deleteOkrLibraries,
  deleteOkrLibrary,
  createOkrLibrary,
  okrLibaryUpdate,
  getAllOkrLibrary,
  createGoals
};
