const Employee = require("../../models/employee.model");
const {
  successResponse,
  errorResponse,
} = require("../../utils/recruitment/responseHandler");
const { sendEmail } = require("../../middlewares/recruitment/sendMail");
const WorkflowModel = require("../../models/recruitment/workflow/workflowModel");
const { CLIENTURL } = require("../../config/environment");

// Helper to get approver details (adapted from Leaves.controller.js)
const getApproverDetails = async (approverId, employee, companyId) => {
  try {
    switch (approverId) {
      case 'line_manager':
        if (employee.employmentInformation && employee.employmentInformation.lineManager) {
          const lineManager = await Employee.findById(employee.employmentInformation.lineManager);
          return {
            approverType: 'Line Manager',
            approverDetails: lineManager,
            approverId: employee.employmentInformation.lineManager
          };
        }
        return null;
      case 'hr_manager':
        const hrManager = await Employee.findOne({
          companyId: companyId,
          'employmentInformation.role': 'HR Admin',
          'employmentInformation.status': 'Active'
        });
        return {
          approverType: 'HR Manager',
          approverDetails: hrManager,
          approverId: hrManager?._id
        };
      case 'dept_head':
        const deptHead = await Employee.findOne({
          companyId: companyId,
          'employmentInformation.department': employee.employmentInformation?.department,
          'employmentInformation.departmentHead': 'Yes',
          'employmentInformation.status': 'Active'
        });
        return {
          approverType: 'Functional Head',
          approverDetails: deptHead,
          approverId: deptHead?._id
        };
      case 'ceo':
        const ceo = await Employee.findOne({
          companyId: companyId,
          'employmentInformation.role': 'Super Admin',
          'employmentInformation.status': 'Active'
        });
        return {
          approverType: 'CEO',
          approverDetails: ceo,
          approverId: ceo?._id
        };
      case 'finance_director':
        const financeDirector = await Employee.findOne({
          companyId: companyId,
          'employmentInformation.department': 'Finance',
          'employmentInformation.role': 'Manager',
          'employmentInformation.status': 'Active'
        });
        return {
          approverType: 'Finance Director',
          approverDetails: financeDirector,
          approverId: financeDirector?._id
        };
      case 'project_manager':
        const projectManager = await Employee.findOne({
          companyId: companyId,
          'employmentInformation.role': 'Manager',
          'employmentInformation.status': 'Active'
        });
        return {
          approverType: 'Project Manager',
          approverDetails: projectManager,
          approverId: projectManager?._id
        };
      default:
        return null;
    }
  } catch (error) {
    console.error('Error getting approver details:', error);
    return null;
  }
};

