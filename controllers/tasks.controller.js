const { isValidDate } = require("../helpers/percentageCalculation");
const TasksModel = require("../models/tasks.model");
const moment = require("moment");
const EmployModel = require("../models/employee.model");

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

const createTask = async (req, res) => {
  // #swagger.tags = ['Tasks']
  try {
    let requestBody = {
      title: req.body.title,
      description: req.body.description,
      startDate: isValidDate(req.body.startDate) ? req.body.startDate : null,
      dueDate: isValidDate(req.body.dueDate) ? req.body.dueDate : null,
      actualCompletionDate: isValidDate(req.body.actualCompletionDate) ? req.body.actualCompletionDate : null,
      linkToKR: req.body.linkToKR,
      assignTo: req.body.assignTo,
      priority: req.body.priority,
      comments: req.body.comments,
      attachments: req.body.attachments,
      krReferenceId: req.body.krReferenceId,
      estimationEffort: req.body.estimationEffort,
      actualEffort: req.body.actualEffort,
      status: req.body.status ? req.body.status : "notstarted",
      recurrence: req.body.recurrence,
      recurrenceDetails: req.body.recurrenceDetails
    };
    let repeatedObjects = [requestBody];
    if (requestBody.recurrence) {
      let repeatMode = requestBody.recurrenceDetails.repeat;
      let repeatTimes = requestBody.recurrenceDetails.every;
      let repeatDays = requestBody.recurrenceDetails.onDays;
      let endDate = requestBody.recurrenceDetails.endDate;
      let newRequestBody = { ...requestBody };
      delete newRequestBody.recurrence;
      delete newRequestBody.recurrenceDetails;
      if (repeatTimes === 1) {
        let index = 0;
        var start = moment(newRequestBody.startDate, "YYYY-MM-DD");
        var end = moment(endDate, "YYYY-MM-DD");
        for (let current = start; current <= end; current.add(1, 'days')) {
          let day = current.format("YYYY-MM-DD");
          if (repeatMode === "Week" && repeatDays.includes(new Date(day).getDay())) {
            let newRequestBody = { ...requestBody };
            delete newRequestBody.recurrence;
            delete newRequestBody.recurrenceDetails;
            newRequestBody.startDate = day;
            newRequestBody.dueDate = day;
            repeatedObjects.push(newRequestBody)
          }
          if (repeatMode === "Month" && repeatDays.includes(new Date(day).getDay())) {
            index = index + 1;
            if (index % 4 === 1) {
              let newRequestBody = { ...requestBody };
              delete newRequestBody.recurrence;
              delete newRequestBody.recurrenceDetails;
              newRequestBody.startDate = day;
              newRequestBody.dueDate = day;
              repeatedObjects.push(newRequestBody)
            }
          }
          if (repeatMode === "Quarter" && repeatDays.includes(new Date(day).getDay())) {
            index = index + 1;
            if (index % 12 === 1) {
              let newRequestBody = { ...requestBody };
              delete newRequestBody.recurrence;
              delete newRequestBody.recurrenceDetails;
              newRequestBody.startDate = day;
              newRequestBody.dueDate = day;
              repeatedObjects.push(newRequestBody)
            }
          }
        }
      } else if (repeatTimes === 2) {
        let index = 0;
        let index2 = 0;
        var start = moment(newRequestBody.startDate, "YYYY-MM-DD");
        var end = moment(endDate, "YYYY-MM-DD");
        for (let current = start; current <= end; current.add(1, 'days')) {
          let day = current.format("YYYY-MM-DD");
          if (repeatMode === "Week" && repeatDays.includes(new Date(day).getDay())) {
            index = index + 1;
            if (index % 2 === 1) {
              let newRequestBody = { ...requestBody };
              delete newRequestBody.recurrence;
              delete newRequestBody.recurrenceDetails;
              newRequestBody.startDate = day;
              newRequestBody.dueDate = day;
              repeatedObjects.push(newRequestBody)
            }
          }
        }
        if (repeatMode === "Month" && repeatDays.includes(new Date(day).getDay())) {
          index = index + 1;
          if (index % 4 === 1) {
            index2 = index2 + 1;
            if (index2 % 2 === 1) {
              let newRequestBody = { ...requestBody };
              delete newRequestBody.recurrence;
              delete newRequestBody.recurrenceDetails;
              newRequestBody.startDate = day;
              newRequestBody.dueDate = day;
              repeatedObjects.push(newRequestBody)
            }
          }
        }
        if (repeatMode === "Quarter" && repeatDays.includes(new Date(day).getDay())) {
          index = index + 1;
          if (index % 12 === 1) {
            index2 = index2 + 1;
            if (index2 % 2 === 1) {
              let newRequestBody = { ...requestBody };
              delete newRequestBody.recurrence;
              delete newRequestBody.recurrenceDetails;
              newRequestBody.startDate = day;
              newRequestBody.dueDate = day;
              repeatedObjects.push(newRequestBody)
            }
          }
        }
      } else if (repeatTimes === 3) {
        let index = 0;
        let index2 = 0;
        var start = moment(newRequestBody.startDate, "YYYY-MM-DD");
        var end = moment(endDate, "YYYY-MM-DD");
        for (let current = start; current <= end; current.add(1, 'days')) {
          let day = current.format("YYYY-MM-DD");
          if (repeatMode === "Week" && repeatDays.includes(new Date(day).getDay())) {
            index = index + 1;
            if (index % 3 === 1) {
              let newRequestBody = { ...requestBody };
              delete newRequestBody.recurrence;
              delete newRequestBody.recurrenceDetails;
              newRequestBody.startDate = day;
              newRequestBody.dueDate = day;
              repeatedObjects.push(newRequestBody)
            }
          }
          if (repeatMode === "Month" && repeatDays.includes(new Date(day).getDay())) {
            index = index + 1;
            if (index % 4 === 1) {
              index2 = index2 + 1;
              if (index2 % 3 === 1) {
                let newRequestBody = { ...requestBody };
                delete newRequestBody.recurrence;
                delete newRequestBody.recurrenceDetails;
                newRequestBody.startDate = day;
                newRequestBody.dueDate = day;
                repeatedObjects.push(newRequestBody)
              }
            }
          }
          if (repeatMode === "Quarter" && repeatDays.includes(new Date(day).getDay())) {
            index = index + 1;
            if (index % 12 === 1) {
              index2 = index2 + 1;
              if (index2 % 3 === 1) {
                let newRequestBody = { ...requestBody };
                delete newRequestBody.recurrence;
                delete newRequestBody.recurrenceDetails;
                newRequestBody.startDate = day;
                newRequestBody.dueDate = day;
                repeatedObjects.push(newRequestBody)
              }
            }
          }
        }
      } else if (repeatTimes === 4) {
        let index = 0;
        let index2 = 0;
        var start = moment(newRequestBody.startDate, "YYYY-MM-DD");
        var end = moment(endDate, "YYYY-MM-DD");
        for (let current = start; current <= end; current.add(1, 'days')) {
          let day = current.format("YYYY-MM-DD");
          if (repeatMode === "Week" && repeatDays.includes(new Date(day).getDay())) {
            index = index + 1;
            if (index % 4 === 1) {
              let newRequestBody = { ...requestBody };
              delete newRequestBody.recurrence;
              delete newRequestBody.recurrenceDetails;
              newRequestBody.startDate = day;
              newRequestBody.dueDate = day;
              repeatedObjects.push(newRequestBody)
            }
          }
          if (repeatMode === "Month" && repeatDays.includes(new Date(day).getDay())) {
            index = index + 1;
            if (index % 4 === 1) {
              index2 = index2 + 1;
              if (index2 % 4 === 1) {
                let newRequestBody = { ...requestBody };
                delete newRequestBody.recurrence;
                delete newRequestBody.recurrenceDetails;
                newRequestBody.startDate = day;
                newRequestBody.dueDate = day;
                repeatedObjects.push(newRequestBody)
              }
            }
          }

          if (repeatMode === "Quarter" && repeatDays.includes(new Date(day).getDay())) {
            index = index + 1;
            if (index % 12 === 1) {
              index2 = index2 + 1;
              if (index2 % 4 === 1) {
                let newRequestBody = { ...requestBody };
                delete newRequestBody.recurrence;
                delete newRequestBody.recurrenceDetails;
                newRequestBody.startDate = day;
                newRequestBody.dueDate = day;
                repeatedObjects.push(newRequestBody)
              }
            }
          }
        }
      }
      repeatedObjects = repeatedObjects.filter((item, index) => index !== 1);
    }
    await TasksModel.insertMany(repeatedObjects).then((result, err) => {
      if (!err) {
        res.status(200).send(
          successResponse({
            message: "Task Created Successfully!",
            data: result[0]
          })
        );
      } else {
        res.status(500).send(
          failResponse({
            message: "Task Not Created!",
          })
        );
      }
    })
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Task Not Created!",
      })
    );
  }
};

