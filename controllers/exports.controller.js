const Employee = require("../models/employee.model");
const Objectives = require("../models/objectives.model");
const LeavesModel = require("../models/recruitment/Leaves/Leaves.model");
const { buildLeavesFilters } = require("../services/leavesQuery.service");
const { getAllTasks } = require("./tasks2.controller");
const { sendExportResponse, formatDate } = require("../utils/exportHelper");

const badRequest = (res, message) => res.status(400).send({ success: false, message });

const cleanId = (value) => {
  if (value == null) return "";
  if (typeof value === "object") {
    return String(value._id || value.id || "").trim();
  }
  return String(value).replace(/^"|"$/g, "").trim();
};

const flattenTasksToExportRows = (tasks) => {
  const rows = [];

  const walk = (items, level = 0) => {
    (items || []).forEach((task) => {
      rows.push({
        type: level === 0 ? "Task" : "Sub Task",
        title: task.title || "",
        description: task.description || "",
        progress: task.progressStatus ?? "",
        status: task.status || "",
        owner: task.owner || "",
        assignee: task.employeeName || "",
        dueDate: task.dueDate || "",
        startDate: task.startDate || "",
        priority: task.priority || "",
        createdAt: task.createdAt || "",
      });
      if (Array.isArray(task.children) && task.children.length) {
        walk(task.children, level + 1);
      }
    });
  };

  walk(tasks);
  return rows;
};

// GET /exports/employees?companyId=...
const exportEmployees = async (req, res) => {
  try {
    const { companyId } = req.query;
    if (!companyId) return badRequest(res, "companyId is required");

    const employees = await Employee.find({ companyId }).lean();

    const columns = [
      { key: "employeeNumber", label: "Employee Number" },
      { key: "firstName", label: "First Name" },
      { key: "lastName", label: "Last Name" },
      { key: "email", label: "Email" },
      { key: "workEmail", label: "Work Email" },
      { key: "mobileNumber", label: "Mobile Number" },
      { key: "department", label: "Department" },
      { key: "designation", label: "Designation" },
      { key: "grade", label: "Grade" },
      { key: "location", label: "Location" },
      { key: "status", label: "Status" },
      { key: "hireDate", label: "Hire Date" },
      { key: "inactiveDate", label: "Inactive Date" },
      { key: "gender", label: "Gender" },
      { key: "dateOfBirth", label: "Date of Birth" },
      { key: "maritalStatus", label: "Marital Status" },
      { key: "education", label: "Highest Education Level" },
      { key: "religion", label: "Religion" },
      { key: "lineManager", label: "Line Manager" },
    ];

    const rows = employees.map((e) => ({
      employeeNumber: e.employmentInformation?.employeeNumber || "",
      firstName: e.personalInformation?.firstName || "",
      lastName: e.personalInformation?.lastName || "",
      email: e.contactInformation?.email || "",
      workEmail: e.contactInformation?.workEmail || "",
      mobileNumber: e.contactInformation?.mobileNumber || "",
      department: e.employmentInformation?.department || "",
      designation: e.employmentInformation?.designation || "",
      grade: e.employmentInformation?.grade || "",
      location: e.employmentInformation?.location || "",
      status: e.employmentInformation?.status || e.status || "",
      hireDate: e.employmentInformation?.hireDate ? formatDate(e.employmentInformation.hireDate) : "",
      inactiveDate: e.employmentInformation?.inactiveDate ? formatDate(e.employmentInformation.inactiveDate) : "",
      gender: e.personalInformation?.gender || "",
      dateOfBirth: e.personalInformation?.dateOfBirth ? formatDate(e.personalInformation.dateOfBirth) : "",
      maritalStatus: e.employmentInformation?.maritalStatus || "",
      education: e.employmentInformation?.highestEducationLevel || "",
      religion: e.employmentInformation?.religion || "",
      lineManager: e.employmentInformation?.lineManager || "",
    }));

    return sendExportResponse(res, {
      columns,
      rows,
      filename: "employees_export",
      format: req.query.format,
    });
  } catch (err) {
    return res.status(500).send({ success: false, message: err?.message || "Failed to export employees" });
  }
};