const createResignationForm = async (req, res) => {
  try {
    const { fullName,employeeNumber, employeeId, companyId, reasonForResignation, lastDayOfWorking, notifiedDate } = req.body;
    const findEmployee = await Employee.findOne({ _id: employeeId, companyId:companyId });
    if (!findEmployee) {
      return errorResponse(res, { message: "Employee not found under this company" }, 404);
    }
    if (findEmployee.resignation && findEmployee.resignation.overallStatus === "Pending") {
       return errorResponse(res, { message: "A resignation request is already pending for this employee." }, 400);
    }
    // Fetch workflow for resignation
    const workflow = await WorkflowModel.findOne({
      companyId,
      "transactionType.id": "resignation_request"
    });
    if (!workflow || !workflow.approvalChain) {
      return errorResponse(res, { message: "No workflow defined for resignation requests in this company." }, 400);
    }
    // Build approver levels and current approvers
    let approverLevels = new Map();
    let currentApprovers = [];
    for (const [level, approvers] of Object.entries(workflow.approvalChain)) {
      const levelApprovers = [];
      for (const approverData of approvers) {
        const approverInfo = await getApproverDetails(approverData.id, findEmployee, companyId);
        if (approverInfo && approverInfo.approverDetails) {
          const approverEntry = {
            approverId: approverInfo.approverId,
            approverType: approverInfo.approverType,
            approverName: `${approverInfo.approverDetails.personalInformation?.firstName} ${approverInfo.approverDetails.personalInformation?.lastName}`,
            approverEmail: approverInfo.approverDetails.contactInformation?.email,
            status: 'pending'
          };
          levelApprovers.push(approverEntry);
        }
      }
      if (levelApprovers.length > 0) {
        approverLevels.set(level, {
          status: 'pending',
          approvers: levelApprovers
        });
        if (level === "0") {
          currentApprovers = levelApprovers.map(approver => ({
            approverId: approver.approverId,
            approverType: approver.approverType,
            approverName: approver.approverName,
            approverEmail: approver.approverEmail,
            level: level
          }));
        }
      }
    }
    // Employee info for notifications
    const employeeInfo = {
      name: fullName,
      email: findEmployee.contactInformation?.email,
      department: findEmployee.employmentInformation?.department,
      position: findEmployee.employmentInformation?.position
    };
    // Prepare resignation data
    const resignationData = {
      fullName,
      employeeNumber: employeeNumber,
      reasonForResignation,
      lastDayOfWorking,
      notifiedDate,
      uploadAttachments: req.file ? req.file.path : null,
      approverLevels,
      currentLevel: "0",
      currentApprovers,
      approvalHistory: [],
      overallStatus: "Pending",
      companyId,
      employeeInfo
    };
    // Save resignation data
    const employee = await Employee.findByIdAndUpdate(
      employeeId,
      { resignation: resignationData },
      { new: true }
    );
    if (!employee) {
      return errorResponse(res, { message: "Employee not found" }, 404);
    }
    // Send email to first approver(s)
    for (const approver of currentApprovers) {
      if (approver.approverEmail) {
        try {
          // Format dates for email display
          const formatDate = (dateStr) => {
            const date = new Date(dateStr);
            return date.toLocaleDateString('en-GB', {
              day: '2-digit',
              month: 'short',
              year: 'numeric'
            });
          };

          await sendEmail(
            approver.approverEmail,
            `Resignation Approval Required - ${employeeInfo.name}`,
            {
              name: approver.approverName,
              resignationApproval: true,
              resignationDetails: {
                employeeName: employeeInfo.name,
                employeeEmail: employeeInfo.email,
                reason: reasonForResignation,
                lastDayOfWorking: formatDate(lastDayOfWorking),
                notifiedDate: formatDate(notifiedDate),
                approvalLink: `${CLIENTURL}/admin/previlages/resignation-form`
              }
            },
            true
          );
        } catch (emailError) {
          console.error('Failed to send resignation approval email:', emailError);
        }
      }
    }
    return successResponse(res, employee, "Resignation submitted successfully and sent for approval.", 201);
  } catch (error) {
    console.log("Error creating resignation form", error);
    return errorResponse(res, error);
  }
};

