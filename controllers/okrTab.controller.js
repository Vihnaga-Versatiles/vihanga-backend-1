const OkrTabModel = require("../models/okrTab.model");
const ObjectivesModel = require("../models/objectives.model");
const KeyResultsModel = require("../models/keyResults.model");
const TasksModel = require("../models/tasks2.model");
const EmployeesModel = require("../models/employee.model");
const OKRUploadModel = require("../models/okrUpload.model");
const getRandom = require('../middlewares/randomNumber');
const { isValidDate } = require("../helpers/percentageCalculation");
const mongoose = require('mongoose');

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

const createOkrTab = async (req, res) => {
  // #swagger.tags = ['OKR Management']
  try {
    let requestBody = {
      okrTemplateName: req.body.okrTemplateName,
      instructionsToUsers: req.body.instructionsToUsers,
      startDate: isValidDate(req.body.startDate) ? req.body.startDate : null,
      endDate: isValidDate(req.body.endDate) ? req.body.endDate : null,
      highValueRange: req.body.highValueRange,
      midValueRange: req.body.midValueRange,
      lowValueRange: req.body.lowValueRange,
      eligibilityGroup: req.body.eligibilityGroup,
      companyId: req.body.companyId
    };
    const newKeyResult = new OkrTabModel(requestBody);
    await newKeyResult.save().then((result, err) => {
      if (!err) {
        res.status(200).send(
          successResponse({
            message: "OkrTab Created Successfully!",
            data: result
          })
        );
      } else {
        res.status(500).send(
          failResponse({
            message: "OkrTab Not Created!",
          })
        );
      }
    })
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "OkrTab Not Created!",
      })
    );
  }
};

const getAllOkrTab = async (req, res) => {
  // #swagger.tags = ['OKR Management']
  try {
    const Tasks = await OkrTabModel.find({ companyId: req.params.companyId }).sort({ _id: -1 });
    res.status(200).send(
      successResponse({
        message: "OkrTab Retrieved Successfully!",
        data: Tasks,
      })
    );
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "OkrTab Not Fetched!",
      })
    );
  }
};

const deleteOkrTab = (req, res) => {
  // #swagger.tags = ['OKR Management']
  OkrTabModel.findByIdAndRemove({ _id: req.params.id }, (err) => {
    if (!err) {
      res.status(200).send(
        successResponse({
          message: "OkrTab Deleted Successfully!",
        })
      );
    } else {
      res.status(500).send(
        failResponse({
          message: err ? err.message : "OkrTab Not Deleted!",
        })
      );
    }
  });
};

