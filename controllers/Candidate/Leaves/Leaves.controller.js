const { uploadFileToDrive } = require("../../../middlewares/recruitment/drive");
const LeavesModel = require("../../../models/recruitment/Leaves/Leaves.model");
const LeaveTypeModel = require("../../../models/recruitment/LeaveType/LeaveType");
const EmployeeLeaveBalance = require("../../../models/recruitment/EmployeeLeaveBalance");
const WorkflowModel = require("../../../models/recruitment/workflow/workflowModel");
const { sendEmail } = require("../../../middlewares/recruitment/sendMail");
const {
  successResponse,
  errorResponse,
} = require("../../../utils/recruitment/responseHandler");
const EmployeeModel = require("../../../models/employee.model");
const EligibilityCriteriaModel = require("../../../models/recruitment/EligibilityCriteria/EligibilityCriteria");
const mongoose = require("mongoose");
const XLSX = require('xlsx');
const jwt = require("jsonwebtoken");
const { CLIENTURL, JWT_SECRET } = require("../../../config/environment");
const { getFinancialYearBounds } = require("../../../utils/financialYear");

const buildEmailLoginLink = ({ emailId, redirectPath }) => {
  const cleanEmail = (emailId || "").toString().replace(/[\r\n]/g, "").trim().toLowerCase();
  const safeRedirect = (redirectPath || "/admin/dashboard").toString().trim();
  const token = jwt.sign(
    { email: cleanEmail, fromEmail: true, purpose: "email_link_login" },
    process.env.JWT_SECRET || JWT_SECRET,
    { expiresIn: "2d" }
  );
  return `${CLIENTURL}/auth/login?fromEmail=true&emailId=${encodeURIComponent(
    cleanEmail
  )}&token=${encodeURIComponent(token)}&redirect=${encodeURIComponent(safeRedirect)}`;
};

// Helper function to calculate length of service in days with exclusions
const calculateLengthOfServiceDays = async (employee, eligibilityCriteria, companyId) => {
  const hireDate = new Date(employee.employmentInformation?.hireDate);
  const today = new Date();

  // Calculate total days
  const totalDays = Math.floor((today - hireDate) / (24 * 60 * 60 * 1000));

  const exclusions = eligibilityCriteria.lengthOfServiceExclusions || {};
  let daysToExclude = 0;

  // Exclude weekends if requested
  if (exclusions.excludeWeekends) {
    let weekendCount = 0;
    let currentDate = new Date(hireDate);
    while (currentDate <= today) {
      const dayOfWeek = currentDate.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) { // Sunday or Saturday
        weekendCount++;
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }
    daysToExclude += weekendCount;
  }

  // Exclude leaves if requested
  if (exclusions.excludeLeaves) {
    try {
      const empId = String(employee._id);
      const approvedLeaves = await LeavesModel.find({
        companyId,
        empId,
        status: 'approved',
        from: { $gte: hireDate, $lte: today }
      });

      const leaveDays = approvedLeaves.reduce((sum, leave) => {
        return sum + (parseFloat(leave.durationOfAbsence) || 0);
      }, 0);

      daysToExclude += leaveDays;
    } catch (e) {
      console.error('Error calculating leave days:', e);
    }
  }

  // Exclude public holidays if requested
  // Note: You would need a HolidaysModel to track public holidays per company
  if (exclusions.excludePublicHolidays) {
    try {
      // Assuming you have a holidays model/API
      // const holidays = await HolidaysModel.find({ companyId, date: { $gte: hireDate, $lte: today } });
      // daysToExclude += holidays.length;
      // For now, we'll skip this as the holidays model doesn't exist yet
    } catch (e) {
      console.error('Error calculating holiday days:', e);
    }
  }

  return totalDays - daysToExclude;
};

// Function to check employee eligibility for leave
const checkEligibility = async (employee, eligibilityCriteria, companyId) => {
  // Check gender eligibility
  if (eligibilityCriteria.gender &&
    eligibilityCriteria.gender.toLowerCase() !== "all" &&
    employee.personalInformation && employee.personalInformation.gender &&
    eligibilityCriteria.gender.toLowerCase() !== employee.personalInformation.gender.toLowerCase()) {
    return {
      isEligible: false,
      message: `This leave is only available for ${eligibilityCriteria.gender}`
    };
  }

  // Check age eligibility if specified
  if (eligibilityCriteria.age &&
    eligibilityCriteria.age.toLowerCase() !== "all" &&
    employee.personalInformation && employee.personalInformation.dateOfBirth) {
    const employeeAge = Math.floor((new Date() - new Date(employee.personalInformation.dateOfBirth)) / (365.25 * 24 * 60 * 60 * 1000));

    // Handle age criteria with operators like ">20", "<30", ">=25", etc.
    let isAgeEligible = true;
    const ageStr = eligibilityCriteria.age?.toString();

    if (ageStr.startsWith(">=")) {
      const requiredAge = parseInt(ageStr.substring(2));
      isAgeEligible = employeeAge >= requiredAge;
    } else if (ageStr.startsWith("<=")) {
      const requiredAge = parseInt(ageStr.substring(2));
      isAgeEligible = employeeAge <= requiredAge;
    } else if (ageStr.startsWith(">")) {
      const requiredAge = parseInt(ageStr.substring(1));
      isAgeEligible = employeeAge > requiredAge;
    } else if (ageStr.startsWith("<")) {
      const requiredAge = parseInt(ageStr.substring(1));
      isAgeEligible = employeeAge < requiredAge;
    } else {
      // Exact age match
      const requiredAge = parseInt(ageStr);
      isAgeEligible = employeeAge === requiredAge;
    }

    if (!isAgeEligible) {
      return {
        isEligible: false,
        message: `Employee age must be ${eligibilityCriteria.age} for this leave type. Current age: ${employeeAge}`
      };
    }
  }

  // Check length of service if specified
  if (eligibilityCriteria.lengthOfService &&
    eligibilityCriteria.lengthOfService.toLowerCase() !== "all" &&
    employee.employmentInformation && employee.employmentInformation.hireDate) {

    // Calculate service length in days (with exclusions if specified)
    const serviceDays = await calculateLengthOfServiceDays(employee, eligibilityCriteria, companyId);

    // Handle length of service criteria with operators like ">240", "<365", ">=180", etc.
    // The criteria is expected to be in days
    let isServiceEligible = true;
    const serviceStr = eligibilityCriteria.lengthOfService?.toString();

    if (serviceStr.startsWith(">=")) {
      const requiredService = parseInt(serviceStr.substring(2));
      isServiceEligible = serviceDays >= requiredService;
    } else if (serviceStr.startsWith("<=")) {
      const requiredService = parseInt(serviceStr.substring(2));
      isServiceEligible = serviceDays <= requiredService;
    } else if (serviceStr.startsWith(">")) {
      const requiredService = parseInt(serviceStr.substring(1));
      isServiceEligible = serviceDays > requiredService;
    } else if (serviceStr.startsWith("<")) {
      const requiredService = parseInt(serviceStr.substring(1));
      isServiceEligible = serviceDays < requiredService;
    } else {
      // Exact service match
      const requiredService = parseInt(serviceStr);
      isServiceEligible = serviceDays === requiredService;
    }

    if (!isServiceEligible) {
      return {
        isEligible: false,
        message: `Employee service length must be ${eligibilityCriteria.lengthOfService} days for this leave type. Current service: ${serviceDays} days`
      };
    }
  }

  // Check job category/name if specified
  if (eligibilityCriteria.jobName &&
    eligibilityCriteria.jobName.toLowerCase() !== "all" &&
    employee.employmentInformation && employee.employmentInformation.jobCategory &&
    eligibilityCriteria.jobName.toLowerCase() !== employee.employmentInformation.jobCategory.toLowerCase()) {
    return {
      isEligible: false,
      message: `This leave is only available for ${eligibilityCriteria.jobName} job category`
    };
  }

  // Check grade if specified
  if (eligibilityCriteria.grade &&
    eligibilityCriteria.grade.toLowerCase() !== "all" &&
    employee.employmentInformation && employee.employmentInformation.grade &&
    eligibilityCriteria.grade.toLowerCase() !== employee.employmentInformation.grade.toLowerCase()) {
    return {
      isEligible: false,
      message: `This leave is only available for grade ${eligibilityCriteria.grade}`
    };
  }

  // Check marital status if specified
  if (eligibilityCriteria.maritalStatus &&
    eligibilityCriteria.maritalStatus.toLowerCase() !== "all" &&
    employee.personalInformation && employee.personalInformation.maritalStatus &&
    eligibilityCriteria.maritalStatus.toLowerCase() !== employee.personalInformation.maritalStatus.toLowerCase()) {
    return {
      isEligible: false,
      message: `This leave is only available for ${eligibilityCriteria.maritalStatus} employees`
    };
  }

  // Check location if specified
  if (eligibilityCriteria.location &&
    eligibilityCriteria.location.toLowerCase() !== "all" &&
    employee.employmentInformation && employee.employmentInformation.location &&
    eligibilityCriteria.location.toLowerCase() !== employee.employmentInformation.location.toLowerCase()) {
    return {
      isEligible: false,
      message: `This leave is only available for employees at ${eligibilityCriteria.location} location`
    };
  }

  // Check department if specified
  if (eligibilityCriteria.department &&
    eligibilityCriteria.department.toLowerCase() !== "all" &&
    employee.employmentInformation && employee.employmentInformation.department &&
    eligibilityCriteria.department.toLowerCase() !== employee.employmentInformation.department.toLowerCase()) {
    return {
      isEligible: false,
      message: `This leave is only available for ${eligibilityCriteria.department} department`
    };
  }

  // Check work type if specified
  if (eligibilityCriteria.workType &&
    eligibilityCriteria.workType.toLowerCase() !== "all" &&
    employee.employmentInformation && employee.employmentInformation.workType &&
    eligibilityCriteria.workType.toLowerCase() !== employee.employmentInformation.workType.toLowerCase()) {
    return {
      isEligible: false,
      message: `This leave is only available for ${eligibilityCriteria.workType} work type`
    };
  }

  // Check probation period if specified
  if (eligibilityCriteria.probationPeriod &&
    eligibilityCriteria.probationPeriod.toLowerCase() !== "all" &&
    employee.employmentInformation && employee.employmentInformation.hireDate) {

    const employmentDuration = Math.floor((new Date() - new Date(employee.employmentInformation.hireDate)) / (30 * 24 * 60 * 60 * 1000)); // in months

    // Handle probation period - "yes" means employee must have completed probation
    if (eligibilityCriteria.probationPeriod.toLowerCase() === "yes") {
      // Assuming standard probation period is 6 months, you can adjust this
      const standardProbationPeriod = 6;
      if (employmentDuration < standardProbationPeriod) {
        return {
          isEligible: false,
          message: `Employee must complete probation period of ${standardProbationPeriod} months for this leave type`
        };
      }
    } else if (eligibilityCriteria.probationPeriod.toLowerCase() === "no") {
      // "no" means probation completion is not required - always eligible
    } else {
      // Handle numeric probation period
      const probationPeriod = parseInt(eligibilityCriteria.probationPeriod);
      if (!isNaN(probationPeriod) && employmentDuration < probationPeriod) {
        return {
          isEligible: false,
          message: `Employee must complete probation period of ${probationPeriod} months for this leave type`
        };
      }
    }
  }

  // Check person type if specified
  if (eligibilityCriteria.personType &&
    eligibilityCriteria.personType.toLowerCase() !== "all" &&
    employee.employmentInformation && employee.employmentInformation.role &&
    eligibilityCriteria.personType.toLowerCase() !== employee.employmentInformation.role.toLowerCase()) {
    return {
      isEligible: false,
      message: `This leave is only available for ${eligibilityCriteria.personType} role`
    };
  }

  // Check notice period if specified
  if (eligibilityCriteria.noticePeriod &&
    eligibilityCriteria.noticePeriod.toLowerCase() !== "all" &&
    employee.employmentInformation && employee.employmentInformation.noticePeriod &&
    eligibilityCriteria.noticePeriod.toLowerCase() !== employee.employmentInformation.noticePeriod.toLowerCase()) {
    return {
      isEligible: false,
      message: `This leave is only available for employees with ${eligibilityCriteria.noticePeriod} notice period`
    };
  }

  // Check religion if specified
  if (eligibilityCriteria.religion &&
    eligibilityCriteria.religion.toLowerCase() !== "all" &&
    employee.personalInformation && employee.personalInformation.religion &&
    eligibilityCriteria.religion.toLowerCase() !== employee.personalInformation.religion.toLowerCase()) {
    return {
      isEligible: false,
      message: `This leave is only available for ${eligibilityCriteria.religion} religion`
    };
  }

  // Check position if specified
  if (eligibilityCriteria.position &&
    eligibilityCriteria.position.toLowerCase() !== "all" &&
    employee.employmentInformation && employee.employmentInformation.position &&
    eligibilityCriteria.position.toLowerCase() !== employee.employmentInformation.position.toLowerCase()) {
    return {
      isEligible: false,
      message: `This leave is only available for ${eligibilityCriteria.position} position`
    };
  }

  // Check if employee is active (only if employment information and status exist)
  if (employee.employmentInformation && employee.employmentInformation.status &&
    employee.employmentInformation.status.toLowerCase() !== "active") {
    return {
      isEligible: false,
      message: "Leave can only be applied by active employees"
    };
  }

  // If all checks pass
  return { isEligible: true, message: "Employee is eligible for this leave type" };
};