const getAllTasks = async (req, res) => {
  // #swagger.tags = ['Tasks']
  try {
    const Tasks = await TasksModel.find({}).sort({ _id: -1 });
    res.status(200).send(
      successResponse({
        message: "Tasks Retrieved Successfully!",
        data: Tasks,
      })
    );
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Tasks Not Fetched!",
      })
    );
  }
};

const getTasksByID = async (req, res) => {
  // #swagger.tags = ['Tasks']
  try {
    const Tasks = await TasksModel.find({}).sort({ _id: -1 });
    const userData = Tasks.filter((item) => {
      const data = item.assignTo.filter((itemTasks) => {
        if (itemTasks && itemTasks.length > 0 && itemTasks.includes(req.params.id)) {
          return true
        }
      })
      if (data.length > 0) {
        return true
      }
    })
    res.status(200).send(
      successResponse({
        message: "Tasks Retrieved Successfully!",
        data: userData,
      })
    );
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Tasks Not Fetched!",
      })
    );
  }
};

const getTasksByRole = async (req, res) => {
  // #swagger.tags = ['Tasks']
  try {
    const Employees = await EmployModel.find({ "employmentInformation.status": "Active" }).sort({ _id: -1 })
    const Tasks = await TasksModel.find({}).sort({ _id: -1 });
    const myTeam = Employees.filter((item) => item.employmentInformation.lineManager === req.params.id)
    const myteamTasks = Tasks.filter((item) => {
      const data = myTeam.filter((item2) => item2._id.toString() === item.assignTo[0])
      if (data.length > 0) {
        return true
      }
    })
    res.status(200).send(
      successResponse({
        message: "Tasks Retrieved Successfully!",
        data: {
          myTeam: myTeam,
          myteamTasks: myteamTasks
        },
      })
    );
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Tasks Not Fetched!",
      })
    );
  }
};


