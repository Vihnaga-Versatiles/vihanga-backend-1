const Employee = require('../../models/employee.model');
const {
  successResponse,
  errorResponse,
} = require("../../utils/recruitment/responseHandler");

// Create Exit Interview for an employee
const createExitInterview = async (req, res) => {
  try {
    const { employeeId, companyId, q1, q2, q3, q4, q5, q6 } = req.body;

    if (!employeeId) {
      return errorResponse(res, "Employee ID is required", 400);
    }

    const exitInterviewData = {
      q1,
      q2,
      q3,
      q4,
      q5,
      q6
    };

    const employee = await Employee.findOneAndUpdate(
      { _id: employeeId, companyId },
      { exitInterview: exitInterviewData },
      { new: true }
    );

    if (!employee) {
      return errorResponse(res, "Employee not found or not authorized", 404);
    }

    return successResponse(res, employee.exitInterview, "Exit interview submitted successfully");
  } catch (error) {
    return errorResponse(res, error);
  }
};

// Get All Exit Interviews for a company
const getAllExitInterViews = async (req, res) => {
  try {
    const { companyId } = req.query;

    if (!companyId) {
      return errorResponse(res, "Company ID is required", 400);
    }

    const employees = await Employee.find({
      companyId,
      "exitInterview": { $exists: true, $ne: null }
    });

    const exitInterviews = employees.map(emp => ({
      employeeId: emp._id,
      employeeName: `${emp.personalInformation.firstName} ${emp.personalInformation.lastName}`,
      employeeNumber: emp.employmentInformation.employeeNumber,
      exitInterview: emp.exitInterview,
      createdAt: emp.updatedAt // Since exitInterview is embedded, use updatedAt
    }));

    return successResponse(res, exitInterviews, "Exit interviews retrieved successfully");
  } catch (error) {
    return errorResponse(res, error);
  }
};

// Get Single Exit Interview by Employee ID
const getExitInterViewById = async (req, res) => {
  try {
    const { id, companyId } = req.query;

    if (!id) {
      return errorResponse(res, "Employee ID is required", 400);
    }

    if (!companyId) {
      return errorResponse(res, "Company ID is required", 400);
    }

    const employee = await Employee.findOne({ _id: id, companyId });

    if (!employee) {
      return errorResponse(res, "Employee not  found", 404);
    }

    return successResponse(res, employee, "Exit interview retrieved successfully");
  } catch (error) {
    return errorResponse(res, error);
  }
};

// Update Exit Interview for an employee
const updateExitInterView = async (req, res) => {
  try {
    const { id, companyId } = req.query;
    const { q1, q2, q3, q4, q5, q6 } = req.body;

    if (!id) {
      return errorResponse(res, "Employee ID is required", 400);
    }

    if (!companyId) {
      return errorResponse(res, "Company ID is required", 400);
    }

    const updateData = {};
    if (q1 !== undefined) updateData["exitInterview.q1"] = q1;
    if (q2 !== undefined) updateData["exitInterview.q2"] = q2;
    if (q3 !== undefined) updateData["exitInterview.q3"] = q3;
    if (q4 !== undefined) updateData["exitInterview.q4"] = q4;
    if (q5 !== undefined) updateData["exitInterview.q5"] = q5;
    if (q6 !== undefined) updateData["exitInterview.q6"] = q6;

    const employee = await Employee.findOneAndUpdate(
      { _id: id, companyId },
      { $set: updateData },
      { new: true }
    );

    if (!employee || !employee.exitInterview || !employee.exitInterview.q1) {
      return errorResponse(res, "Exit interview not found", 404);
    }

    return successResponse(res, employee.exitInterview, "Exit interview updated successfully");
  } catch (error) {
    return errorResponse(res, error);
  }
};

// Delete Exit Interview for an employee
const deleteExitInterView = async (req, res) => {
  try {
    const { id, companyId } = req.query;

    if (!id) {
      return errorResponse(res, "Employee ID is required", 400);
    }

    if (!companyId) {
      return errorResponse(res, "Company ID is required", 400);
    }

    const employee = await Employee.findOneAndUpdate(
      { _id: id, companyId },
      { $unset: { exitInterview: "" } },
      { new: true }
    );

    if (!employee) {
      return errorResponse(res, "Exit interview not found", 404);
    }

    return successResponse(res, {}, "Exit interview deleted successfully");
  } catch (error) {
    return errorResponse(res, error);
  }
};

module.exports = {
  createExitInterview,
  getAllExitInterViews,
  getExitInterViewById,
  updateExitInterView,
  deleteExitInterView,
};