// Function to check advance days validation
const checkAdvanceDays = (leaveType, leaveDays, fromDate) => {
  if (!leaveType.maxAdvanceDays || leaveType.maxAdvanceDays.length === 0) {
    return { isValid: true, message: "No advance days restriction" };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0); // Reset time to start of day

  const leaveStartDate = new Date(fromDate);
  leaveStartDate.setHours(0, 0, 0, 0); // Reset time to start of day

  const daysDifference = Math.ceil((leaveStartDate - today) / (1000 * 60 * 60 * 24));

  // Find the appropriate advance days rule based on leave duration
  let applicableRule = null;

  for (const rule of leaveType.maxAdvanceDays) {
    const minDays = rule.minDays || 0;
    const maxDays = rule.maxDays || Infinity;

    if (leaveDays >= minDays && leaveDays <= maxDays) {
      applicableRule = rule;
      break;
    }
  }

  if (!applicableRule) {
    return {
      isValid: false,
      message: `No advance days rule found for ${leaveDays} days leave`
    };
  }

  const maxAdvanceDays = applicableRule.maxAdvanceDays;

  if (daysDifference < maxAdvanceDays) {
    if (daysDifference < 0) {
      return {
        isValid: false,
        message: "You are not allowed to add backdated leaves."
      };
    }
    return {
      isValid: false,
      message: `Leave must be applied at least ${maxAdvanceDays} days in advance. You are applying only ${daysDifference} days in advance.`
    };
  }

  return {
    isValid: true,
    message: `Advance days validation passed. Applied ${daysDifference} days in advance (minimum required: ${maxAdvanceDays})`
  };
};

const checkHalfDayLimits = async (leaveType, empId, companyId, isHalfDay, fromDate, excludeLeaveId = null) => {
  console.log('INFO: Half-day validation check:', {
    isHalfDay,
    maxHalfDays: leaveType.maxHalfDays,
    leaveTypeName: leaveType.name,
    empId,
    companyId,
    fromDate,
    excludeLeaveId,
  });

  if (!isHalfDay || !leaveType.maxHalfDays) {
    return { isValid: true, message: "No half-day restrictions" };
  }

  const { start: fyStart, end: fyEnd, label: fyLabel } = getFinancialYearBounds(fromDate, leaveType);

  const halfDayQuery = {
    empId,
    companyId,
    absenceType: leaveType.name,
    $or: [{ halfDay: true }, { durationOfAbsence: "0.5" }],
    status: { $in: ["approved", "pending"] },
    from: { $gte: fyStart, $lte: fyEnd },
  };

  if (excludeLeaveId) {
    halfDayQuery._id = { $ne: excludeLeaveId };
  }

  const existingHalfDayLeaves = await LeavesModel.find(halfDayQuery);

  const usedHalfDays = existingHalfDayLeaves.length;
  const maxHalfDays = leaveType.maxHalfDays;

  console.log("INFO: Half-day count details:", {
    usedHalfDays,
    maxHalfDays,
    financialYear: fyLabel,
    fyStart,
    fyEnd,
    existingLeaves: existingHalfDayLeaves.map((leave) => ({
      id: leave._id,
      from: leave.from,
      status: leave.status,
      halfDay: leave.halfDay,
      durationOfAbsence: leave.durationOfAbsence,
    })),
  });

  if (usedHalfDays >= maxHalfDays) {
    return {
      isValid: false,
      message: `Maximum half-day leaves limit reached. You have used ${usedHalfDays}/${maxHalfDays} half-day leaves for financial year ${fyLabel}.`,
    };
  }

  return {
    isValid: true,
    message: `Half-day validation passed. Used ${usedHalfDays}/${maxHalfDays} half-day leaves for financial year ${fyLabel}.`,
  };
};

// Function to check max leaves at once validation
const checkMaxLeavesAtOnce = async (leaveType, empId, companyId, requestedDuration, fromDate, toDate) => {
  console.log('INFO: Max leaves at once validation check:', {
    maxLeavesAtOnce: leaveType.maxLeavesAtOnce,
    leaveTypeName: leaveType.name,
    requestedDuration,
    empId,
    companyId
  });

  if (!leaveType.maxLeavesAtOnce) {
    return { isValid: true, message: "No max leaves at once restriction" };
  }

  // Check for overlapping or consecutive leaves within the same period
  const existingLeaves = await LeavesModel.find({
    empId,
    companyId,
    absenceType: leaveType.name,
    status: { $in: ['approved', 'pending'] },
    $or: [
      // Overlapping leaves
      {
        from: { $lte: toDate },
        to: { $gte: fromDate }
      },
      // Consecutive leaves (within 1 day gap)
      {
        from: { $lte: new Date(new Date(fromDate).getTime() - 24 * 60 * 60 * 1000) },
        to: { $gte: new Date(new Date(toDate).getTime() + 24 * 60 * 60 * 1000) }
      }
    ]
  });

  // Calculate total duration of existing leaves
  let totalExistingDuration = 0;
  existingLeaves.forEach(leave => {
    if (leave.durationOfAbsence) {
      totalExistingDuration += parseFloat(leave.durationOfAbsence) || 0;
    } else if (leave.from && leave.to) {
      const diffTime = Math.abs(new Date(leave.to) - new Date(leave.from));
      totalExistingDuration += Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    }
  });

  const totalDuration = totalExistingDuration + requestedDuration;
  const maxLeavesAtOnce = leaveType.maxLeavesAtOnce;

  console.log('INFO: Max leaves at once details:', {
    totalExistingDuration,
    requestedDuration,
    totalDuration,
    maxLeavesAtOnce,
    existingLeaves: existingLeaves.map(leave => ({
      id: leave._id,
      from: leave.from,
      to: leave.to,
      durationOfAbsence: leave.durationOfAbsence,
      status: leave.status
    }))
  });

  if (totalDuration > maxLeavesAtOnce) {
    return {
      isValid: false,
      message: `Maximum leaves at once limit exceeded. You can only take ${maxLeavesAtOnce} days at a time, but you're requesting ${totalDuration} days (${totalExistingDuration} existing + ${requestedDuration} new).`
    };
  }

  return {
    isValid: true,
    message: `Max leaves at once validation passed. Total duration: ${totalDuration}/${maxLeavesAtOnce} days.`
  };
};

// Function to evaluate workflow condition based on leave days
const evaluateWorkflowCondition = (condition, leaveDays) => {
  if (!condition || typeof condition !== 'object') return false;
  if (!condition.attribute || !condition.operator) return false;

  // Only handle 'days' attribute for now
  if (condition.attribute !== 'days') return false;

  const days = parseFloat(leaveDays);
  if (isNaN(days)) return false;

  const normalizeOperator = (op) => {
    if (!op) return op;
    switch (op) {
      // Support both UI values and legacy/back-end values
      case 'equal_to':
        return 'equal';
      case 'greater_than_or_equal_to':
        return 'greater_than_or_equal';
      case 'less_than_or_equal_to':
        return 'less_than_or_equal';
      default:
        return op;
    }
  };

  const op = normalizeOperator(condition.operator);

  if (op === 'between') {
    const min = parseFloat(condition.minValue);
    const max = parseFloat(condition.maxValue);
    if (isNaN(min) || isNaN(max)) return false;
    if (min > max) return false;
    // Inclusive between
    return days >= min && days <= max;
  }

  const conditionValue = parseFloat(condition.value);
  if (isNaN(conditionValue)) return false;

  switch (op) {
    case 'greater_than':
      return days > conditionValue;
    case 'greater_than_or_equal':
      return days >= conditionValue;
    case 'less_than':
      return days < conditionValue;
    case 'less_than_or_equal':
      return days <= conditionValue;
    case 'equal':
      return days === conditionValue;
    case 'not_equal':
      return days !== conditionValue;
    default:
      return false;
  }
};

// Function to find the appropriate workflow based on leave duration
const findMatchingWorkflow = async (companyId, leaveDays) => {
  try {
    // Get all workflows for leave_request transaction type
    const workflows = await WorkflowModel.find({
      companyId,
      "transactionType.id": "leave_request"
    }).sort({ createdAt: 1 }); // Sort by creation date to ensure consistent ordering

    console.log(`Found ${workflows.length} leave request workflows for company ${companyId}`);
    console.log('Leave duration:', leaveDays, 'days');

    // Find the first workflow that matches the condition
    for (const workflow of workflows) {
      const condition = workflow.workflowDetails?.condition;

      console.log(`Evaluating workflow: ${workflow.workflowDetails?.name}`);
      console.log('Condition:', condition);

      if (evaluateWorkflowCondition(condition, leaveDays)) {
        console.log(`INFO: Workflow "${workflow.workflowDetails?.name}" matches the specified condition`);
        return workflow;
      } else {
        console.log(`INFO: Workflow "${workflow.workflowDetails?.name}" does not match the condition`);
      }
    }

    // If no workflow matches, return null or the first workflow as fallback
    if (workflows.length > 0) {
      console.log('INFO: No workflow condition matched, using first available workflow as fallback');
      return workflows[0];
    }

    console.log('INFO: No workflows configured for leave_request transaction type');
    return null;
  } catch (error) {
    console.error('Error finding matching workflow:', error);
    return null;
  }
};

