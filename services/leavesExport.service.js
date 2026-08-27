const EmployeeModel = require("../models/employee.model");
const { formatDate } = require("../utils/exportHelper");

const LEAVE_EXPORT_COLUMNS = [
  { key: "employeeNumber", label: "Employee Number" },
  { key: "employeeName", label: "Employee Name" },
  { key: "legalEntity", label: "Legal Entity" },
  { key: "department", label: "Department" },
  { key: "designation", label: "Designation" },
  { key: "leaveType", label: "Leave Type" },
  { key: "leaveFromDate", label: "Leave From Date", format: (r) => formatDate(r.leaveFromDate) },
  { key: "leaveToDate", label: "Leave To Date", format: (r) => formatDate(r.leaveToDate) },
  { key: "duration", label: "Duration" },
  { key: "status", label: "Status" },
  { key: "pendingWith", label: "Pending With" },
  { key: "note", label: "Note" },
];

const getEmployeeLegalEntity = (emp) => {
  if (!emp?.employmentInformation) return "";
  const primary = emp.employmentInformation.legalEntityMappings?.find((m) => m.type === "PRIMARY");
  return primary?.legalEntity || emp.employmentInformation.legalEntity || "";
};

const getEmployeeDesignation = (emp, leave) => {
  if (emp?.employmentInformation) {
    return (
      emp.employmentInformation.designation ||
      emp.employmentInformation.position ||
      ""
    );
  }
  return leave?.employeeInfo?.position || "";
};

const buildLeaveExportRows = async (leaves) => {
  const safeLeaves = Array.isArray(leaves) ? leaves : [];
  const empIds = [...new Set(safeLeaves.map((leave) => String(leave.empId || "")).filter(Boolean))];

  const employees = empIds.length
    ? await EmployeeModel.find({ _id: { $in: empIds } })
        .select(
          "_id employmentInformation.employeeNumber employmentInformation.legalEntity employmentInformation.department employmentInformation.designation employmentInformation.position employmentInformation.legalEntityMappings"
        )
        .lean()
    : [];

  const employeeMap = new Map(employees.map((emp) => [emp._id.toString(), emp]));

  return safeLeaves.map((leave) => {
    const emp = employeeMap.get(String(leave.empId || ""));

    return {
      employeeNumber: emp?.employmentInformation?.employeeNumber || leave.employeeInfo?.employeeNumber || "",
      employeeName: leave.employeeInfo?.name || "",
      legalEntity: getEmployeeLegalEntity(emp),
      department: emp?.employmentInformation?.department || leave.employeeInfo?.department || "",
      designation: getEmployeeDesignation(emp, leave),
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
    };
  });
};

module.exports = {
  LEAVE_EXPORT_COLUMNS,
  buildLeaveExportRows,
};
