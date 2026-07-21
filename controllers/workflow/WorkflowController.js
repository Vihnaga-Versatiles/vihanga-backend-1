const WorkflowModel = require("../../models/recruitment/workflow/workflowModel");
const {
  successResponse,
  errorResponse,
} = require("../../utils/recruitment/responseHandler");


const createWorkflow = async (req, res) => {
  try {
    const data = {
      ...req.body,
    };

    // Removed duplicate workflow validation - allowing multiple workflows per transaction type

    const newWorkflow = await WorkflowModel.create(data);

    return successResponse(res, newWorkflow, "Workflow created successfully");
  } catch (error) {
    return errorResponse(res, error);
  }
};

const getAllWorkflows = async (req, res) => {
  try {
    const { companyId } = req.query;

    if (!companyId) {
      return errorResponse(res, "Company ID is required", 400);
    }

    const workflows = await WorkflowModel.find({ companyId }).sort({ createdAt: -1 }); // optional sorting by latest

    return successResponse(res, workflows, "Workflows retrieved successfully");
  } catch (error) {
    return errorResponse(res, error);
  }
};


const updateWorkflow = async (req, res) => {
  try {
    const { companyId } = req.query;
    const workflowId = req.query.id;
    const updateData = req.body;

    if (!companyId) {
      return errorResponse(res, "Company ID is required", 400);
    }

    if (!workflowId) {
      return errorResponse(res, "Workflow ID is required in query", 400);
    }

    const updatedWorkflow = await WorkflowModel.findOneAndUpdate(
      { _id: workflowId, companyId },
      updateData,
      { new: true, runValidators: true }
    );

    if (!updatedWorkflow) {
      return errorResponse(res, "Workflow not found", 404);
    }

    return successResponse(
      res,
      updatedWorkflow,
      "Workflow updated successfully"
    );
  } catch (error) {
    return errorResponse(res, error);
  }
};


const getWorkflowById = async (req, res) => {
  try {
    const { companyId } = req.query;
    const workflowId = req.query.id;

    if (!companyId) {
      return errorResponse(res, "Company ID is required", 400);
    }

    if (!workflowId) {
      return errorResponse(res, "Workflow ID is required in query", 400);
    }

    const workflow = await WorkflowModel.findOne({ _id: workflowId, companyId });

    if (!workflow) {
      return errorResponse(res, "Workflow not found", 404);
    }

    return successResponse(res, workflow, "Workflow retrieved successfully");
  } catch (error) {
    return errorResponse(res, error);
  }
};


const deleteWorkflow = async (req, res) => {
  try {
    const { companyId } = req.query;
    const workflowId = req.query.id;

    console.log("company id",companyId)
    if (!companyId) {
      return errorResponse(res, "Company ID is required", 400);
    }

    if (!workflowId) {
      return errorResponse(res, "Workflow ID is required in query", 400);
    }

    const deletedWorkflow = await WorkflowModel.findOneAndDelete({
      _id: workflowId,
      companyId
    });

    if (!deletedWorkflow) {
      return errorResponse(res, "Workflow not found", 404);
    }

    return successResponse(
      res,
      deletedWorkflow,
      "Workflow deleted successfully"
    );
  } catch (error) {
    return errorResponse(res, error);
  }
};


module.exports = {
  createWorkflow,
  getAllWorkflows,
  updateWorkflow,
  getWorkflowById,
  deleteWorkflow,
};