const deleteTask = (req, res) => {
  // #swagger.tags = ['Tasks']
  TasksModel.findByIdAndRemove({ _id: req.params.id }, (err) => {
    if (!err) {
      res.status(200).send(
        successResponse({
          message: "Task Deleted Successfully!",
        })
      );
    } else {
      res.status(500).send(
        failResponse({
          message: err ? err.message : "Task Not Deleted!",
        })
      );
    }
  });
};



const updateTask = async (req, res) => {
  // #swagger.tags = ['Tasks']
  try {
    const tasks = await TasksModel.findById(req.params.id);
    if (tasks) {

      TasksModel.findByIdAndUpdate(req.params.id, req.body, (err) => {
        if (!err) {
          res.status(200).send(
            successResponse({
              message: "Task Updated Successfully!",
            })
          );
        }
      });
    }
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Task Not Updated!",
      })
    );
  }
};


const deleteTasks = (req, res) => {
  // #swagger.tags = ['Tasks']
  TasksModel.deleteMany({ _id: { $in: req.body.data } }, (err) => {
    if (!err) {
      res.status(200).send(
        successResponse({
          message: "Tasks Deleted Successfully!",
        })
      );
    } else {
      res.status(500).send(
        failResponse({
          message: err ? err.message : "Tasks Not Deleted!",
        })
      );
    }
  });

};


const UpdateMultipleTasks = async (req, res) => {
  // #swagger.tags = ['Tasks']
  try {
    const items = req.body.data;
    var ops = [];
    items.forEach(item => {
      if (item._id) {
        ops.push(
          {
            updateOne: {
              filter: { _id: item._id },
              update: {
                $set: {
                  status: item.status
                },
              },
              upsert: true
            }
          }
        );
      }
    })
    await TasksModel.bulkWrite(ops, { ordered: false });
    res.status(200).send(
      successResponse({
        message: 'Tasks Updated Successfully!',
      })
    );
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Tasks Not Updated!"
      })
    );
  }
};

const copyTask = async (req, res) => {
  // #swagger.tags = ['Tasks']
  try {
    const originalTask = await TasksModel.findById(req.params.id);
    if (!originalTask) {
      return res.status(404).send(
        failResponse({
          message: "Task Not Found!",
        })
      );
    }

    // Create a copy of the task with the same data but new ID
    const taskCopy = {
      title: originalTask.title,
      description: originalTask.description,
      startDate: originalTask.startDate,
      dueDate: originalTask.dueDate,
      actualCompletionDate: originalTask.actualCompletionDate,
      linkToKR: originalTask.linkToKR,
      assignTo: originalTask.assignTo,
      priority: originalTask.priority,
      comments: originalTask.comments,
      attachments: originalTask.attachments,
      krReferenceId: originalTask.krReferenceId,
      estimationEffort: originalTask.estimationEffort,
      actualEffort: originalTask.actualEffort,
      status: originalTask.status,
      recurrence: originalTask.recurrence,
      recurrenceDetails: originalTask.recurrenceDetails,
      userId: originalTask.userId
    };

    const newTask = await TasksModel.create(taskCopy);
    res.status(200).send(
      successResponse({
        message: "Task Copied Successfully!",
        data: newTask
      })
    );
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Task Not Copied!",
      })
    );
  }
};


module.exports = {
  deleteTask,
  createTask,
  updateTask,
  getAllTasks,
  getTasksByID,
  deleteTasks,
  getTasksByRole,
  UpdateMultipleTasks,
  copyTask
};
