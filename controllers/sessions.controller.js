const LoginSessionModel = require("../models/LoginSession.model");
const EmployModel = require("../models/employee.model");

// Helper to compute if a session is expired (no logout and older than 1 day)
function isExpired(session) {
  if (session.logoutAt) return false;
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return session.loginAt < oneDayAgo;
}

const getActiveSessions = async (req, res) => {
  try {
    const { companyId } = req.params;
    let sessions = await LoginSessionModel.find({ companyId }).sort({ loginAt: -1 });
    // Fallback: include sessions missing companyId but employee belongs to companyId
    if (sessions.length === 0) {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const joined = await LoginSessionModel.aggregate([
        { $match: { loginAt: { $gt: oneDayAgo }, logoutAt: null } },
        { $lookup: { from: "employees", localField: "employeeId", foreignField: "_id", as: "emp" } },
        { $unwind: "$emp" },
        { $match: { "emp.companyId": companyId } },
        { $sort: { loginAt: -1 } },
      ]);
      sessions = joined.map((j) => ({ ...j, companyId }));
    }
    const now = Date.now();
    const active = sessions.filter((s) => !s.logoutAt && (new Date(s.loginAt).getTime() > now - 24 * 60 * 60 * 1000));

    const result = active.map((s) => ({
      employeeId: s.employeeId,
      empId: s.employeeNumber,
      name: s.name,
      designation: s.designation,
      department: s.department,
      location: s.location,
      role: s.role,
      email: s.email,
      loginAt: s.loginAt,
      logoutAt: s.logoutAt,
      status: isExpired(s) ? "Expired" : s.status,
      ipAddress: s.ipAddress,
      userAgent: s.userAgent,
    }));

    res.status(200).send({ success: true, data: result });
  } catch (e) {
    res.status(500).send({ success: false, message: e.message });
  }
};

// Employees who are not currently active (no active session within last day)
const getNotActiveEmployees = async (req, res) => {
  try {
    const { companyId } = req.params;
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const employees = await EmployModel.find({ companyId, "employmentInformation.status": "Active" }).select("_id personalInformation.firstName personalInformation.lastName employmentInformation.employeeNumber employmentInformation.designation employmentInformation.department employmentInformation.location employmentInformation.role");
    const employeeIds = employees.map((e) => e._id);

    const recentActiveSessions = await LoginSessionModel.aggregate([
      { $match: { companyId, employeeId: { $in: employeeIds }, loginAt: { $gt: oneDayAgo }, logoutAt: null } },
      { $group: { _id: "$employeeId", count: { $sum: 1 } } },
    ]);

    const activeIdSet = new Set(recentActiveSessions.map((r) => String(r._id)));

    const notActive = employees
      .filter((e) => !activeIdSet.has(String(e._id)))
      .map((e) => ({
        employeeId: e._id,
        empId: e.employmentInformation.employeeNumber,
        name: `${e.personalInformation.firstName} ${e.personalInformation.lastName}`.trim(),
        designation: e.employmentInformation.designation,
        department: e.employmentInformation.department,
        location: e.employmentInformation.location,
        role: e.employmentInformation.role,
      }));

    res.status(200).send({ success: true, data: notActive });
  } catch (e) {
    res.status(500).send({ success: false, message: e.message });
  }
};

module.exports = {
  getActiveSessions,
  getNotActiveEmployees,
};