const deleteOkrTabs = (req, res) => {
  // #swagger.tags = ['OKR Management']
  OkrTabModel.deleteMany({ _id: { $in: req.body.data } }, (err) => {
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


const createObjectivesAndKeyResults = async (req, res) => {
  // #swagger.tags = ['OKR Management']
  try {
    const objectivesData = await ObjectivesModel.find({}).sort({ _id: -1 });
    const employeesData = await EmployeesModel.find({ "employmentInformation.status": "Active" }).sort({ _id: -1 });
    
    const items = req.body.data;
    const fileMeta = req.body.fileMeta;
    const companyId = req.body.companyId || (items[0] && items[0].companyId);
    
    const objectives = [];
    const keyResults = [];
    const tasks = [];
    const newKrIdMap = {};
    const newObjectiveIdToPayload = {};
    const updatedObjectiveIds = [];
    
    // Generate unique batch ID for this upload
    const uploadBatchId = new mongoose.Types.ObjectId().toString();
    
    // 1. Process Objectives
    items.forEach((item) => {
      if (item.type === 'obj') {
        const empDetails = getEmployeeDetails(employeesData, item.employeeNumber);
        const objectiveName = item.objective ?? item.title ?? item.name;
        const objPayload = { 
          ...item, 
          objective: objectiveName,
          employeeReferenceId: empDetails.id,
          employeeName: empDetails.name,
          owner: empDetails.id,
          companyId: item.companyId || empDetails.companyId,
          uploadBatchId: uploadBatchId
        };

        if (item.objectiveID && !item.krID && !item.KRObjectiveID) {
          // Update existing objective
          objectives.push({
            updateOne: {
              filter: { objectiveID: item.objectiveID },
              update: { $set: objPayload },
              upsert: true,
            },
          });
          updatedObjectiveIds.push(item.objectiveID);
        } else if (!item.objectiveID && !item.krID) {
          // Create new objective
          const newObjectiveID = "OBJ_" + getRandom(7);
          objectives.push({
            insertOne: {
              document: { ...objPayload, objectiveID: newObjectiveID }
            },
          });
          newObjectiveIdToPayload[newObjectiveID] = item;
          item.objectiveID = newObjectiveID;
        }
      }
    });
    
    console.log('Objectives to insert:', JSON.stringify(objectives, null, 2));
    
    // 2. Build objectiveID -> MongoDB _id mapping
    const objectiveIdToMongoId = {};
    objectivesData.forEach(obj => {
      if (obj.objectiveID) objectiveIdToMongoId[obj.objectiveID] = obj._id.toString();
    });
    
    if (objectives.length > 0) {
      await ObjectivesModel.bulkWrite(objectives, { ordered: false });
      
      // Fetch newly inserted objectives
      const insertedObjectiveIDs = Object.keys(newObjectiveIdToPayload);
      if (insertedObjectiveIDs.length > 0) {
        const insertedObjectives = await ObjectivesModel.find({ objectiveID: { $in: insertedObjectiveIDs } });
        insertedObjectives.forEach(obj => {
          objectiveIdToMongoId[obj.objectiveID] = obj._id.toString();
        });
      }
      
      // Fetch updated objectives
      if (updatedObjectiveIds.length > 0) {
        const updatedObjectives = await ObjectivesModel.find({ objectiveID: { $in: updatedObjectiveIds } });
        updatedObjectives.forEach(obj => {
          objectiveIdToMongoId[obj.objectiveID] = obj._id.toString();
        });
      }
    }
    
    console.log('ObjectiveID to MongoDB ID mapping:', objectiveIdToMongoId);
    
    // 3. Process Key Results
    const krIdToMongoId = {};
    
    items.forEach((item) => {
      if (item.type === 'kr') {
        const empDetails = getEmployeeDetails(employeesData, item.employeeNumber);
        const mongoObjectiveId = objectiveIdToMongoId[item.objectiveID];
        const keyResultName = item.keyResultName ?? item.title ?? item.name ?? '';

        if (!mongoObjectiveId) {
          console.error('No valid objectiveId found for KR:', item);
          return;
        }

        const krPayload = { 
          ...item, 
          keyResultName,
          owner: empDetails.id,
          okrName: getObjectiveName(items, item.objectiveID),
          objectiveId: mongoObjectiveId,
          companyId: item.companyId || empDetails.companyId,
          uploadBatchId: uploadBatchId
        };

        if (item.krID && typeof item.krID === 'string' && item.krID.startsWith('KR_')) {
          // Update existing KR
          keyResults.push({
            updateOne: {
              filter: { krID: item.krID },
              update: { $set: krPayload },
              upsert: true,
            },
          });
        } else {
          // Create new KR
          const newKrID = "KR_" + getRandom(7);
          keyResults.push({
            insertOne: {
              document: { ...krPayload, krID: newKrID }
            },
          });
          newKrIdMap[item.KRObjectiveID || `temp_${newKrID}`] = newKrID;
          item.krID = newKrID;
        }
      }
    });
    
    console.log('KeyResults to insert:', JSON.stringify(keyResults, null, 2));
    
    if (keyResults.length > 0) {
      await KeyResultsModel.bulkWrite(keyResults, { ordered: false });
    }
    
    // Build krID -> MongoDB _id mapping
    const allKrIDs = items.filter(i => i.type === 'kr' && i.krID).map(i => i.krID);
    if (allKrIDs.length > 0) {
      const krDocs = await KeyResultsModel.find({ krID: { $in: allKrIDs } });
      krDocs.forEach(kr => {
        krIdToMongoId[kr.krID] = kr._id.toString();
      });
    }
    
    console.log('KR ID to MongoDB ID mapping:', krIdToMongoId);
    
    // 4. Process Tasks
    items.forEach((item, index) => {
      if (item.type === 'task') {
        const { krID, objectiveID } = findKrIdForTask(item, index, items, newKrIdMap);
        
        if (!krID) {
          console.warn('Skipping task - no valid krID found:', item);
          return;
        }
        
        // Get employee details for task assignees
        let assignToIds = [];
        if (item.assignTo) {
          assignToIds = Array.isArray(item.assignTo) ? item.assignTo : [item.assignTo];
          assignToIds = assignToIds.map(num => {
            const emp = getEmployeeById(employeesData, num);
            return emp ? emp._id.toString() : num;
          });
        } else if (item.employeeNumber) {
          const empDetails = getEmployeeDetails(employeesData, item.employeeNumber);
          assignToIds = [empDetails.id];
        }
        
        const userId = assignToIds.length > 0 ? assignToIds[0] : '';
        const userEmployee = getEmployeeByMongoId(employeesData, userId);
        const employeeName = getEmployeeName(userEmployee);
        
        // Get companyId
        const empDetails = getEmployeeDetails(employeesData, item.employeeNumber);
        let companyId = item.companyId || empDetails.companyId;
        if (!companyId) {
          const objDoc = objectivesData.find(o => o.objectiveID === objectiveID);
          if (objDoc && objDoc.companyId) companyId = objDoc.companyId;
        }
        
        tasks.push({
          title: item.title ?? item.taskName ?? item.name ?? '',
          description: item.description || '',
          startDate: item.startDate || item.dueDate || new Date(),
          dueDate: item.dueDate || item.startDate || new Date(),
          actualCompletionDate: item.actualCompletionDate || null,
          linkToKR: krID,
          assignTo: assignToIds,
          priority: item.priority || 'High Level',
          comments: item.comments || '',
          attachments: item.attachments || '',
          krReferenceId: krIdToMongoId[krID] || '',
          estimationEffort: item.estimationEffort || '',
          actualEffort: item.actualEffort || '',
          status: item.status || 'notstarted',
          recurrence: !!item.recurrence,
          recurrenceDetails: item.recurrenceDetails || null,
          mainTask: item.mainTask || null,
          progressStatus: typeof item.progressStatus === 'number' ? item.progressStatus : (item.krProgress ? Number(item.krProgress) : 0),
          companyId: companyId,
          userId: userId,
          employeeName: employeeName,
          owner: employeeName,
          uploadBatchId: uploadBatchId
        });
      }
    });
    
    console.log('Tasks to insert:', JSON.stringify(tasks, null, 2));
    
    if (tasks.length > 0) {
      await TasksModel.insertMany(tasks);
    }
    
    // Create upload record if fileMeta is provided (bulk upload)
    if (fileMeta) {
      try {
        await OKRUploadModel.create({
          companyId: companyId,
          filename: fileMeta.filename || 'bulk-upload.xlsx',
          s3Url: fileMeta.s3Url,
          fileSize: fileMeta.fileSize,
          status: 'completed',
          objectivesCount: objectives.length,
          keyResultsCount: keyResults.length,
          tasksCount: tasks.length,
          uploadBatchId: uploadBatchId,
          createdBy: req.user?.id || req.user?._id,
          createdByName: req.user?.name
        });
      } catch (uploadErr) {
        console.error('Error creating upload record:', uploadErr);
      }
    }
    
    res.status(200).send(
      successResponse({
        message: "Objectives, Key Results, and Tasks Created Successfully!",
        data: {
          objectivesCreated: objectives.length,
          keyResultsCreated: keyResults.length,
          tasksCreated: tasks.length,
          uploadBatchId: uploadBatchId
        }
      })
    );
  } catch (err) {
    console.error('Error in createObjectivesAndKeyResults:', err);
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Objectives, Key Results, and Tasks Not Created!",
      })
    );
  }
};