const getAllResignationForms = async (req, res) => {
  try {

    const { companyId, userId, type } = req.query;
    const normalizedType = (type || 'me').toString().trim().toLowerCase();

    if (!companyId) {
      return errorResponse(res, { message: "companyId is required" }, 400);
    }
    if(!userId){
      return errorResponse(res, { message: "User Is required" }, 400);
    }
    
    let filters = {
      companyId,
      resignation: { $ne: null }
    };
    
    // Determine filtering logic based on type (similar to Leaves.controller.js)
    if (normalizedType === 'me') {
      // Show ONLY own resignations
      filters._id = userId;
      console.log('INFO: Filtering resignations for current user only');
    } else if (normalizedType === 'myteam') {
      // Show team members' resignations (based on lineManager) + resignations where user is approver
      const teamMembers = await Employee.find({
        companyId,
        'employmentInformation.status': 'Active',
        'employmentInformation.lineManager': userId
      }).select('_id');
      const teamIds = teamMembers.map(m => m._id.toString());
      
      if (teamIds.length > 0) {
        // Show team members' resignations OR resignations where user is an approver
        filters.$or = [
          { _id: { $in: teamIds } },
          { 'resignation.currentApprovers.approverId': userId, 'resignation.overallStatus': 'Pending' }
        ];
      } else {
        // If no team members, only show resignations where user is approver
        filters['resignation.currentApprovers.approverId'] = userId;
        filters['resignation.overallStatus'] = 'Pending';
      }
      console.log('INFO: Filtering team member resignations and pending approvals');
    } else if (normalizedType === 'myfunction') {
      // Show function members' resignations (same department) - excluding current user's own resignations
      const currentUser = await Employee.findById(userId).select('employmentInformation.department');
      if (currentUser && currentUser.employmentInformation && currentUser.employmentInformation.department) {
        const functionMembers = await Employee.find({
          companyId,
          'employmentInformation.status': 'Active',
          'employmentInformation.department': currentUser.employmentInformation.department,
          _id: { $ne: userId } // Exclude current user
        }).select('_id');
        const functionIds = functionMembers.map(m => m._id.toString());
        if (functionIds.length > 0) {
          filters._id = { $in: functionIds };
        } else {
          // If no other function members, return empty result
          filters._id = null;
        }
        console.log('INFO: Filtering function member resignations');
      } else {
        // If no department info, return empty result
        filters._id = null;
      }
    } else if (normalizedType === 'mycompany') {
      // Company-wide resignations already scoped by companyId
      console.log('INFO: Filtering company-wide resignations');
    } else {
      // Fallback to 'me' behavior
      filters.$or = [
        { _id: userId },
        { 'resignation.currentApprovers.approverId': userId }
      ];
    }

    const employees = await Employee.find(filters).lean();

    const forms = employees.map(emp => {
      const resignation = emp.resignation;
      // approverLevels is already stored as plain object in MongoDB
      // No conversion needed, just ensure it's properly structured
      return {
        ...resignation,
        employeeId: emp._id,
        status: resignation.overallStatus || "pending"
      };
    });
    return successResponse(res, forms, "Fetched all resignation forms successfully", 200);

    
   
  } catch (error) {
    console.error("Error fetching resignation forms:", error);
    return errorResponse(res, error);
  }
};



const getResignationFormById = async (req, res) => {
  try {
    const {id,companyId} = req.query;

    if (!id || !companyId) {
      return errorResponse(res, { message: "Both id and companyId are required" }, 400);
    }

    const employee = await Employee.find({_id:id,companyId}).lean();


    if (!employee || employee.length === 0) {
      return res.status(200).json({ message: "Resignation form not found for this employee" });
    }

    // approverLevels is already stored as plain object in MongoDB
    // No conversion needed
    
    return successResponse(res, employee, "Resignation form fetched successfully", 200);
  } catch (error) {
    console.error("Error fetching resignation form by ID:", error);
    return errorResponse(res, error);
  }
};

const updateResignationForm = async (req, res) => {
  try {
    const { id, companyId } = req.query;

    if (!id || !companyId) {
      return errorResponse(res, { message: "Employee ID and Company ID are required" }, 400);
    }

    const { reasonForResignation, lastDayOfWorking, notifiedDate } = req.body;

    const updateData = {};
    if (reasonForResignation) updateData["resignation.reasonForResignation"] = reasonForResignation;
    if (lastDayOfWorking) updateData["resignation.lastDayOfWorking"] = lastDayOfWorking;
    if (notifiedDate) updateData["resignation.notifiedDate"] = notifiedDate;
    if (req.file) updateData["resignation.uploadAttachments"] = req.file.path;

    if (Object.keys(updateData).length === 0) {
      return errorResponse(res, { message: "No update fields provided" }, 400);
    }

   const employee = await Employee.findOneAndUpdate(
      { _id: id, companyId },
      { $set: updateData },
      { new: true }
    );

    if (!employee || !employee.resignation) {
      return errorResponse(res, { message: "Resignation form not found for the given ID and company" }, 404);
    }

    return successResponse(res, employee.resignation, "Resignation form updated successfully");
  } catch (error) {
    console.error("Error updating resignation form:", error);
    return errorResponse(res, error);
  }
};