// History with filters + pagination
const getSessionHistory = async (req, res) => {
  try {
    const { companyId } = req.params;
    const {
      page = 1,
      limit = 10,
      search = "",
      candidateId = "", // maps to employeeNumber
      candidateName = "", // maps to name
      department = [],
      position = [], // designation
      fromDate = "",
      toDate = "",
      stage = [], // status
    } = req.query;

    const numPage = Math.max(parseInt(page, 10) || 1, 1);
    const numLimit = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 1000000000);

    const from = fromDate ? new Date(fromDate) : null;
    const to = toDate ? new Date(new Date(toDate).setHours(23, 59, 59, 999)) : null;

    const pipeline = [
      { $lookup: { from: "employees", localField: "employeeId", foreignField: "_id", as: "emp" } },
      { $unwind: { path: "$emp", preserveNullAndEmptyArrays: true } },
      { $addFields: {
        resolvedCompanyId: { $ifNull: ["$companyId", "$emp.companyId"] },
        resolvedDepartment: { $ifNull: ["$department", "$emp.employmentInformation.department"] },
        resolvedDesignation: { $ifNull: ["$designation", "$emp.employmentInformation.designation"] },
        resolvedLocation: { $ifNull: ["$location", "$emp.employmentInformation.location"] },
        resolvedEmployeeNumber: { $ifNull: ["$employeeNumber", "$emp.employmentInformation.employeeNumber"] },
        resolvedName: { $ifNull: ["$name", { $concat: [ { $ifNull: [ "$emp.personalInformation.firstName", "" ] }, " ", { $ifNull: [ "$emp.personalInformation.lastName", "" ] } ] } ] },
      } },
      { $match: { resolvedCompanyId: companyId } },
    ];

    const andFilters = [];
    if (search) {
      const regex = new RegExp(search, "i");
      andFilters.push({ $or: [
        { resolvedName: { $regex: regex } },
        { email: { $regex: regex } },
        { resolvedEmployeeNumber: { $regex: regex } },
        { resolvedDepartment: { $regex: regex } },
        { resolvedDesignation: { $regex: regex } },
        { resolvedLocation: { $regex: regex } },
      ]});
    }
    if (candidateId) andFilters.push({ resolvedEmployeeNumber: { $regex: new RegExp(candidateId, "i") } });
    if (candidateName) andFilters.push({ resolvedName: { $regex: new RegExp(candidateName, "i") } });
    if (Array.isArray(department) && department.length > 0) andFilters.push({ resolvedDepartment: { $in: department } });
    if (Array.isArray(position) && position.length > 0) andFilters.push({ resolvedDesignation: { $in: position } });
    if (Array.isArray(stage) && stage.length > 0) andFilters.push({ status: { $in: stage } });
    if (from || to) {
      const range = {};
      if (from) range.$gte = from;
      if (to) range.$lte = to;
      andFilters.push({ loginAt: range });
    }
    if (andFilters.length > 0) pipeline.push({ $match: { $and: andFilters } });

    pipeline.push({ $sort: { loginAt: -1 } });
    pipeline.push({ $facet: {
      data: [ { $skip: (numPage - 1) * numLimit }, { $limit: numLimit } ],
      totalCount: [ { $count: "count" } ]
    }});

    const agg = await LoginSessionModel.aggregate(pipeline);
    const dataRaw = (agg[0]?.data) || [];
    const totalCount = (agg[0]?.totalCount?.[0]?.count) || 0;
    const totalPages = Math.ceil(totalCount / numLimit) || 0;

    const data = dataRaw.map((s) => ({
      employeeId: s.employeeId,
      empId: s.employeeNumber || s.resolvedEmployeeNumber,
      name: s.name || s.resolvedName,
      designation: s.designation || s.resolvedDesignation,
      department: s.department || s.resolvedDepartment,
      location: s.location || s.resolvedLocation,
      role: s.role,
      email: s.email,
      loginAt: s.loginAt,
      logoutAt: s.logoutAt,
      status: s.status,
      ipAddress: s.ipAddress,
      userAgent: s.userAgent,
    }));

    res.status(200).send({ success: true, data, page: numPage, totalPages, totalCount });
  } catch (e) {
    res.status(500).send({ success: false, message: e.message });
  }
};

module.exports.getSessionHistory = getSessionHistory;

// Activity users (any activity like tasks/objectives changes) with pagination
const AuditTrailModel = require("../models/AuditTrail");
const getActivityUsers = async (req, res) => {
  try {
    const { companyId } = req.params;
    const {
      page = 1,
      limit = 10,
      search = "",
      fromDate = "",
      toDate = "",
    } = req.query;

    const numPage = Math.max(parseInt(page, 10) || 1, 1);
    const numLimit = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100000000000);

    // 1) Get all employees for this company
    const employees = await EmployModel.find({ companyId }).select("_id personalInformation.firstName personalInformation.lastName employmentInformation");
    if (!employees || employees.length === 0) {
      return res.status(200).send({ success: true, data: [], page: numPage, totalPages: 0, totalCount: 0 });
    }

    const employeeIdStrings = employees.map((e) => String(e._id));

    // 2) Build AuditTrail match (by employee userId string and optional date range)
    const match = { userId: { $in: employeeIdStrings } };
    if (fromDate || toDate) {
      const from = fromDate ? new Date(fromDate) : new Date(0);
      const to = toDate ? new Date(new Date(toDate).setHours(23, 59, 59, 999)) : new Date();
      match.createdAt = { $gte: from, $lte: to };
    }

    // 3) Aggregate counts by userId
    const grouped = await AuditTrailModel.aggregate([
      { $match: match },
      { $group: { _id: "$userId", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    // 4) Map to employee details; filter by search
    const idToEmp = new Map(employees.map((e) => [String(e._id), e]));
    const regex = search ? new RegExp(search, "i") : null;
    const rows = grouped
      .map((g) => {
        const emp = idToEmp.get(String(g._id));
        if (!emp) return null;
        const name = `${emp.personalInformation?.firstName || ''} ${emp.personalInformation?.lastName || ''}`.trim();
        const row = {
          employeeId: emp._id,
          empId: emp.employmentInformation?.employeeNumber,
          name,
          designation: emp.employmentInformation?.designation,
          department: emp.employmentInformation?.department,
          location: emp.employmentInformation?.location,
          activityCount: g.count,
        };
        if (!regex) return row;
        if (
          regex.test(name) ||
          regex.test(String(row.empId || '')) ||
          regex.test(String(row.department || '')) ||
          regex.test(String(row.designation || '')) ||
          regex.test(String(row.location || ''))
        ) {
          return row;
        }
        return null;
      })
      .filter(Boolean);

    const totalCount = rows.length;
    const totalPages = Math.ceil(totalCount / numLimit) || 0;
    const start = (numPage - 1) * numLimit;
    const data = rows.slice(start, start + numLimit);

    res.status(200).send({ success: true, data, page: numPage, totalPages, totalCount });
  } catch (e) {
    res.status(500).send({ success: false, message: e.message });
  }
};

module.exports.getActivityUsers = getActivityUsers;