// Function to get approver details based on approver type
const getApproverDetails = async (approverId, employee, companyId) => {
  try {
    switch (approverId) {
      case 'line_manager':
        if (employee.employmentInformation && employee.employmentInformation.lineManager) {
          const lineManager = await EmployeeModel.findById(employee.employmentInformation.lineManager);
          return {
            approverType: 'Line Manager',
            approverDetails: lineManager,
            approverId: employee.employmentInformation.lineManager
          };
        }
        return null;

      case 'hr_manager':
        // Find HR Manager based on company and role
        const hrManager = await EmployeeModel.findOne({
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
        // Find Department Head based on legal entity mappings
        // We look for an employee who has a mapping for the requestor's department where functionalHead is true
        const deptHead = await EmployeeModel.findOne({
          companyId: companyId,
          "employmentInformation.legalEntityMappings": {
            $elemMatch: {
              function: employee.employmentInformation?.department,
              functionalHead: true
            }
          },
          'employmentInformation.status': 'Active'
        });
        console.log(deptHead, 'deptHead found from legalEntityMappings')
        return {
          approverType: 'Functional Head',
          approverDetails: deptHead,
          approverId: deptHead?._id
        };

      case 'ceo':
        // Find CEO based on company and role
        const ceo = await EmployeeModel.findOne({
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
        // Find Finance Director based on company and department
        const financeDirector = await EmployeeModel.findOne({
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
        // Find Project Manager based on company and role
        const projectManager = await EmployeeModel.findOne({
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
        // Check if approverId is a valid ObjectId (Individual User)
        if (mongoose.Types.ObjectId.isValid(approverId)) {
          const specificUser = await EmployeeModel.findById(approverId);
          if (specificUser) {
            return {
              approverType: "Individual User", // Or specificUser.employmentInformation?.role
              approverDetails: specificUser,
              approverId: specificUser._id
            };
          }
        }
        return null;
    }
  } catch (error) {
    console.error('Error getting approver details:', error);
    return null;
  }
};

const createLeave = async (req, res) => {
  try {
    // Extract form data from the request
    const {
      absenceType,
      absenceId,
      from,
      to,
      durationOfAbsence,
      note,
      halfDay,
      companyId,
      empId,
      leaveTypeId,
      eligibilityId,
    } = req.body;

    console.log('INFO: Create leave request data:', {
      absenceType,
      halfDay,
      durationOfAbsence,
      from,
      to,
      empId,
      companyId
    });

    let attachmentUrl = null;

    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const uploaded = await uploadFileToDrive(
          file.buffer,
          file.originalname,
          file.mimetype
        );
        attachmentUrl = uploaded.url;
      }
    }

    const fromDate = new Date(from);
    const toDate = new Date(to);

    // Check for overlapping leaves
    const existingLeave = await LeavesModel.findOne({
      empId,
      status: { $in: ['pending', 'approved'] }, // allow re-apply if previously rejected/cancelled
      $or: [
        {
          from: { $lte: toDate },
          to: { $gte: fromDate },
        },
      ],
    });

    if (existingLeave) {
      return errorResponse(
        res,
        "A leave application already exists for the selected dates. Please choose different dates.",
        400
      );
    }

    // Calculate requested duration if not provided
    let requestedDuration = parseFloat(durationOfAbsence);
    if (!requestedDuration || isNaN(requestedDuration)) {
      const diffTime = Math.abs(toDate - fromDate);
      requestedDuration = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    }

    // For half day, count as 0.5 days
    if (halfDay === 'true' || halfDay === true) {
      requestedDuration = 0.5;
    }

    // Check leave balance for all other leave types
    let leaveType;
    let leaveTypeName = absenceType;

    // First try to find by name
    leaveType = await LeaveTypeModel.findOne({
      companyId,
      name: absenceType
    });

    // If not found by name, try by ID (only if it's a valid ObjectId)
    if (!leaveType && mongoose.Types.ObjectId.isValid(absenceType)) {
      leaveType = await LeaveTypeModel.findOne({
        companyId,
        _id: absenceType
      });
    }

    if (leaveType) {
      leaveTypeName = leaveType.name;

      // Check advance days validation
      const advanceDaysValidation = checkAdvanceDays(leaveType, requestedDuration, fromDate);
      if (!advanceDaysValidation.isValid) {
        return errorResponse(res, advanceDaysValidation.message, 400);
      }
      console.log('INFO: Advance days validation:', advanceDaysValidation.message);

      // Check half-day limits validation
      const isHalfDay = halfDay === 'true' || halfDay === true;
      const halfDayValidation = await checkHalfDayLimits(leaveType, empId, companyId, isHalfDay, fromDate);
      if (!halfDayValidation.isValid) {
        return errorResponse(res, halfDayValidation.message, 400);
      }
      console.log('INFO: Half-day validation:', halfDayValidation.message);

      // Check max leaves at once validation
      const maxLeavesAtOnceValidation = await checkMaxLeavesAtOnce(leaveType, empId, companyId, requestedDuration, fromDate, toDate);
      if (!maxLeavesAtOnceValidation.isValid) {
        return errorResponse(res, maxLeavesAtOnceValidation.message, 400);
      }
      console.log('INFO: Max leaves at once validation:', maxLeavesAtOnceValidation.message);

      // Enforce attachment requirement based on leave type configuration
      try {
        const attachmentsRequiredFlag = leaveType.attachmentsRequired;
        const attachmentRule = leaveType.attachmentRequiredDays || {};
        const operator = attachmentRule.operator;
        const thresholdValue = Number(attachmentRule.value);
        const isAttachmentsRequired =
          attachmentsRequiredFlag === true || attachmentsRequiredFlag === 'true';

        const meetsThreshold = (duration, op, threshold) => {
          if (!op || Number.isNaN(threshold)) return false;
          switch (op) {
            case 'greater_than':
              return duration > threshold;
            case 'greater_than_or_equal_to':
              return duration >= threshold;
            case 'equal_to':
              return duration === threshold;
            case 'less_than':
              return duration < threshold;
            case 'less_than_or_equal_to':
              return duration <= threshold;
            default:
              return false;
          }
        };

        if (isAttachmentsRequired && meetsThreshold(requestedDuration, operator, thresholdValue)) {
          if (!attachmentUrl) {
            const unit = leaveType.unit || 'days';
            return errorResponse(
              res,
              `Attachment is required for ${leaveType.name} when duration is ${operator?.replace(/_/g, ' ')} ${thresholdValue} ${unit}. Please upload an attachment.`,
              400
            );
          }
        }
      } catch (attachmentCheckErr) {
        console.error('WARNING: Failed to evaluate attachment requirement rule:', attachmentCheckErr);
      }

      // Simple remaining balance check using per-employee balance (fallback to type balance)
      let currentRemaining = null;
      try {
        const empBalance = await EmployeeLeaveBalance.findOne({ companyId, empId });
        if (empBalance && Array.isArray(empBalance.leaveTypes)) {
          const lt = empBalance.leaveTypes.find(
            (t) => String(t.leaveTypeId) === String(leaveType._id) || t.name === leaveType.name
          );
          if (lt) currentRemaining = parseFloat(lt.balance) || 0;
        }
      } catch (_) { }
      if (currentRemaining === null || Number.isNaN(currentRemaining)) {
        currentRemaining = parseFloat(leaveType.balanceBasedOn) || 0;
      }
      if (requestedDuration > currentRemaining) {
        return errorResponse(
          res,
          `Not enough ${leaveType.name} balance. You have ${currentRemaining} ${leaveType.unit || 'days'} remaining but requested ${requestedDuration}.`,
          400
        );
      }
    }

    // Fetch employee details
    const employee = await EmployeeModel.findById(empId);
    if (!employee) {
      return errorResponse(res, "Employee not found", 404);
    }

    // Check if eligibilityId is provided and valid
    let eligibilityCriteria = null;
    const hasValidEligibilityId = eligibilityId &&
      eligibilityId !== "undefined" &&
      eligibilityId.trim() !== "" &&
      mongoose.Types.ObjectId.isValid(eligibilityId);

    if (hasValidEligibilityId) {
      // Fetch eligibility criteria
      eligibilityCriteria = await EligibilityCriteriaModel.findById(eligibilityId);
      if (!eligibilityCriteria) {
        return errorResponse(res, "Eligibility criteria not found", 404);
      }

      // Check eligibility using the separate function
      const eligibilityResult = await checkEligibility(employee, eligibilityCriteria, companyId);
      if (!eligibilityResult.isEligible) {
        return errorResponse(res, eligibilityResult.message, 400);
      }
    } else {
      console.log('INFO: No eligibility criteria specified - proceeding without eligibility validation');
    }

    // Find the appropriate workflow based on leave duration and conditions
    const workflow = await findMatchingWorkflow(companyId, requestedDuration);
    console.log(workflow?.approvalChain, 'workflowssd')
    let firstApprover = null;
    if (workflow && workflow.approvalChain) {
      console.log(`INFO: Applying workflow "${workflow.workflowDetails?.name}" for ${requestedDuration} days leave request`);
      console.log('INFO: Workflow condition:', workflow.workflowDetails?.condition);
      console.log('INFO: Original approval levels:', Object.keys(workflow.approvalChain).length);

      // Find the first valid approver (not self-approval) from any level
      for (const [level, approvers] of Object.entries(workflow.approvalChain)) {
        if (firstApprover) break; // Already found first approver
        for (const approverData of approvers) {
          const approverInfo = await getApproverDetails(approverData.id, employee, companyId);
          if (approverInfo && approverInfo.approverDetails) {
            // Check for self-approval scenario
            if (approverInfo.approverId?.toString() === employee._id?.toString()) {
              console.log(`INFO: Skipping self-approval notification for ${approverInfo.approverType}`);
              continue; // Skip this approver
            }

            // Found the first valid approver
            firstApprover = approverInfo;
            console.log('INFO: First valid approver found:', {
              approverType: approverInfo.approverType,
              approverName: `${approverInfo.approverDetails.personalInformation?.firstName} ${approverInfo.approverDetails.personalInformation?.lastName}`,
              approverEmail: approverInfo.approverDetails.contactInformation?.email,
              approverId: approverInfo.approverId
            });

            // Send email notification to the approver
            const approverEmail = approverInfo.approverDetails.contactInformation?.email;
            const approverName = `${approverInfo.approverDetails.personalInformation?.firstName} ${approverInfo.approverDetails.personalInformation?.lastName}`;
            const employeeName = `${employee.personalInformation?.firstName} ${employee.personalInformation?.lastName}`;

            if (approverEmail) {
              const leaveDetails = {
                employeeName: employeeName,
                employeeEmail: employee.contactInformation?.email,
                leaveType: leaveTypeName,
                fromDate: fromDate.toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                }),
                toDate: toDate.toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                }),
                duration: requestedDuration?.toString(),
                reason: note || 'No reason provided',
                approvalLink: buildEmailLoginLink({
                  emailId: approverEmail,
                  redirectPath: (() => {
                    let tab = "";
                    if (approverInfo.approverType === "Line Manager") tab = "myteam";
                    else if (approverInfo.approverType === "Functional Head") tab = "myfunction";
                    else if (approverInfo.approverType === "HR Manager") tab = "mycompany";
                    return tab ? `/admin/previlages/apply-leave?tab=${tab}` : "/admin/previlages/apply-leave";
                  })(),
                }),
              };

              try {
                await sendEmail(
                  approverEmail,
                  `Leave Approval Required - ${employeeName}`,
                  {
                    name: approverName,
                    leaveApproval: true,
                    leaveDetails: leaveDetails
                  },
                  true
                );
                console.log(`INFO: Leave approval notification sent to ${approverName} (${approverEmail})`);
              } catch (emailError) {
                console.error('ERROR: Failed to send leave approval email:', emailError);
              }
            } else {
              console.log('WARNING: Approver email not available, notification not sent');
            }
            break; // Exit the inner loop
          }
        }
      }

      if (!firstApprover) {
        console.log('INFO: No valid approvers found after excluding self-approval scenarios');
      }
    } else {
      console.log(`INFO: No workflow matches condition for ${requestedDuration} days leave - auto-approving`);
    }

    // Setup approval workflow data
    let approverLevels = new Map();
    let currentApprovers = [];

    if (workflow && workflow.approvalChain) {
      // Build approver levels from workflow, excluding self-approval scenarios
      let levelCounter = 0; // Track actual level numbers after skipping self-approvals

      for (const [originalLevel, approvers] of Object.entries(workflow.approvalChain)) {
        const levelApprovers = [];
        let levelHasSelfApproval = false;

        for (const approverData of approvers) {
          console.log(`INFO: Evaluating approver: ${approverData.id} for employee ${employee._id}`);
          const approverInfo = await getApproverDetails(approverData.id, employee, companyId);

          if (approverInfo && approverInfo.approverDetails) {
            // Check for self-approval scenario
            if (approverInfo.approverId?.toString() === employee._id?.toString()) {
              console.log(`INFO: Skipping self-approval for ${approverInfo.approverType} - Employee is their own approver`);
              levelHasSelfApproval = true;
              continue; // Skip this approver
            }

            const approverEntry = {
              approverId: approverInfo.approverId,
              approverType: approverInfo.approverType,
              approverName: `${approverInfo.approverDetails.personalInformation?.firstName} ${approverInfo.approverDetails.personalInformation?.lastName}`,
              approverEmail: approverInfo.approverDetails.contactInformation?.email,
              status: 'pending'
            };
            levelApprovers.push(approverEntry);
            console.log(`INFO: Added approver for level ${originalLevel}:`, approverEntry);
          } else {
            console.log(`WARNING: No approver found for: ${approverData.id}`);
          }
        }

        // Only add this level if it has valid approvers (not just self-approval)
        if (levelApprovers.length > 0) {
          const actualLevel = levelCounter.toString();
          approverLevels.set(actualLevel, {
            status: actualLevel === "0" ? 'pending' : 'pending',
            approvers: levelApprovers
          });

          // Set current approvers for level 0
          if (actualLevel === "0") {
            currentApprovers = levelApprovers.map(approver => ({
              approverId: approver.approverId,
              approverType: approver.approverType,
              approverName: approver.approverName,
              approverEmail: approver.approverEmail,
              level: actualLevel
            }));
            console.log('INFO: Level 0 current approvers set:', currentApprovers);
          }

          levelCounter++; // Increment only when we actually add a level
        } else if (levelHasSelfApproval) {
          console.log(`INFO: Skipping entire level ${originalLevel} due to self-approval scenario`);
        }
      }

      console.log(`INFO: Final approval workflow has ${approverLevels.size} levels (originally ${Object.keys(workflow.approvalChain).length})`);
    }

    // Employee information for quick access
    const employeeInfo = {
      name: `${employee.personalInformation?.firstName} ${employee.personalInformation?.lastName}`,
      email: employee.contactInformation?.email,
      department: employee.employmentInformation?.department,
      position: employee.employmentInformation?.position
    };

    // Determine final status based on workflow and approvers
    let finalStatus = 'approved';
    let finalWorkflowId = null;
    let finalCurrentLevel = null;

    if (workflow && approverLevels.size > 0) {
      // Has workflow and valid approvers (after excluding self-approval)
      finalStatus = 'pending';
      finalWorkflowId = workflow._id;
      finalCurrentLevel = "0";
    } else if (workflow && approverLevels.size === 0) {
      // Had workflow but all levels were self-approval scenarios
      finalStatus = 'approved';
      console.log('INFO: All approval levels removed due to self-approval - auto-approving leave');
    }

    // If all checks pass, proceed with leave creation
    const leaveData = {
      companyId,
      empId,
      leaveTypeId,
      eligibilityId: hasValidEligibilityId ? eligibilityId : null,
      absenceType: leaveTypeName,
      halfDay: halfDay === 'true' || halfDay === true,
      from: fromDate,
      to: toDate,
      durationOfAbsence: requestedDuration?.toString(),
      note,
      attachment: attachmentUrl,
      status: finalStatus,
      workflowId: finalWorkflowId,
      currentLevel: finalCurrentLevel,
      approverLevels: approverLevels,
      currentApprovers: currentApprovers,
      employeeInfo: employeeInfo,
      approvalHistory: []
    };

    // Debug: Log the leave data before saving
    console.log('Creating leave with data:', {
      ...leaveData,
      currentApprovers: leaveData.currentApprovers,
      approverLevels: leaveData.approverLevels ? Object.fromEntries(leaveData.approverLevels) : null
    });

    // Create new leave record
    const newLeave = await LeavesModel.create(leaveData);

    // Decrement remaining balance on the employee balance immediately
    try {
      if (leaveTypeName) {
        const typeDoc = await LeaveTypeModel.findOne({ companyId, name: leaveTypeName });
        if (typeDoc) {
          const requested = parseFloat(leaveData.durationOfAbsence) || 0;
          const balanceDoc = await EmployeeLeaveBalance.findOne({ companyId, empId });
          if (!balanceDoc) {
            if (requested > (parseFloat(typeDoc.balanceBasedOn) || 0)) {
              await LeavesModel.findByIdAndDelete(newLeave._id);
              return errorResponse(res, `Not enough ${typeDoc.name} balance. You have ${typeDoc.balanceBasedOn || 0} ${typeDoc.unit || 'days'} remaining but requested ${requested}.`, 400);
            }
            await EmployeeLeaveBalance.create({
              companyId,
              empId,
              leaveTypes: [{
                leaveTypeId: String(typeDoc._id),
                name: typeDoc.name,
                unit: typeDoc.unit || 'days',
                balance: (parseFloat(typeDoc.balanceBasedOn) || 0) - requested
              }]
            });
          } else {
            const types = Array.isArray(balanceDoc.leaveTypes) ? balanceDoc.leaveTypes : [];
            const idx = types.findIndex((t) => String(t.leaveTypeId) === String(typeDoc._id) || t.name === typeDoc.name);
            const currentRemaining = idx >= 0 ? (parseFloat(types[idx].balance) || 0) : (parseFloat(typeDoc.balanceBasedOn) || 0);
            if (requested > currentRemaining) {
              await LeavesModel.findByIdAndDelete(newLeave._id);
              return errorResponse(res, `Not enough ${typeDoc.name} balance. You have ${currentRemaining} ${typeDoc.unit || 'days'} remaining but requested ${requested}.`, 400);
            }
            const updatedRemaining = currentRemaining - requested;
            if (idx >= 0) {
              types[idx].balance = updatedRemaining;
            } else {
              types.push({
                leaveTypeId: String(typeDoc._id),
                name: typeDoc.name,
                unit: typeDoc.unit || 'days',
                balance: updatedRemaining
              });
            }
            await EmployeeLeaveBalance.findByIdAndUpdate(balanceDoc._id, { $set: { leaveTypes: types } }, { new: true });
          }
        }
      }
    } catch (e) {
      // Rollback created leave on failure to update balance
      await LeavesModel.findByIdAndDelete(newLeave._id);
      return errorResponse(res, "Failed to update leave balance. Please try again.", 500);
    }

    console.log('INFO: Leave application created successfully with ID:', newLeave._id);
    console.log('INFO: Assigned current approvers:', newLeave.currentApprovers?.length || 0);

    let responseMessage;
    if (finalStatus === 'pending') {
      responseMessage = "Leave application submitted successfully and sent for approval";
    } else if (workflow && approverLevels.size === 0) {
      responseMessage = "Leave application approved successfully (no approval required - self-approval scenario)";
    } else {
      responseMessage = "Leave application approved successfully";
    }

    return successResponse(res, {
      data: newLeave,
      message: responseMessage
    });
  } catch (error) {
    return errorResponse(res, error);
  }
};

// Helper function to move to next approval level
const moveToNextLevel = async (leave, currentLevel) => {
  // Check if there's a next level in the stored approverLevels
  const nextLevel = (parseInt(currentLevel) + 1)?.toString();
  const levelData = leave.approverLevels.get(nextLevel);

  if (levelData && levelData.approvers && levelData.approvers.length > 0) {
    // Set next level as current
    leave.currentLevel = nextLevel;

    // Update current approvers
    const nextApprovers = [];
    levelData.status = 'pending';
    nextApprovers.push(...levelData.approvers.map(approver => ({
      approverId: approver.approverId,
      approverType: approver.approverType,
      approverName: approver.approverName,
      approverEmail: approver.approverEmail,
      level: nextLevel
    })));

    leave.currentApprovers = nextApprovers;
    await leave.save();

    // Send notifications to next level approvers
    for (const approver of nextApprovers) {
      if (approver.approverEmail) {
        try {
          await sendEmail(
            approver.approverEmail,
            `Leave Approval Required - ${leave.employeeInfo.name}`,
            {
              name: approver.approverName,
              leaveApproval: true,
              leaveDetails: {
                employeeName: leave.employeeInfo.name,
                employeeEmail: leave.employeeInfo.email,
                leaveType: leave.absenceType,
                fromDate: leave.from.toLocaleDateString('en-US', {
                  year: 'numeric', month: 'long', day: 'numeric'
                }),
                toDate: leave.to.toLocaleDateString('en-US', {
                  year: 'numeric', month: 'long', day: 'numeric'
                }),
                duration: leave.durationOfAbsence,
                reason: leave.note || 'No reason provided',
                approvalLink: buildEmailLoginLink({
                  emailId: approver.approverEmail,
                  redirectPath: (() => {
                    let tab = "";
                    if (approver.approverType === "Line Manager") tab = "myteam";
                    else if (approver.approverType === "Functional Head") tab = "myfunction";
                    else if (approver.approverType === "HR Manager") tab = "mycompany";
                    return tab ? `/admin/previlages/apply-leave?tab=${tab}` : "/admin/previlages/apply-leave";
                  })(),
                }),
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

const approveLeave = async (req, res) => {
  try {
    const { id } = req.query;
    const { approverId, action, comments, rejectionReason } = req.body;

    if (!id) return errorResponse(res, "Leave ID is required");
    if (!approverId) return errorResponse(res, "Approver ID is required");
    if (!action || !['approved', 'rejected'].includes(action)) {
      return errorResponse(res, "Valid action (approved/rejected) is required");
    }

    // Find the leave
    const leave = await LeavesModel.findById(id);
    if (!leave) return errorResponse(res, "Leave not found", 404);

    // Check if leave is still pending
    if (leave.status !== 'pending') {
      return errorResponse(res, `Leave is already ${leave.status}`, 400);
    }

    // Find approver details
    const approver = await EmployeeModel.findById(approverId);
    if (!approver) return errorResponse(res, "Approver not found", 404);

    const approverName = `${approver.personalInformation?.firstName} ${approver.personalInformation?.lastName}`;

    // Check if this approver is authorized for current level
    const currentLevelData = leave.approverLevels.get(leave.currentLevel);
    if (!currentLevelData) {
      return errorResponse(res, "Invalid approval level", 400);
    }

    const approverIndex = currentLevelData.approvers.findIndex(
      app => app.approverId?.toString() === approverId?.toString()
    );

    if (approverIndex === -1) {
      return errorResponse(res, "You are not authorized to approve this leave at current level", 403);
    }

    // Check if already approved/rejected by this approver
    if (currentLevelData.approvers[approverIndex].status !== 'pending') {
      return errorResponse(res, `You have already ${currentLevelData.approvers[approverIndex].status} this leave`, 400);
    }

    // Update approver status
    currentLevelData.approvers[approverIndex].status = action;
    currentLevelData.approvers[approverIndex].approvedAt = new Date();
    currentLevelData.approvers[approverIndex].comments = comments;
    currentLevelData.approvers[approverIndex].rejectionReason = rejectionReason;

    // Add to approval history
    leave.approvalHistory.push({
      approverId: approverId,
      approverName: approverName,
      approverType: currentLevelData.approvers[approverIndex].approverType,
      level: leave.currentLevel,
      action: action,
      comments: comments,
      rejectionReason: rejectionReason,
      timestamp: new Date()
    });

    if (action === 'rejected') {
      // If rejected, mark entire leave as rejected
      leave.status = 'rejected';
      leave.rejectionReason = rejectionReason;
      leave.rejectedBy = approverId;
      leave.rejectedAt = new Date();

      // Mark current level as rejected
      currentLevelData.status = 'rejected';

      // Restore remaining balance on employee balance
      try {
        const typeDoc = await LeaveTypeModel.findOne({ companyId: leave.companyId, name: leave.absenceType });
        if (typeDoc) {
          const restore = parseFloat(leave.durationOfAbsence) || 0;
          const balanceDoc = await EmployeeLeaveBalance.findOne({ companyId: leave.companyId, empId: leave.empId });
          if (balanceDoc) {
            const types = Array.isArray(balanceDoc.leaveTypes) ? balanceDoc.leaveTypes : [];
            const idx = types.findIndex((t) => String(t.leaveTypeId) === String(typeDoc._id) || t.name === typeDoc.name);
            const currentRemaining = idx >= 0 ? (parseFloat(types[idx].balance) || 0) : 0;
            const updatedRemaining = currentRemaining + restore;
            if (idx >= 0) {
              types[idx].balance = updatedRemaining;
            } else {
              types.push({
                leaveTypeId: String(typeDoc._id),
                name: typeDoc.name,
                unit: typeDoc.unit || 'days',
                balance: updatedRemaining
              });
            }
            await EmployeeLeaveBalance.findByIdAndUpdate(balanceDoc._id, { $set: { leaveTypes: types } }, { new: true });
          }
        }
      } catch (_) { /* ignore restore errors */ }

      await leave.save();

      // Send rejection notification to employee
      if (leave.employeeInfo.email) {
        try {
          console.log(`INFO: Sending rejection notification to employee: ${leave.employeeInfo.name} (${leave.employeeInfo.email})`);
          console.log('INFO: Rejection notification details:', {
            leaveType: leave.absenceType,
            fromDate: leave.from.toLocaleDateString('en-US', {
              year: 'numeric', month: 'long', day: 'numeric'
            }),
            toDate: leave.to.toLocaleDateString('en-US', {
              year: 'numeric', month: 'long', day: 'numeric'
            }),
            rejectedBy: approverName,
            rejectionReason: rejectionReason || 'No reason provided'
          });

          await sendEmail(
            leave.employeeInfo.email,
            `Leave Request Rejected`,
            {
              name: leave.employeeInfo.name,
              leaveRejected: true,
              leaveDetails: {
                leaveType: leave.absenceType,
                fromDate: leave.from.toLocaleDateString('en-US', {
                  year: 'numeric', month: 'long', day: 'numeric'
                }),
                toDate: leave.to.toLocaleDateString('en-US', {
                  year: 'numeric', month: 'long', day: 'numeric'
                }),
                rejectedBy: approverName,
                rejectionReason: rejectionReason || 'No reason provided',
                viewLink: buildEmailLoginLink({
                  emailId: leave.employeeInfo.email,
                  redirectPath: "/admin/previlages/apply-leave?tab=myleaverequests"
                })
              }
            },
            true
          );
          console.log(`INFO: Rejection notification sent successfully to ${leave.employeeInfo.name}`);
        } catch (emailError) {
          console.error('ERROR: Failed to send rejection notification:', emailError);
        }
      } else {
        console.log('WARNING: Employee email not available, rejection notification not sent');
      }

      return successResponse(res, {
        data: leave,
        message: "Leave application has been rejected"
      });
    }

    // Check if all approvers in current level have approved
    const allApproved = currentLevelData.approvers.every(app => app.status === 'approved');

    if (allApproved) {
      // Mark current level as approved
      currentLevelData.status = 'approved';

      // Try to move to next level
      const hasNextLevel = await moveToNextLevel(leave, leave.currentLevel);

      if (!hasNextLevel) {
        // Final approval - no more levels
        leave.status = 'approved';
        leave.finalApprovalDate = new Date();
        leave.finalApprover = approverId;
        leave.currentApprovers = [];

        await leave.save();

        // Send final approval notification to employee
        if (leave.employeeInfo.email) {
          try {
            console.log(`INFO: Sending approval notification to employee: ${leave.employeeInfo.name} (${leave.employeeInfo.email})`);
            console.log('INFO: Approval notification details:', {
              leaveType: leave.absenceType,
              fromDate: leave.from.toLocaleDateString('en-US', {
                year: 'numeric', month: 'long', day: 'numeric'
              }),
              toDate: leave.to.toLocaleDateString('en-US', {
                year: 'numeric', month: 'long', day: 'numeric'
              }),
              finalApprovedBy: approverName
            });

            await sendEmail(
              leave.employeeInfo.email,
              `Leave Request Approved`,
              {
                name: leave.employeeInfo.name,
                leaveApproved: true,
                leaveDetails: {
                  leaveType: leave.absenceType,
                  fromDate: leave.from.toLocaleDateString('en-US', {
                    year: 'numeric', month: 'long', day: 'numeric'
                  }),
                  toDate: leave.to.toLocaleDateString('en-US', {
                    year: 'numeric', month: 'long', day: 'numeric'
                  }),
                  finalApprovedBy: approverName,
                  viewLink: buildEmailLoginLink({
                    emailId: leave.employeeInfo.email,
                    redirectPath: "/admin/previlages/apply-leave?tab=myleaverequests"
                  })
                }
              },
              true
            );
            console.log(`INFO: Approval notification sent successfully to ${leave.employeeInfo.name}`);
          } catch (emailError) {
            console.error('ERROR: Failed to send approval notification:', emailError);
          }
        } else {
          console.log('WARNING: Employee email not available, approval notification not sent');
        }

        return successResponse(res, {
          data: leave,
          message: "Leave application has been approved successfully"
        });
      } else {
        await leave.save();
        return successResponse(res, {
          data: leave,
          message: "Your approval has been recorded. Application forwarded to next level"
        });
      }
    } else {
      await leave.save();
      return successResponse(res, {
        data: leave,
        message: "Your approval has been recorded successfully. Awaiting approval from other reviewers"
      });
    }

  } catch (error) {
    return errorResponse(res, error);
  }
}

const { buildLeavesFilters } = require("../../../services/leavesQuery.service");

const getAllLeaves = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const { companyId, empId, currentUserId, from, startDate, endDate } = req.query;
    const normalizedType = (req.query.type || 'me').toString().trim().toLowerCase();
    const subjectEmpId = empId || currentUserId;

    const { filters, cleanCompanyId } = await buildLeavesFilters(req.query);

    console.log("Final filters:", JSON.stringify(filters, null, 2));

    // Debug: Let's check what leaves exist for this company and user
    const allPendingLeaves = await LeavesModel.find({
      companyId: cleanCompanyId,
      status: 'pending'
    }).select('_id empId currentApprovers employeeInfo');

    console.log(`INFO: Found ${allPendingLeaves.length} pending leaves in company`);

    // Check user's own leaves
    const userOwnLeaves = await LeavesModel.find({
      companyId: cleanCompanyId,
      empId: subjectEmpId
    }).select('_id empId status employeeInfo');

    console.log(`INFO: User has ${userOwnLeaves.length} own leaves`);

    // Check user's pending approvals
    const userPendingApprovals = allPendingLeaves.filter(leave =>
      leave.currentApprovers?.some(app => app.approverId?.toString() === currentUserId?.toString())
    );

    console.log(`INFO: User has ${userPendingApprovals.length} pending approvals`);
    console.log('User pending approvals:', userPendingApprovals.map(leave => ({
      leaveId: leave._id,
      employeeName: leave.employeeInfo?.name,
      currentApprovers: leave.currentApprovers?.map(app => ({
        id: app.approverId,
        name: app.approverName,
        type: app.approverType
      }))
    })));

    const leaves = await LeavesModel.find(filters)
      .populate('finalApprover', 'personalInformation')
      .populate('rejectedBy', 'personalInformation')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    console.log(`INFO: Retrieved ${leaves.length} leave records`);
    const total = await LeavesModel.countDocuments(filters);
    const totalPages = Math.ceil(total / limit);

    // Get current user info for role-based data
    let currentUser = null;
    if (currentUserId) {
      currentUser = await EmployeeModel.findById(currentUserId);
    }

    // Enhance data with role-based information
    const enhancedLeaves = leaves.map(leave => {
      const leaveObj = leave.toObject();

      // Add status display with color coding
      leaveObj.statusDisplay = leave.statusDisplay;
      leaveObj.currentLevelDisplay = leave.currentLevelDisplay;

      // Add user-specific information
      if (currentUserId) {
        // Check user's role for this leave
        let userRole = 'viewer';
        let canApprove = false;

        if (leave.empId === currentUserId) {
          userRole = 'applicant';
        } else if (leave.currentApprovers?.some(app => app.approverId?.toString() === currentUserId)) {
          userRole = 'current_approver';
          canApprove = true;
        } else if (leave.approvalHistory?.some(history => history.approverId?.toString() === currentUserId)) {
          userRole = 'past_approver';
        } else if (currentUser && ['HR Admin', 'Super Admin', 'Manager'].includes(currentUser.employmentInformation?.role)) {
          userRole = 'admin';
        }

        leaveObj.userRole = userRole;
        leaveObj.canApprove = canApprove;

        if (userRole === 'current_approver') {
          const currentLevelData = leave.approverLevels?.get(leave.currentLevel);
          const userApprovalData = currentLevelData?.approvers?.find(
            app => app.approverId?.toString() === currentUserId
          );
          leaveObj.yourApprovalStatus = userApprovalData?.status || 'pending';
        }
      }

      if (leaveObj.approverLevels) {
        leaveObj.approverLevels = Object.fromEntries(leaveObj.approverLevels);
      }

      return leaveObj;
    });

    const statusCounts = await LeavesModel.aggregate([
      { $match: { ...filters } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    const summary = {
      total: total,
      pending: statusCounts.find(s => s._id === 'pending')?.count || 0,
      approved: statusCounts.find(s => s._id === 'approved')?.count || 0,
      rejected: statusCounts.find(s => s._id === 'rejected')?.count || 0
    };

    if (currentUserId) {
      let scopeApproverIds = [];
      if (normalizedType === 'me') {
        scopeApproverIds = [currentUserId];
      } else if (normalizedType === 'myteam') {
        const teamMembersScope = await EmployeeModel.find({
          companyId: cleanCompanyId,
          'employmentInformation.status': 'Active',
          'employmentInformation.lineManager': currentUserId
        }).select('_id');
        scopeApproverIds = teamMembersScope.map(e => e._id.toString());
        scopeApproverIds.push(currentUserId);
      } else if (normalizedType === 'mycompany') {
        const companyEmployeesScope = await EmployeeModel.find({
          companyId: cleanCompanyId,
          'employmentInformation.status': 'Active'
        }).select('_id');
        scopeApproverIds = companyEmployeesScope.map(e => e._id.toString());
      } else {
        scopeApproverIds = [currentUserId];
      }
      const pendingApprovals = await LeavesModel.countDocuments({
        companyId: cleanCompanyId,
        status: 'pending',
        'currentApprovers.approverId': { $in: scopeApproverIds }
      });
      summary.pendingApprovals = pendingApprovals;
    }

    const result = {
      totalRecords: total,
      page,
      limit,
      totalPages: totalPages,
      data: enhancedLeaves,
      summary: summary
    };

    return successResponse(
      res,
      result,
      "Leave records retrieved successfully"
    );
  } catch (error) {
    return errorResponse(res, error);
  }
};

const getSummary = async (req, res) => {
  try {
    const { companyId, empId } = req.query;

    if (!companyId || !empId) {
      return errorResponse(res, "Company ID and Employee ID are required", 400);
    }

    // Step 1: Get all leave types for the company
    const leaveTypes = await LeaveTypeModel.find({ companyId });

    const employeeBalance = await EmployeeLeaveBalance.findOne({ companyId, empId });

    // Step 3: Categorize leave types
    const categories = {
      "sick leave": [],
      "casual leave": [],
      "earned leave": [],
      "remote working": [],
      "others": []
    };

    // Map leave types to categories
    leaveTypes.forEach(leaveType => {
      const lowerName = leaveType.name?.toLowerCase();

      if (lowerName.includes("sick")) {
        categories["sick leave"].push(leaveType);
      } else if (lowerName.includes("casual")) {
        categories["casual leave"].push(leaveType);
      } else if (lowerName.includes("earned") || lowerName.includes("privilege") || lowerName.includes("annual")) {
        categories["earned leave"].push(leaveType);
      } else if (lowerName.includes("remote") || lowerName.includes("work from home")) {
        categories["remote working"].push(leaveType);
      } else {
        // categories["others"].push(leaveType);
      }
    });

    // Step 4: Calculate summary for each category
    const summary = {};

    for (const [category, types] of Object.entries(categories)) {
      summary[category] = {
        totalBalance: 0,
        used: 0,
        remaining: 0,
        leaveTypes: []
      };

      for (const type of types) {
        // Use per-employee balance if present, else fallback to type balance
        const typeBalance = (() => {
          if (employeeBalance && Array.isArray(employeeBalance.leaveTypes)) {
            const lt = employeeBalance.leaveTypes.find(
              (t) => t.name === type.name || String(t.leaveTypeId) === String(type._id)
            );
            if (lt && (lt.balance || lt.balance === 0)) return parseFloat(lt.balance) || 0;
          }
          return parseFloat(type.balanceBasedOn) || 0;
        })();

        const typeSummary = {
          name: type.name,
          icon: type.icon || null,
          balance: typeBalance,
          used: 0,
          approved: 0,
          pending: 0,
          rejected: 0,
          remaining: typeBalance,
          unit: type.unit || 'days',
          breakdown: {
            approved: 0,
            pending: 0,
            rejected: 0,
            used: 0,
            available: typeBalance
          }
        };

        summary[category].totalBalance += typeBalance;
        summary[category].used += 0;
        summary[category].remaining += typeBalance;
        summary[category].leaveTypes.push(typeSummary);
      }
    }

    return successResponse(res, {
      message: "Leave summary retrieved successfully",
      data: summary
    });

  } catch (error) {
    return errorResponse(res, error);
  }
};

const getLeaveById = async (req, res) => {
  try {
    const { id, currentUserId } = req.query;
    if (!id) return errorResponse(res, "Leave ID is required");
    if (!currentUserId) return errorResponse(res, "Current User ID is required");

    const leave = await LeavesModel.findById(id)
      .populate('workflowId')
      .populate('finalApprover', 'personalInformation contactInformation')
      .populate('rejectedBy', 'personalInformation contactInformation');

    if (!leave) return errorResponse(res, "Leave not found", 404);

    // Get current user details to determine role
    const currentUser = await EmployeeModel.findById(currentUserId);
    if (!currentUser) return errorResponse(res, "Current user not found", 404);

    // Determine user role in relation to this leave
    let userRole = 'employee';
    let canApprove = false;
    let canView = false;
    let canEdit = false;

    // Check if user is the leave applicant
    if (leave.empId === currentUserId) {
      userRole = 'applicant';
      canView = true;
      canEdit = leave.status === 'pending'; // Can edit only if still pending
    }

    // Check if user is a current approver
    const isCurrentApprover = leave.currentApprovers?.some(
      approver => approver.approverId?.toString() === currentUserId
    );

    if (isCurrentApprover) {
      userRole = 'approver';
      canApprove = true;
      canView = true;
    }

    // Check if user has approved this leave before (in history)
    const hasApproved = leave.approvalHistory?.some(
      history => history.approverId?.toString() === currentUserId
    );

    if (hasApproved) {
      userRole = 'past_approver';
      canView = true;
    }

    // Check if user is HR/Manager (can view all leaves)
    const userEmploymentRole = currentUser.employmentInformation?.role;
    if (['HR Admin', 'Super Admin', 'Manager'].includes(userEmploymentRole)) {
      userRole = 'admin';
      canView = true;
    }

    // If user cannot view this leave
    if (!canView) {
      return errorResponse(res, "You don't have permission to view this leave", 403);
    }

    // Prepare response data based on user role
    let responseData = {
      ...leave.toObject(),
      statusDisplay: leave.statusDisplay,
      currentLevelDisplay: leave.currentLevelDisplay,
      userRole: userRole,
      permissions: {
        canApprove: canApprove,
        canView: canView,
        canEdit: canEdit
      }
    };

    // Add role-specific data
    if (userRole === 'approver') {
      // Find current user's approval requirements
      const currentLevelData = leave.approverLevels?.get(leave.currentLevel);
      const userApprovalData = currentLevelData?.approvers?.find(
        app => app.approverId?.toString() === currentUserId
      );

      responseData.approverInfo = {
        level: leave.currentLevel,
        levelName: `Level ${parseInt(leave.currentLevel) + 1}`,
        yourStatus: userApprovalData?.status || 'pending',
        otherApproversInLevel: currentLevelData?.approvers?.filter(
          app => app.approverId?.toString() !== currentUserId
        ).map(app => ({
          name: app.approverName,
          type: app.approverType,
          status: app.status
        })) || []
      };
    }

    if (userRole === 'applicant') {
      // Add detailed progress for employee
      responseData.progressInfo = {
        currentStep: parseInt(leave.currentLevel) + 1,
        totalSteps: leave.approverLevels?.size || 0,
        currentApprovers: leave.currentApprovers?.map(app => ({
          name: app.approverName,
          type: app.approverType
        })) || [],
        completedLevels: []
      };

      // Build completed levels info
      if (leave.approverLevels) {
        for (const [level, levelData] of leave.approverLevels.entries()) {
          if (levelData.status === 'approved') {
            responseData.progressInfo.completedLevels.push({
              level: parseInt(level) + 1,
              approvers: levelData.approvers.map(app => ({
                name: app.approverName,
                type: app.approverType,
                approvedAt: app.approvedAt
              }))
            });
          }
        }
      }
    }

    if (userRole === 'admin' || userRole === 'past_approver') {
      // Add full workflow details for admin/past approvers
      responseData.workflowDetails = {
        totalLevels: leave.approverLevels?.size || 0,
        currentLevel: leave.currentLevel,
        allLevels: []
      };

      if (leave.approverLevels) {
        for (const [level, levelData] of leave.approverLevels.entries()) {
          responseData.workflowDetails.allLevels.push({
            level: parseInt(level) + 1,
            status: levelData.status,
            approvers: levelData.approvers.map(app => ({
              name: app.approverName,
              type: app.approverType,
              email: app.approverEmail,
              status: app.status,
              approvedAt: app.approvedAt,
              comments: app.comments
            }))
          });
        }
      }
    }

    // Convert Map to Object for JSON serialization
    if (responseData.approverLevels) {
      responseData.approverLevels = Object.fromEntries(responseData.approverLevels);
    }

    return successResponse(res, responseData, "Leave details retrieved successfully");
  } catch (error) {
    return errorResponse(res, error);
  }
};

const updateLeave = async (req, res) => {
  try {
    const { id } = req.query;
    if (!id) return errorResponse(res, "Leave ID is required");

    // Extract form data from the request
    const {
      absenceType,
      from,
      to,
      durationOfAbsence,
      note,
      halfDay,
      companyId,
      empId,
      leaveTypeId,
      eligibilityId,
    } = req.body;

    // Load existing leave
    const existingLeave = await LeavesModel.findById(id);
    if (!existingLeave) return errorResponse(res, "Leave not found", 404);

    // Handle file upload if present
    let attachmentUrl = null;
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const uploaded = await uploadFileToDrive(
          file.buffer,
          file.originalname,
          file.mimetype
        );
        attachmentUrl = uploaded.url;
      }
    }

    // Check if eligibilityId is valid
    const hasValidEligibilityId = eligibilityId &&
      eligibilityId !== "undefined" &&
      eligibilityId.trim() !== "" &&
      mongoose.Types.ObjectId.isValid(eligibilityId);

    // Determine proposed values
    const newAbsenceTypeKey = absenceType || existingLeave.absenceType;
    const newFrom = from ? new Date(from) : existingLeave.from;
    const newTo = to ? new Date(to) : existingLeave.to;
    const isHalfDayUpdate = (halfDay === 'true' || halfDay === true);
    let proposedDuration = parseFloat(durationOfAbsence);
    if (!proposedDuration || isNaN(proposedDuration)) {
      // Recalculate if not provided
      if (isHalfDayUpdate) {
        proposedDuration = 0.5;
      } else {
        const diffTime = Math.abs(newTo - newFrom);
        proposedDuration = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      }
    }

    // Resolve leave type for validations and balance update
    let newTypeDoc = null;
    if (newAbsenceTypeKey) {
      newTypeDoc = await LeaveTypeModel.findOne({ companyId, name: newAbsenceTypeKey });
      if (!newTypeDoc && mongoose.Types.ObjectId.isValid(newAbsenceTypeKey)) {
        newTypeDoc = await LeaveTypeModel.findOne({ companyId, _id: newAbsenceTypeKey });
      }
    }

    // Validations against new type (if resolvable)
    if (newTypeDoc && newTypeDoc.maxAdvanceDays && newTypeDoc.maxAdvanceDays.length > 0) {
      const advanceDaysValidation = checkAdvanceDays(newTypeDoc, proposedDuration, newFrom);
      if (!advanceDaysValidation.isValid) {
        return errorResponse(res, advanceDaysValidation.message, 400);
      }
      console.log('INFO: Advance days validation (update):', advanceDaysValidation.message);
    }

    if (newTypeDoc && newTypeDoc.maxHalfDays) {
      const halfDayValidation = await checkHalfDayLimits(
        newTypeDoc,
        empId,
        companyId,
        isHalfDayUpdate,
        newFrom,
        existingLeave._id
      );
      if (!halfDayValidation.isValid) {
        return errorResponse(res, halfDayValidation.message, 400);
      }
      console.log('INFO: Half-day validation (update):', halfDayValidation.message);
    }

    if (newTypeDoc && newTypeDoc.maxLeavesAtOnce) {
      const maxLeavesAtOnceValidation = await checkMaxLeavesAtOnce(newTypeDoc, empId, companyId, proposedDuration, newFrom, newTo);
      if (!maxLeavesAtOnceValidation.isValid) {
        return errorResponse(res, maxLeavesAtOnceValidation.message, 400);
      }
      console.log('INFO: Max leaves at once validation (update):', maxLeavesAtOnceValidation.message);
    }

    // Balance adjustments
    const oldAbsenceTypeKey = existingLeave.absenceType;
    const oldDuration = parseFloat(existingLeave.durationOfAbsence) || 0;

    // Resolve old/new type docs for balance updates
    const resolveTypeDoc = async (key) => {
      if (!key) return null;
      let doc = await LeaveTypeModel.findOne({ companyId, name: key });
      if (!doc && mongoose.Types.ObjectId.isValid(key)) {
        doc = await LeaveTypeModel.findOne({ companyId, _id: key });
      }
      return doc;
    };

    const oldTypeDoc = await resolveTypeDoc(oldAbsenceTypeKey);
    const targetNewTypeDoc = newTypeDoc || await resolveTypeDoc(newAbsenceTypeKey);

    // Compute and apply delta in per-employee balances
    const balanceDoc = await EmployeeLeaveBalance.findOne({ companyId, empId });
    if (targetNewTypeDoc && oldTypeDoc && String(targetNewTypeDoc._id) === String(oldTypeDoc._id)) {
      // Same leave type, adjust by delta
      const delta = proposedDuration - oldDuration;
      if (delta !== 0) {
        const types = balanceDoc && Array.isArray(balanceDoc.leaveTypes) ? balanceDoc.leaveTypes : [];
        const idx = types.findIndex(t => String(t.leaveTypeId) === String(targetNewTypeDoc._id) || t.name === targetNewTypeDoc.name);
        const currentRemaining = idx >= 0 ? (parseFloat(types[idx].balance) || 0) : (parseFloat(targetNewTypeDoc.balanceBasedOn) || 0);
        if (delta > 0 && delta > currentRemaining) {
          return errorResponse(res, `Not enough ${targetNewTypeDoc.name} balance. You have ${currentRemaining} ${targetNewTypeDoc.unit || 'days'} remaining but need additional ${delta}.`, 400);
        }
        const updatedRemaining = currentRemaining - delta; // subtract positive delta, add negative delta
        if (balanceDoc) {
          if (idx >= 0) {
            types[idx].balance = updatedRemaining;
          } else {
            types.push({
              leaveTypeId: String(targetNewTypeDoc._id),
              name: targetNewTypeDoc.name,
              unit: targetNewTypeDoc.unit || 'days',
              balance: updatedRemaining
            });
          }
          await EmployeeLeaveBalance.findByIdAndUpdate(balanceDoc._id, { $set: { leaveTypes: types } }, { new: true });
        } else {
          await EmployeeLeaveBalance.create({
            companyId,
            empId,
            leaveTypes: [{ leaveTypeId: String(targetNewTypeDoc._id), name: targetNewTypeDoc.name, unit: targetNewTypeDoc.unit || 'days', balance: updatedRemaining }]
          });
        }
      }
    } else {
      // Type changed: restore old, decrement new
      if (oldTypeDoc) {
        const types = balanceDoc && Array.isArray(balanceDoc.leaveTypes) ? balanceDoc.leaveTypes : [];
        const idx = types.findIndex(t => String(t.leaveTypeId) === String(oldTypeDoc._id) || t.name === oldTypeDoc.name);
        const curr = idx >= 0 ? (parseFloat(types[idx].balance) || 0) : 0;
        const updated = curr + oldDuration;
        if (balanceDoc) {
          if (idx >= 0) types[idx].balance = updated; else types.push({ leaveTypeId: String(oldTypeDoc._id), name: oldTypeDoc.name, unit: oldTypeDoc.unit || 'days', balance: updated });
          await EmployeeLeaveBalance.findByIdAndUpdate(balanceDoc._id, { $set: { leaveTypes: types } }, { new: true });
        } else {
          await EmployeeLeaveBalance.create({ companyId, empId, leaveTypes: [{ leaveTypeId: String(oldTypeDoc._id), name: oldTypeDoc.name, unit: oldTypeDoc.unit || 'days', balance: updated }] });
        }
      }
      if (targetNewTypeDoc) {
        const types = balanceDoc && Array.isArray(balanceDoc.leaveTypes) ? balanceDoc.leaveTypes : [];
        const idx = types.findIndex(t => String(t.leaveTypeId) === String(targetNewTypeDoc._id) || t.name === targetNewTypeDoc.name);
        const curr = idx >= 0 ? (parseFloat(types[idx].balance) || 0) : (parseFloat(targetNewTypeDoc.balanceBasedOn) || 0);
        if (proposedDuration > curr) {
          return errorResponse(res, `Not enough ${targetNewTypeDoc.name} balance. You have ${curr} ${targetNewTypeDoc.unit || 'days'} remaining but requested ${proposedDuration}.`, 400);
        }
        const updated = curr - proposedDuration;
        if (balanceDoc) {
          if (idx >= 0) types[idx].balance = updated; else types.push({ leaveTypeId: String(targetNewTypeDoc._id), name: targetNewTypeDoc.name, unit: targetNewTypeDoc.unit || 'days', balance: updated });
          await EmployeeLeaveBalance.findByIdAndUpdate(balanceDoc._id, { $set: { leaveTypes: types } }, { new: true });
        } else {
          await EmployeeLeaveBalance.create({ companyId, empId, leaveTypes: [{ leaveTypeId: String(targetNewTypeDoc._id), name: targetNewTypeDoc.name, unit: targetNewTypeDoc.unit || 'days', balance: updated }] });
        }
      }
    }

    // Prepare update data
    const updateData = {
      companyId: companyId || existingLeave.companyId,
      empId: empId || existingLeave.empId,
      leaveTypeId: leaveTypeId || existingLeave.leaveTypeId,
      eligibilityId: hasValidEligibilityId ? eligibilityId : (existingLeave.eligibilityId || null),
      absenceType: newAbsenceTypeKey,
      halfDay: isHalfDayUpdate,
      from: newFrom,
      to: newTo,
      durationOfAbsence: proposedDuration.toString(),
      note: note !== undefined ? note : existingLeave.note
    };

    if (attachmentUrl) {
      updateData.attachment = attachmentUrl;
    }

    const updatedLeave = await LeavesModel.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });

    if (!updatedLeave) return errorResponse(res, "Leave not found", 404);

    return successResponse(res, updatedLeave, "Leave application updated successfully");
  } catch (error) {
    return errorResponse(res, error);
  }
};

const deleteLeave = async (req, res) => {
  try {
    const { id } = req.query;
    if (!id) return errorResponse(res, "Leave ID is required");

    // Restore balance before deletion if record exists
    const leaveToDelete = await LeavesModel.findById(id);
    if (!leaveToDelete) return errorResponse(res, "Leave not found", 404);

    try {
      const typeDoc = await LeaveTypeModel.findOne({ companyId: leaveToDelete.companyId, name: leaveToDelete.absenceType });
      if (typeDoc) {
        const restore = parseFloat(leaveToDelete.durationOfAbsence) || 0;
        const balanceDoc = await EmployeeLeaveBalance.findOne({ companyId: leaveToDelete.companyId, empId: leaveToDelete.empId });
        if (balanceDoc) {
          const types = Array.isArray(balanceDoc.leaveTypes) ? balanceDoc.leaveTypes : [];
          const idx = types.findIndex((t) => String(t.leaveTypeId) === String(typeDoc._id) || t.name === typeDoc.name);
          const currentRemaining = idx >= 0 ? (parseFloat(types[idx].balance) || 0) : 0;
          const updatedRemaining = currentRemaining + restore;
          if (idx >= 0) {
            types[idx].balance = updatedRemaining;
          } else {
            types.push({
              leaveTypeId: String(typeDoc._id),
              name: typeDoc.name,
              unit: typeDoc.unit || 'days',
              balance: updatedRemaining
            });
          }
          await EmployeeLeaveBalance.findByIdAndUpdate(balanceDoc._id, { $set: { leaveTypes: types } }, { new: true });
        }
      }
    } catch (_) { /* ignore restore errors on delete */ }

    const deletedLeave = await LeavesModel.findByIdAndDelete(id);
    if (!deletedLeave) return errorResponse(res, "Leave not found", 404);

    return successResponse(res, deletedLeave, "Leave application cancelled successfully");
  } catch (error) {
    return errorResponse(res, error);
  }
};

// Get pending approvals for current user
const getPendingApprovals = async (req, res) => {
  try {
    const { currentUserId, companyId } = req.query;
    const normalizedType = (req.query.type || 'me').toString().trim().toLowerCase();
    const cleanCompanyId = (companyId || '').toString().replace(/^"|"$/g, '').trim();

    if (!currentUserId) return errorResponse(res, "Current User ID is required");
    if (!cleanCompanyId) return errorResponse(res, "Company ID is required");

    // Find all leaves where current user is a pending approver
    // Scope approver IDs based on type
    let scopeApproverIds = [];
    if (normalizedType === 'me') {
      scopeApproverIds = [currentUserId];
    } else if (normalizedType === 'myteam') {
      const teamMembersScope = await EmployeeModel.find({
        companyId: cleanCompanyId,
        'employmentInformation.status': 'Active',
        'employmentInformation.lineManager': currentUserId
      }).select('_id');
      scopeApproverIds = teamMembersScope.map(e => e._id.toString());
      scopeApproverIds.push(currentUserId);
    } else if (normalizedType === 'mycompany') {
      const companyEmployeesScope = await EmployeeModel.find({
        companyId: cleanCompanyId,
        'employmentInformation.status': 'Active'
      }).select('_id');
      scopeApproverIds = companyEmployeesScope.map(e => e._id.toString());
    } else {
      scopeApproverIds = [currentUserId];
    }

    const pendingLeaves = await LeavesModel.find({
      companyId: cleanCompanyId,
      status: 'pending',
      'currentApprovers.approverId': { $in: scopeApproverIds }
    })
      .populate('workflowId')
      .sort({ createdAt: -1 });

    // Enhance data with approval-specific information
    const enhancedPendingLeaves = pendingLeaves.map(leave => {
      const leaveObj = leave.toObject();

      // Add status display
      leaveObj.statusDisplay = leave.statusDisplay;
      leaveObj.currentLevelDisplay = leave.currentLevelDisplay;

      // Find current user's approval data
      const currentLevelData = leave.approverLevels?.get(leave.currentLevel);
      const userApprovalData = currentLevelData?.approvers?.find(
        app => app.approverId?.toString() === currentUserId
      );

      leaveObj.approverInfo = {
        level: leave.currentLevel,
        levelName: `Level ${parseInt(leave.currentLevel) + 1}`,
        yourStatus: userApprovalData?.status || 'pending',
        approverType: userApprovalData?.approverType,
        otherApproversInLevel: currentLevelData?.approvers?.filter(
          app => app.approverId?.toString() !== currentUserId
        ).map(app => ({
          name: app.approverName,
          type: app.approverType,
          status: app.status
        })) || []
      };

      // Convert Map to Object
      if (leaveObj.approverLevels) {
        leaveObj.approverLevels = Object.fromEntries(leaveObj.approverLevels);
      }

      return leaveObj;
    });

    // Group by priority/urgency
    const urgent = enhancedPendingLeaves.filter(leave => leave.isUrgent);
    const normal = enhancedPendingLeaves.filter(leave => !leave.isUrgent);

    const result = {
      total: enhancedPendingLeaves.length,
      urgent: {
        count: urgent.length,
        leaves: urgent
      },
      normal: {
        count: normal.length,
        leaves: normal
      },
      allLeaves: enhancedPendingLeaves
    };

    return successResponse(res, result, "Pending approvals retrieved successfully");
  } catch (error) {
    return errorResponse(res, error);
  }
};

// Debug endpoint to test pending approvals
const debugPendingApprovals = async (req, res) => {
  try {
    const { currentUserId, companyId } = req.query;

    if (!currentUserId || !companyId) {
      return errorResponse(res, "currentUserId and companyId are required");
    }

    console.log(`Debug: Checking pending approvals for user ${currentUserId} in company ${companyId}`);

    // Get all pending leaves
    const allPendingLeaves = await LeavesModel.find({
      companyId: companyId,
      status: 'pending'
    });

    console.log(`Found ${allPendingLeaves.length} pending leaves in company`);

    // Check each leave's current approvers
    const leaveAnalysis = allPendingLeaves.map(leave => {
      const hasCurrentUser = leave.currentApprovers?.some(approver =>
        approver.approverId?.toString() === currentUserId?.toString()
      );

      return {
        leaveId: leave._id,
        employeeName: leave.employeeInfo?.name || 'Unknown',
        currentLevel: leave.currentLevel,
        currentApprovers: leave.currentApprovers || [],
        hasCurrentUser: hasCurrentUser,
        status: leave.status
      };
    });

    // Filter for current user
    const userPendingLeaves = leaveAnalysis.filter(leave => leave.hasCurrentUser);

    const debugInfo = {
      currentUserId: currentUserId,
      companyId: companyId,
      totalPendingLeaves: allPendingLeaves.length,
      userPendingLeaves: userPendingLeaves.length,
      leaveAnalysis: leaveAnalysis,
      userSpecificLeaves: userPendingLeaves
    };

    return successResponse(res, debugInfo, "Debug info retrieved");
  } catch (error) {
    return errorResponse(res, error);
  }
};

// Get approval dashboard data
const getApprovalDashboard = async (req, res) => {
  try {
    const { currentUserId, companyId } = req.query;
    const normalizedType = (req.query.type || 'me').toString().trim().toLowerCase();
    const cleanCompanyId = (companyId || '').toString().replace(/^"|"$/g, '').trim();

    if (!currentUserId) return errorResponse(res, "Current User ID is required");
    if (!cleanCompanyId) return errorResponse(res, "Company ID is required");

    // Get current user details
    const currentUser = await EmployeeModel.findById(currentUserId);
    if (!currentUser) return errorResponse(res, "User not found", 404);

    const userRole = currentUser.employmentInformation?.role;
    const isAdmin = ['HR Admin', 'Super Admin', 'Manager'].includes(userRole);

    // Pending approvals for current user
    // Scope approver IDs based on type
    let scopeApproverIds = [];
    if (normalizedType === 'me') {
      scopeApproverIds = [currentUserId];
    } else if (normalizedType === 'myteam') {
      const teamMembersScope = await EmployeeModel.find({
        companyId: cleanCompanyId,
        'employmentInformation.status': 'Active',
        'employmentInformation.lineManager': currentUserId
      }).select('_id');
      scopeApproverIds = teamMembersScope.map(e => e._id.toString());
      scopeApproverIds.push(currentUserId);
    } else if (normalizedType === 'mycompany') {
      const companyEmployeesScope = await EmployeeModel.find({
        companyId: cleanCompanyId,
        'employmentInformation.status': 'Active'
      }).select('_id');
      scopeApproverIds = companyEmployeesScope.map(e => e._id.toString());
    } else {
      scopeApproverIds = [currentUserId];
    }

    const pendingApprovals = await LeavesModel.countDocuments({
      companyId: cleanCompanyId,
      status: 'pending',
      'currentApprovers.approverId': { $in: scopeApproverIds }
    });

    // Leaves approved by current user
    const approvedByUser = await LeavesModel.countDocuments({
      companyId: cleanCompanyId,
      'approvalHistory.approverId': { $in: scopeApproverIds },
      'approvalHistory.action': 'approved'
    });

    // Leaves rejected by current user
    const rejectedByUser = await LeavesModel.countDocuments({
      companyId: cleanCompanyId,
      'approvalHistory.approverId': { $in: scopeApproverIds },
      'approvalHistory.action': 'rejected'
    });

    let dashboardData = {
      userInfo: {
        name: `${currentUser.personalInformation?.firstName} ${currentUser.personalInformation?.lastName}`,
        role: userRole,
        department: currentUser.employmentInformation?.department,
        isAdmin: isAdmin
      },
      approvals: {
        pending: pendingApprovals,
        approved: approvedByUser,
        rejected: rejectedByUser,
        total: approvedByUser + rejectedByUser
      }
    };

    // Add company-wide statistics for admins
    if (isAdmin) {
      const companyStats = await LeavesModel.aggregate([
        { $match: { companyId: cleanCompanyId } },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]);

      const monthlyStats = await LeavesModel.aggregate([
        {
          $match: {
            companyId: cleanCompanyId,
            createdAt: { $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) }
          }
        },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]);

      dashboardData.companyStats = {
        total: companyStats.reduce((sum, stat) => sum + stat.count, 0),
        pending: companyStats.find(s => s._id === 'pending')?.count || 0,
        approved: companyStats.find(s => s._id === 'approved')?.count || 0,
        rejected: companyStats.find(s => s._id === 'rejected')?.count || 0,
        thisMonth: {
          total: monthlyStats.reduce((sum, stat) => sum + stat.count, 0),
          pending: monthlyStats.find(s => s._id === 'pending')?.count || 0,
          approved: monthlyStats.find(s => s._id === 'approved')?.count || 0,
          rejected: monthlyStats.find(s => s._id === 'rejected')?.count || 0
        }
      };
    }

    return successResponse(res, dashboardData, "Dashboard data retrieved successfully");
  } catch (error) {
    return errorResponse(res, error);
  }
};

// Test function to verify email templates
const testEmailTemplates = async (req, res) => {
  try {
    const { testType, email } = req.body;

    if (!testType || !email) {
      return errorResponse(res, "testType and email are required", 400);
    }

    if (!['rejection', 'approval'].includes(testType)) {
      return errorResponse(res, "testType must be 'rejection' or 'approval'", 400);
    }

    const testData = {
      name: "Test Employee",
      leaveType: "Sick Leave",
      fromDate: "January 15, 2024",
      toDate: "January 17, 2024",
      rejectedBy: "John Manager",
      rejectionReason: "Insufficient documentation provided",
      finalApprovedBy: "Jane HR Manager"
    };

    try {
      if (testType === 'rejection') {
        await sendEmail(
          email,
          `Leave Request Rejected - Test`,
          {
            name: testData.name,
            leaveRejected: true,
            leaveDetails: {
              leaveType: testData.leaveType,
              fromDate: testData.fromDate,
              toDate: testData.toDate,
              rejectedBy: testData.rejectedBy,
              rejectionReason: testData.rejectionReason,
              viewLink: buildEmailLoginLink({
                emailId: email,
                redirectPath: "/admin/previlages/apply-leave?tab=myleaverequests"
              })
            }
          },
          true
        );
        console.log(`INFO: Test rejection email sent successfully to ${email}`);
      } else {
        await sendEmail(
          email,
          `Leave Request Approved - Test`,
          {
            name: testData.name,
            leaveApproved: true,
            leaveDetails: {
              leaveType: testData.leaveType,
              fromDate: testData.fromDate,
              toDate: testData.toDate,
              finalApprovedBy: testData.finalApprovedBy,
              viewLink: buildEmailLoginLink({
                emailId: email,
                redirectPath: "/admin/previlages/apply-leave?tab=myteam"
              })
            }
          },
          true
        );
        console.log(`INFO: Test approval email sent successfully to ${email}`);
      }

      return successResponse(res, {
        message: `Test ${testType} email sent successfully to ${email}`,
        testData: testData
      });
    } catch (emailError) {
      console.error(`ERROR: Failed to send test ${testType} email:`, emailError);
      return errorResponse(res, `Failed to send test email: ${emailError.message}`, 500);
    }
  } catch (error) {
    return errorResponse(res, error);
  }
};



// Debug endpoint to test workflow selection logic
const debugWorkflowSelection = async (req, res) => {
  try {
    const { companyId, days } = req.query;

    if (!companyId || !days) {
      return errorResponse(res, "companyId and days parameters are required", 400);
    }

    const leaveDays = parseFloat(days);

    if (isNaN(leaveDays)) {
      return errorResponse(res, "days must be a valid number", 400);
    }

    console.log(`INFO: Testing workflow selection for ${leaveDays} days in company ${companyId}`);

    // Get all workflows
    const allWorkflows = await WorkflowModel.find({
      companyId,
      "transactionType.id": "leave_request"
    }).sort({ createdAt: 1 });

    // Find matching workflow
    const matchingWorkflow = await findMatchingWorkflow(companyId, leaveDays);

    // Evaluate each workflow
    const workflowEvaluations = allWorkflows.map(workflow => {
      const condition = workflow.workflowDetails?.condition;
      const matches = evaluateWorkflowCondition(condition, leaveDays);

      return {
        _id: workflow._id,
        name: workflow.workflowDetails?.name,
        condition: condition,
        matches: matches,
        approvalLevels: Object.keys(workflow.approvalChain || {}).length,
        approvers: workflow.approvalChain
      };
    });

    const debugInfo = {
      companyId: companyId,
      leaveDays: leaveDays,
      totalWorkflows: allWorkflows.length,
      selectedWorkflow: matchingWorkflow ? {
        _id: matchingWorkflow._id,
        name: matchingWorkflow.workflowDetails?.name,
        condition: matchingWorkflow.workflowDetails?.condition,
        approvalLevels: Object.keys(matchingWorkflow.approvalChain || {}).length
      } : null,
      workflowEvaluations: workflowEvaluations
    };

    return successResponse(res, debugInfo, "Debug information retrieved successfully");
  } catch (error) {
    return errorResponse(res, error);
  }
};





module.exports = {
  createLeave,
  getAllLeaves,
  getLeaveById,
  updateLeave,
  deleteLeave,
  getSummary,
  approveLeave,
  getPendingApprovals,
  getApprovalDashboard,
  debugPendingApprovals,
  testEmailTemplates,
  debugWorkflowSelection,

};