const deleteResignationForm = async (req, res) => {
  try {
    const { id, companyId } = req.query;

    if (!id || !companyId) {
      return res.status(400).json({ message: "Missing 'id' or 'companyId' in query" });
    }

    const employee = await Employee.findOneAndUpdate(
      { _id: id, companyId: companyId },
      { $unset: { resignation: "" }},
      { new: true }
    );
    if (!employee) {
      return errorResponse(res, { message: "Resignation form not found for the given ID and company" }, 404);
    }
    return successResponse(res, {}, "Resignation form deleted successfully");
  } catch (error) {
    console.error("Error deleting resignation form:", error);
    return errorResponse(res, error);
  }
};

// Helper to move to next approval level (adapted from Leaves.controller.js)
const moveToNextLevel = async (employee, resignation, currentLevel) => {
  const workflow = await WorkflowModel.findOne({
    companyId: resignation.companyId,
    "transactionType.id": "resignation_request"
  });
  if (!workflow) return false;
  const nextLevel = (parseInt(currentLevel) + 1).toString();
  const nextLevelApprovers = workflow.approvalChain[nextLevel];
  if (nextLevelApprovers && nextLevelApprovers.length > 0) {
    resignation.currentLevel = nextLevel;
    // Update current approvers
    const nextApprovers = [];
    const levelData = resignation.approverLevels.get(nextLevel);
    if (levelData) {
      levelData.status = 'pending';
      nextApprovers.push(...levelData.approvers.map(approver => ({
        approverId: approver.approverId,
        approverType: approver.approverType,
        approverName: approver.approverName,
        approverEmail: approver.approverEmail,
        level: nextLevel
      })));
    }
    resignation.currentApprovers = nextApprovers;
    // Send notifications to next level approvers
    for (const approver of nextApprovers) {
      if (approver.approverEmail) {
        try {
          // Format dates for email display
          const formatDate = (dateStr) => {
            const date = new Date(dateStr);
            return date.toLocaleDateString('en-GB', {
              day: '2-digit',
              month: 'short',
              year: 'numeric'
            });
          };

          await sendEmail(
            approver.approverEmail,
            `Resignation Approval Required - ${resignation.employeeInfo.name}`,
            {
              name: approver.approverName,
              resignationApproval: true,
              resignationDetails: {
                employeeName: resignation.employeeInfo.name,
                employeeEmail: resignation.employeeInfo.email,
                reason: resignation.reasonForResignation,
                lastDayOfWorking: formatDate(resignation.lastDayOfWorking),
                notifiedDate: formatDate(resignation.notifiedDate),
                approvalLink: `${CLIENTURL}/admin/previlages/resignation-form`
              }
            },
            true
          );
        } catch (emailError) {
          console.error('Failed to send approval email:', emailError);
        }
      }
    }
    return true;
  }
  return false; // No more levels
};

