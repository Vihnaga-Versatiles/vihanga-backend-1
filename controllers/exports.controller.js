const Employee = require("../models/employee.model");
const Objectives = require("../models/objectives.model");
const TimeTracking = require("../models/timeTrackingModel/TimeTrackingModel");

// Small CSV helper that escapes values per RFC4180 basics
const toCsv = (columns, rows) => {
  const escape = (value) => {
    if (value === null || value === undefined) return "";
    const str = String(value);
    if (/[",\n\r]/.test(str)) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  };
  const header = columns.map(c => escape(c.label)).join(",");
  const lines = rows.map(row => columns.map(c => escape(row[c.key])).join(","));
  return [header, ...lines].join("\r\n");
};

const badRequest = (res, message) => res.status(400).send({ success: false, message });

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
      { key: "lineManager", label: "Line Manager" }
    ];

    const rows = employees.map(e => ({
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
      hireDate: e.employmentInformation?.hireDate ? new Date(e.employmentInformation.hireDate).toISOString().slice(0, 10) : "",
      inactiveDate: e.employmentInformation?.inactiveDate ? new Date(e.employmentInformation.inactiveDate).toISOString().slice(0, 10) : "",
      gender: e.personalInformation?.gender || "",
      dateOfBirth: e.personalInformation?.dateOfBirth ? new Date(e.personalInformation.dateOfBirth).toISOString().slice(0, 10) : "",
      maritalStatus: e.employmentInformation?.maritalStatus || "",
      education: e.employmentInformation?.highestEducationLevel || "",
      religion: e.employmentInformation?.religion || "",
      lineManager: e.employmentInformation?.lineManager || ""
    }));

    const csv = toCsv(columns, rows);
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=employees_export.csv");
    return res.status(200).send(csv);
  } catch (err) {
    return res.status(500).send({ success: false, message: err?.message || "Failed to export employees" });
  }
};

// GET /exports/objectives?companyId=...
const exportObjectives = async (req, res) => {
  try {
    const { companyId } = req.query;
    if (!companyId) return badRequest(res, "companyId is required");

    const [objectives, employees] = await Promise.all([
      Objectives.find({ companyId }).lean(),
      Employee.find({ companyId }).select("_id personalInformation.firstName personalInformation.lastName employmentInformation.employeeNumber employmentInformation.department employmentInformation.designation employmentInformation.legalEntityMappings").lean()
    ]);

    const employeeMap = new Map(
      employees.map(e => [e._id.toString(), e])
    );

    const getFunctionName = (emp) => {
      if (!emp?.employmentInformation) return "";
      const primary = emp.employmentInformation.legalEntityMappings?.find(m => m.type === "PRIMARY");
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
      { key: "dueDate", label: "Due Date" },
      { key: "weight", label: "Weight" },
      { key: "successMetrics", label: "Success Metrics" },
      { key: "progressStatus", label: "Progress (%)" },
      { key: "status", label: "Status" },
      { key: "dimension", label: "Dimension" },
      { key: "objectiveStatus", label: "Objective Status" },
      { key: "approvalRequired", label: "Approval Required" },
      { key: "cascaded", label: "Cascaded" },
      { key: "cascadedType", label: "Cascaded Type" }
    ];

    const rows = objectives.map(o => {
      const emp = employeeMap.get((o.employeeReferenceId || o.owner || "").toString());
      const employeeNumber = emp?.employmentInformation?.employeeNumber || "";
      const employeeName = emp ? `${emp.personalInformation?.firstName || ""} ${emp.personalInformation?.lastName || ""}`.trim() : "";
      const functionName = getFunctionName(emp);
      const designation = emp?.employmentInformation?.designation || "";
      return {
        employeeNumber,
        employeeName,
        functionName,
        designation,
        okrPeriod: o.okrPeriod || "",
        okrYear: o.okrYear || "",
        objective: o.objective || "",
        dueDate: o.dueDate ? new Date(o.dueDate).toISOString().slice(0, 10) : "",
        weight: o.weight ?? "",
        successMetrics: o.successMetrics || "",
        progressStatus: typeof o.progressStatus === "number" ? Math.min(100, Math.max(0, o.progressStatus)) : "",
        status: o.status || "",
        dimension: o.dimension || "",
        objectiveStatus: o.objectiveStatus || "",
        approvalRequired: o.approvalRequired ? "Yes" : "No",
        cascaded: o.cascaded ? "Yes" : "No",
        cascadedType: o.cascadedType || ""
      };
    });

    const csv = toCsv(columns, rows);
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=objectives_export.csv");
    return res.status(200).send(csv);
  } catch (err) {
    return res.status(500).send({ success: false, message: err?.message || "Failed to export objectives" });
  }
};

// GET /exports/time-entries?companyId=...&start=YYYY-MM-DD&end=YYYY-MM-DD
const exportTimeEntries = async (req, res) => {
  try {
    const { companyId, start, end } = req.query;
    if (!companyId) return badRequest(res, "companyId is required");

    const dateFilter = {};
    if (start || end) {
      // dateString is in M/D/YYYY format in many places, but timestamps exist as createdAt
      // Use createdAt for robust filtering when provided
      dateFilter.createdAt = {};
      if (start) dateFilter.createdAt.$gte = new Date(start + "T00:00:00.000Z");
      if (end) dateFilter.createdAt.$lte = new Date(end + "T23:59:59.999Z");
    }

    const entries = await TimeTracking.find({ companyId, ...dateFilter }).lean();
    const userIds = Array.from(new Set(entries.map(e => (e.userId || "").toString()).filter(Boolean)));
    const employees = await Employee.find({ _id: { $in: userIds } })
      .select("_id personalInformation.firstName personalInformation.lastName contactInformation.email employmentInformation.employeeNumber employmentInformation.department")
      .lean();
    const employeeMap = new Map(employees.map(e => [e._id.toString(), e]));

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
      { key: "longitude", label: "Longitude" },
      { key: "latitude", label: "Latitude" },
      { key: "comments", label: "Comments" }
    ];

    const rows = entries.map(en => {
      const emp = employeeMap.get((en.userId || "").toString());
      const fallbackName = `${en.employeeInfo?.name || ""}`.trim();
      return {
        employeeNumber: emp?.employmentInformation?.employeeNumber || "",
        employeeName: (emp ? `${emp.personalInformation?.firstName || ""} ${emp.personalInformation?.lastName || ""}`.trim() : fallbackName) || "",
        email: emp?.contactInformation?.email || en.employeeInfo?.email || "",
        department: emp?.employmentInformation?.department || en.employeeInfo?.department || "",
        date: en.dateString || "",
        day: en.day || "",
        timeIn: en.timeIn || "",
        timeOut: en.timeOut || "",
        hours: en.hours || "",
        method: en.method || "",
        status: en.status || "",
        longitude: typeof en.longitude === "number" ? en.longitude : "",
        latitude: typeof en.latitude === "number" ? en.latitude : "",
        comments: en.comments || ""
      };
    });

    const csv = toCsv(columns, rows);
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=time_entries_export.csv");
    return res.status(200).send(csv);
  } catch (err) {
    return res.status(500).send({ success: false, message: err?.message || "Failed to export time entries" });
  }
};

module.exports = {
  exportEmployees,
  exportObjectives,
  exportTimeEntries
};


