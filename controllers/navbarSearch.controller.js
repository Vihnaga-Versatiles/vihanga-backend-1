const KeyResultsModel = require("../models/keyResults.model");
const ObjectivesModel = require("../models/objectives.model");
const TasksModel = require("../models/tasks.model");
const EmployeesModel = require("../models/employee.model");

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

const getSearchBarData = async (req, res) => {
  // #swagger.tags = ['Navbar Search']
  try {
    let objj = req.params.role == "Super Admin" || req.params.role == "Manager" || req.params.role == "HR Admin" ? { objective: { $regex: `${req.params.keyword}`, $options: "i" } } : { $and: [{ employeeReferenceId: req.params.userId }, { objective: { $regex: `${req.params.keyword}`, $options: "i" } }] }
    const objectives = await ObjectivesModel.find(objj).sort({ _id: -1 });
    const keyResults = await KeyResultsModel.find({ keyResultName: { $regex: `${req.params.keyword}`, $options: "i" } }).sort({ _id: -1 });
    const employees = await EmployeesModel.find({ "employmentInformation.status": "Active", $or: [{ "personalInformation.firstName": { $regex: `${req.params.keyword}`, $options: "i" } }, { "personalInformation.lastName": { $regex: `${req.params.keyword}`, $options: "i" } }] }).sort({ _id: -1 });
    const tasks = await TasksModel.find({ title: { $regex: `${req.params.keyword}`, $options: "i" } }).sort({ _id: -1 });
    const finalKeyResults = keyResults.filter((item) => {
      const data = objectives.filter((itemTask) => {
        if (itemTask._id.toString() === item.objectiveId) {
          return true
        }
      })
      if (data.length > 0) {
        return true
      }
    })
    const finalTasks = tasks.filter((item) => {
      const data = item.assignTo.filter((itemTasks) => {
        if (itemTasks === req.params.userId) {
          return true
        }
      })
      if (data.length > 0) {
        return true
      }
    })
    const finalEmployees = req.params.role === 'Employee' ? employees.filter((item) => item._id.toString() === req.params.userId) : employees
    res.status(200).send(
      successResponse({
        message: "Data Retrieved Successfully!",
        data: {
          objectives: objectives, keyResults: finalKeyResults, tasks: finalTasks, employees: finalEmployees
        }
      })
    );
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Data Not Fetched!",
      })
    );
  }
};

module.exports = {
  getSearchBarData
};