// Helper functions
function getEmployeeById(employeesData, employeeNumber) {
  return employeesData.find(emp => 
    emp.employmentInformation?.employeeNumber === employeeNumber
  );
}

function getEmployeeByMongoId(employeesData, employeeId) {
  return employeesData.find(emp => emp._id.toString() === employeeId);
}

function getEmployeeName(employee) {
  if (!employee || !employee.personalInformation) return '';
  const firstName = employee.personalInformation.firstName || '';
  const lastName = employee.personalInformation.lastName || '';
  return `${firstName} ${lastName}`.trim();
}

function getEmployeeDetails(employeesData, employeeNumber) {
  const employee = getEmployeeById(employeesData, employeeNumber);
  if (!employee) return { id: employeeNumber, name: '', companyId: '' };
  
  return {
    id: employee._id.toString(),
    name: getEmployeeName(employee),
    companyId: employee.companyId || ''
  };
}

function getObjectiveName(items, objectiveID) {
  const objective = items.find(item => item.type === 'obj' && item.objectiveID === objectiveID);
  return objective ? (objective.objective ?? objective.title ?? objective.name ?? '') : '';
}

function findKrIdForTask(item, index, items, newKrIdMap) {
  let krID = item.krID;
  let objectiveID = item.objectiveID;
  
  // Check if krID is a simple number (like 1), treat it as a temporary reference
  if (krID && (typeof krID === 'number' || (typeof krID === 'string' && !krID.startsWith('KR_')))) {
    const tempKrID = item.KRObjectiveID || objectiveID;
    if (tempKrID && newKrIdMap[tempKrID]) {
      return { krID: newKrIdMap[tempKrID], objectiveID };
    }
    
    // Find the most recent KR before this task in the items array
    for (let i = index - 1; i >= 0; i--) {
      if (items[i].type === 'kr' && items[i].krID) {
        return { 
          krID: items[i].krID, 
          objectiveID: objectiveID || items[i].objectiveID 
        };
      }
    }
  }
  
  // If still no krID, try to find by KRObjectiveID mapping
  if (!krID && item.KRObjectiveID && newKrIdMap[item.KRObjectiveID]) {
    return { krID: newKrIdMap[item.KRObjectiveID], objectiveID };
  }
  
  // Find KR by matching with previous items if still not found
  if (!krID && objectiveID) {
    const relatedKR = items.find(i => i.type === 'kr' && i.objectiveID === objectiveID);
    if (relatedKR && relatedKR.krID) {
      return { krID: relatedKR.krID, objectiveID };
    }
  }
  
  return { krID: krID || null, objectiveID };
}