// GET /exports/leaves?companyId=...&type=...&currentUserId=...&startDate=...&endDate=...
const exportLeaves = async (req, res) => {
  try {
    const companyId = cleanId(req.query.companyId);
    const currentUserId = cleanId(req.query.currentUserId);
    const { format } = req.query;
    if (!companyId) return badRequest(res, "companyId is required");
    if (!currentUserId) return badRequest(res, "currentUserId is required");

    const { filters } = await buildLeavesFilters({
      ...req.query,
      companyId,
      currentUserId,
    });
    const leaves = await LeavesModel.find(filters).sort({ createdAt: -1 }).lean();

    const columns = [
      { key: "employeeId", label: "Employee ID" },
      { key: "employeeName", label: "Employee Name" },
      { key: "department", label: "Department" },
      { key: "leaveType", label: "Leave Type" },
      { key: "leaveFromDate", label: "Leave From Date", format: (r) => formatDate(r.leaveFromDate) },
      { key: "leaveToDate", label: "Leave To Date", format: (r) => formatDate(r.leaveToDate) },
      { key: "duration", label: "Duration" },
      { key: "status", label: "Status" },
      { key: "pendingWith", label: "Pending With" },
      { key: "note", label: "Note" },
    ];

    const rows = leaves.map((leave) => ({
      employeeId: leave.employeeInfo?.employeeNumber || leave.empId || "",
      employeeName: leave.employeeInfo?.name || "",
      department: leave.employeeInfo?.department || "",
      leaveType: leave.absenceType || "",
      leaveFromDate: leave.from,
      leaveToDate: leave.to,
      duration: leave.durationOfAbsence || "",
      status: leave.status || "",
      pendingWith:
        leave.status === "pending" && Array.isArray(leave.currentApprovers) && leave.currentApprovers.length
          ? leave.currentApprovers.map((a) => a.approverName || a.approverId).join(", ")
          : "N/A",
      note: leave.note || "",
    }));

    return sendExportResponse(res, {
      columns,
      rows,
      filename: `leave-records-export-${formatDate(new Date())}`,
      format,
    });
  } catch (err) {
    return res.status(500).send({ success: false, message: err?.message || "Failed to export leaves" });
  }
};

// GET /exports/tasks/:userId/:companyId?type=...&search=...
const exportTasks = async (req, res) => {
  try {
    const userId = cleanId(req.params.userId);
    const companyId = cleanId(req.params.companyId);
    const { type, search, format } = req.query;
    if (!userId || !companyId) return badRequest(res, "userId and companyId are required");

    let responseBody = null;
    let statusCode = 200;
    const mockRes = {
      status(code) {
        statusCode = code;
        return this;
      },
      send(body) {
        responseBody = body;
        return this;
      },
    };

    await getAllTasks(
      {
        params: { userId, companyId },
        query: { type, search, exportAll: "true" },
      },
      mockRes
    );

    if (statusCode !== 200 || responseBody?.success === false) {
      return res.status(statusCode || 500).send({
        success: false,
        message: responseBody?.message || "Failed to fetch tasks for export",
      });
    }

    const tasks = responseBody?.data || [];
    const rows = flattenTasksToExportRows(tasks);

    const columns = [
      { key: "type", label: "Type" },
      { key: "title", label: "Title" },
      { key: "description", label: "Description" },
      { key: "progress", label: "Progress (%)" },
      { key: "status", label: "Status" },
      { key: "owner", label: "Owner" },
      { key: "assignee", label: "Assignee" },
      { key: "startDate", label: "Start Date", format: (r) => formatDate(r.startDate) },
      { key: "dueDate", label: "Due Date", format: (r) => formatDate(r.dueDate) },
      { key: "priority", label: "Priority" },
      { key: "createdAt", label: "Created At", format: (r) => formatDate(r.createdAt) },
    ];

    return sendExportResponse(res, {
      columns,
      rows,
      filename: `tasks-export-${formatDate(new Date())}`,
      format,
    });
  } catch (err) {
    return res.status(500).send({ success: false, message: err?.message || "Failed to export tasks" });
  }
};