const approveResignationForm = async (req, res) => {
  try {
    const { id, companyId } = req.query;
    const { approverId, status, comments } = req.body;
    if (!id || !companyId  || !approverId) {
      return errorResponse(res, { message: "Missing required fields" }, 400);
    }
    if (!["Approved", "Rejected"].includes(status)) {
      return errorResponse(res, { message: "Invalid status" }, 400);
    }
    const employee = await Employee.findOne({ _id: id, companyId });
    if (!employee || !employee.resignation) {
      return errorResponse(res, { message: "Resignation form not found" }, 404);
    }
    const resignation = employee.resignation;
    // Convert approverLevels to Map if needed
    if (!(resignation.approverLevels instanceof Map)) {
      // Check if approverLevels exists and is an object
      if (resignation.approverLevels && typeof resignation.approverLevels === 'object') {
        resignation.approverLevels = new Map(Object.entries(resignation.approverLevels));
      } else {
        return errorResponse(res, { message: "Invalid resignation workflow structure" }, 400);
      }
    }
    const currentLevelData = resignation.approverLevels.get(resignation.currentLevel);
    if (!currentLevelData) {
      return errorResponse(res, { message: "Invalid approval level" }, 400);
    }
    const approverIndex = currentLevelData.approvers.findIndex(
      app => app.approverId.toString() === approverId.toString()
    );
    if (approverIndex === -1) {
      return errorResponse(res, { message: "You are not authorized to approve this resignation at current level" }, 403);
    }
    if (currentLevelData.approvers[approverIndex].status !== 'pending') {
      return errorResponse(res, { message: `You have already ${currentLevelData.approvers[approverIndex].status} this resignation` }, 400);
    }
    // Update approver status
    currentLevelData.approvers[approverIndex].status = status.toLowerCase();
    currentLevelData.approvers[approverIndex].approvedAt = new Date();
    currentLevelData.approvers[approverIndex].comments = comments;
    // Add to approval history
    if (!resignation.approvalHistory) resignation.approvalHistory = [];
    resignation.approvalHistory.push({
      approverId: approverId,
      approverName: currentLevelData.approvers[approverIndex].approverName,
      approverType: currentLevelData.approvers[approverIndex].approverType,
      level: resignation.currentLevel,
      action: status.toLowerCase(),
      comments: comments,
      timestamp: new Date()
    });
    if (status === "Rejected") {
      resignation.overallStatus = "Rejected";
      currentLevelData.status = 'rejected';
      resignation.currentApprovers = [];
      // Send rejection notification to employee
      if (resignation.employeeInfo.email) {
        try {
          // Format dates for email display
          const formatDate = (dateStr) => {
            const date = new Date(dateStr);
            return date.toLocaleDateString('en-GB', {
              day: '2-digit',
              month: 'short',
              year: 'numeric'
            });
          };

          await sendEmail(
            resignation.employeeInfo.email,
            `Resignation Request Rejected`,
            {
              name: resignation.employeeInfo.name,
              resignationRejected: true,
              resignationDetails: {
                reason: resignation.reasonForResignation,
                lastDayOfWorking: formatDate(resignation.lastDayOfWorking),
                rejectedBy: currentLevelData.approvers[approverIndex].approverName,
                rejectionReason: comments || 'No reason provided'
              }
            },
            true
          );
        } catch (emailError) {
          console.error('Failed to send rejection email:', emailError);
        }
      }
      await Employee.findByIdAndUpdate(id, { resignation });
      return successResponse(res, resignation, "Resignation has been rejected.");
    }
    // Check if all approvers in current level have approved
    const allApproved = currentLevelData.approvers.every(app => app.status === 'approved');
    if (allApproved) {
      currentLevelData.status = 'approved';
      // Try to move to next level
      const hasNextLevel = await moveToNextLevel(employee, resignation, resignation.currentLevel);
      if (!hasNextLevel) {
        // Final approval - no more levels
        resignation.overallStatus = "Approved";
        resignation.finalApprovalDate = new Date();
        resignation.finalApprover = approverId;
        resignation.currentApprovers = [];
        // Send final approval notification to employee
        if (resignation.employeeInfo.email) {
          try {
            // Format dates for email display
            const formatDate = (dateStr) => {
              const date = new Date(dateStr);
              return date.toLocaleDateString('en-GB', {
                day: '2-digit',
                month: 'short',
                year: 'numeric'
              });
            };

            await sendEmail(
              resignation.employeeInfo.email,
              `Resignation Request Approved`,
              {
                name: resignation.employeeInfo.name,
                resignationApproved: true,
                resignationDetails: {
                  reason: resignation.reasonForResignation,
                  lastDayOfWorking: formatDate(resignation.lastDayOfWorking),
                  finalApprovedBy: currentLevelData.approvers[approverIndex].approverName
                }
              },
              true
            );
          } catch (emailError) {
            console.error('Failed to send approval email:', emailError);
          }
        }
        await Employee.findByIdAndUpdate(id, { resignation });
        return successResponse(res, resignation, "Resignation has been fully approved.");
      } else {
        await Employee.findByIdAndUpdate(id, { resignation });
        return successResponse(res, resignation, `Level ${parseInt(resignation.currentLevel)} approved. Forwarded to next level.`);
      }
    } else {
      await Employee.findByIdAndUpdate(id, { resignation });
      return successResponse(res, resignation, "Your approval recorded. Waiting for other approvers in this level.");
    }
  } catch (error) {
    console.error("Error in multi-level approval:", error);
    return errorResponse(res, error);
  }
};

module.exports = {
  createResignationForm,
  getAllResignationForms,
  getResignationFormById,
  updateResignationForm,
  deleteResignationForm,
  approveResignationForm,
};