const copyObjectives = async (req, res) => {
  // #swagger.tags = ['OKR Management']
  try {
    const items = req.body;
    var objectivesData = [];
    var taskResultsData = [];
    items.objectiveIds.forEach((item) => {
      objectivesData.push({
        updateOne: {
          filter: { _id: item },
          update: {
            $set: {
              employeeReferenceId: items.employeeReferenceId,
              employeeName: items.employeeName,
              owner: items.employeeName
            },
          },
          upsert: true,
        },
      });
    });
    items.taskIds.forEach((item) => {
      taskResultsData.push({
        updateOne: {
          filter: { _id: item._id },
          update: {
            $set: {
              assignTo: [items.employeeReferenceId],
              krReferenceId: item.krReferenceId,
            },
          },
          upsert: true,
        },
      });
    });
    await ObjectivesModel.bulkWrite(objectivesData, { ordered: false });
    await TasksModel.bulkWrite(taskResultsData, { ordered: false });
    res.status(200).send(
      successResponse({
        message: "Copied OKR Data Successfully!",
      })
    );
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Objectives And Key Results Not Copied!",
      })
    );
  }
};

const updateOkrTab = async (req, res) => {
  // #swagger.tags = ['OKR Management']
  try {
    const tasks = await OkrTabModel.findById(req.params.id);
    if (tasks) {

      OkrTabModel.findByIdAndUpdate(req.params.id, req.body, (err) => {
        if (!err) {
          res.status(200).send(
            successResponse({
              message: "OkrTab Updated Successfully!",
            })
          );
        }
      });
    }
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "OkrTab Not Updated!",
      })
    );
  }
};

module.exports = {
  deleteOkrTab,
  createObjectivesAndKeyResults,
  deleteOkrTabs,
  createOkrTab,
  updateOkrTab,
  getAllOkrTab,
  copyObjectives
};