// GET /exports/objectives?companyId=...&userId=...&type=...&okrYear=...
const exportObjectives = async (req, res) => {
  try {
    const { companyId, userId, type, okrYear, empId, format } = req.query;
    if (!companyId) return badRequest(res, "companyId is required");

    const objectiveQuery = { companyId };
    if (okrYear) objectiveQuery.okrYear = okrYear;
    if (empId) objectiveQuery.employeeReferenceId = empId;

    const normalizedType = (type || "me").toString().trim().toLowerCase();
    let employeeIds = null;

    if (normalizedType === "me" && userId) {
      objectiveQuery.employeeReferenceId = userId;
    } else if ((normalizedType === "myteam" || normalizedType === "team") && userId) {
      const teamMembers = await Employee.find({
        companyId,
        "employmentInformation.status": "Active",
        "employmentInformation.lineManager": userId,
      }).select("_id");
      employeeIds = teamMembers.map((m) => m._id.toString());
      if (employeeIds.length) {
        objectiveQuery.employeeReferenceId = { $in: employeeIds };
      }
    } else if ((normalizedType === "myfunction" || normalizedType === "function") && userId) {
      const currentUser = await Employee.findById(userId).select(
        "employmentInformation.department employmentInformation.legalEntityMappings"
      );
      let userFunctions = [];
      if (currentUser?.employmentInformation?.department) {
        userFunctions.push(currentUser.employmentInformation.department);
      }
      if (Array.isArray(currentUser?.employmentInformation?.legalEntityMappings)) {
        currentUser.employmentInformation.legalEntityMappings.forEach((m) => {
          if (m.function) userFunctions.push(m.function);
        });
      }
      userFunctions = [...new Set(userFunctions)];
      if (userFunctions.length) {
        const functionMembers = await Employee.find({
          companyId,
          "employmentInformation.status": "Active",
          $or: [
            { "employmentInformation.department": { $in: userFunctions } },
            { "employmentInformation.legalEntityMappings.function": { $in: userFunctions } },
          ],
        }).select("_id");
        employeeIds = functionMembers.map((m) => m._id.toString());
        if (employeeIds.length) {
          objectiveQuery.employeeReferenceId = { $in: employeeIds };
        }
      }
    }

    const [objectives, employees] = await Promise.all([
      Objectives.find(objectiveQuery).lean(),
      Employee.find({ companyId })
        .select(
          "_id personalInformation.firstName personalInformation.lastName employmentInformation.employeeNumber employmentInformation.department employmentInformation.designation employmentInformation.legalEntityMappings"
        )
        .lean(),
    ]);

    const employeeMap = new Map(employees.map((e) => [e._id.toString(), e]));

    const getFunctionName = (emp) => {
      if (!emp?.employmentInformation) return "";
      const primary = emp.employmentInformation.legalEntityMappings?.find((m) => m.type === "PRIMARY");
      return primary?.function || emp.employmentInformation.department || "";
    };

    const columns = [
      { key: "employeeNumber", label: "Employee Number" },
      { key: "employeeName", label: "Employee Name" },
      { key: "functionName", label: "Function Name" },
      { key: "designation", label: "Designation" },
      { key: "okrPeriod", label: "OKR Period" },
      { key: "okrYear", label: "OKR Year" },
      { key: "objective", label: "Objective" },
      { key: "dueDate", label: "Due Date", format: (r) => formatDate(r.dueDate) },
      { key: "weight", label: "Weight" },
      { key: "successMetrics", label: "Success Metrics" },
      { key: "progressStatus", label: "Progress (%)" },
      { key: "status", label: "Status" },
      { key: "dimension", label: "Dimension" },
      { key: "objectiveStatus", label: "Objective Status" },
    ];

    const rows = objectives.map((o) => {
      const emp = employeeMap.get((o.employeeReferenceId || o.owner || "").toString());
      return {
        employeeNumber: emp?.employmentInformation?.employeeNumber || "",
        employeeName: emp
          ? `${emp.personalInformation?.firstName || ""} ${emp.personalInformation?.lastName || ""}`.trim()
          : "",
        functionName: getFunctionName(emp),
        designation: emp?.employmentInformation?.designation || "",
        okrPeriod: o.okrPeriod || "",
        okrYear: o.okrYear || "",
        objective: o.objective || "",
        dueDate: o.dueDate,
        weight: o.weight ?? "",
        successMetrics: o.successMetrics || "",
        progressStatus: typeof o.progressStatus === "number" ? Math.min(100, Math.max(0, o.progressStatus)) : "",
        status: o.status || "",
        dimension: o.dimension || "",
        objectiveStatus: o.objectiveStatus || "",
      };
    });

    return sendExportResponse(res, {
      columns,
      rows,
      filename: `objectives-export-${formatDate(new Date())}`,
      format,
    });
  } catch (err) {
    return res.status(500).send({ success: false, message: err?.message || "Failed to export objectives" });
  }
};

// GET /exports/time-entries?companyId=...&from=...&to=...&type=...&currentUserId=...
// Delegates to time-tracking list logic via internal request forwarding pattern
const exportTimeEntries = async (req, res) => {
  try {
    const { getTimeTrackingsForExport } = require("../services/timeTrackingExport.service");
    const companyId = cleanId(req.query.companyId);
    const currentUserId = cleanId(req.query.currentUserId);
    const { format } = req.query;
    if (!companyId) return badRequest(res, "companyId is required");
    if (!currentUserId) return badRequest(res, "currentUserId is required");

    const entries = await getTimeTrackingsForExport({
      ...req.query,
      companyId,
      currentUserId,
    });

    const columns = [
      { key: "employeeNumber", label: "Employee Number" },
      { key: "employeeName", label: "Employee Name" },
      { key: "email", label: "Email" },
      { key: "department", label: "Department" },
      { key: "date", label: "Date" },
      { key: "day", label: "Day" },
      { key: "timeIn", label: "Time In" },
      { key: "timeOut", label: "Time Out" },
      { key: "hours", label: "Hours" },
      { key: "method", label: "Method" },
      { key: "status", label: "Status" },
      { key: "comments", label: "Comments" },
    ];

    const rows = entries.map((en) => ({
      employeeNumber: en.employeeNumber || "",
      employeeName: en.employeeName || "",
      email: en.email || "",
      department: en.department || "",
      date: en.dateString || "",
      day: en.day || "",
      timeIn: en.timeIn || "",
      timeOut: en.timeOut || "",
      hours: en.hours || "",
      method: en.method || "",
      status: en.status || "",
      comments: en.comments || "",
    }));

    return sendExportResponse(res, {
      columns,
      rows,
      filename: `time-entries-export-${formatDate(new Date())}`,
      format,
    });
  } catch (err) {
    return res.status(500).send({ success: false, message: err?.message || "Failed to export time entries" });
  }
};

module.exports = {
  exportEmployees,
  exportLeaves,
  exportTasks,
  exportObjectives,
  exportTimeEntries,
};
