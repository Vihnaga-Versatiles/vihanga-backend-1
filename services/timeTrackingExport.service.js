const mongoose = require("mongoose");
const TimeTrackingModel = require("../models/timeTrackingModel/TimeTrackingModel");
const EmployeeModel = require("../models/employee.model");

const parseDateString = (dateStr) => {
  if (!dateStr) return null;
  if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(dateStr)) {
    const [day, month, year] = dateStr.split("-");
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return new Date(dateStr);
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateStr)) return new Date(dateStr);
  return new Date(dateStr);
};

const createDateParsingExpression = (dateStr) => ({
  $dateFromString: {
    dateString: dateStr,
    format: {
      $switch: {
        branches: [
          { case: { $regexMatch: { input: dateStr, regex: /^\d{1,2}-\d{1,2}-\d{4}$/ } }, then: "%d-%m-%Y" },
          { case: { $regexMatch: { input: dateStr, regex: /^\d{2} \w{3} \d{4}$/ } }, then: "%d %b %Y" },
          { case: { $regexMatch: { input: dateStr, regex: /^\d{1,2}\/\d{1,2}\/\d{4}$/ } }, then: "%m/%d/%Y" },
          { case: { $regexMatch: { input: dateStr, regex: /^\d{4}-\d{2}-\d{2}$/ } }, then: "%Y-%m-%d" },
        ],
        default: "%d %b %Y",
      },
    },
    onError: null,
  },
});

const buildTimeTrackingFilters = async (query) => {
  const search = query.search || "";
  const { companyId, userId, currentUserId, status, from, to, method } = query;
  const normalizedType = (query.type || "me").toString().trim().toLowerCase();
  const cleanCompanyId = (companyId || "").toString().replace(/^"|"$/g, "").trim();

  let filters = { companyId: cleanCompanyId };
  let useOrQuery = false;
  let orConditions = [];

  const fromDate = parseDateString(from);
  const toDate = parseDateString(to);
  let dateRangeExpr = null;

  if (fromDate && toDate) {
    const toDateInclusive = new Date(toDate);
    toDateInclusive.setDate(toDateInclusive.getDate() + 1);
    dateRangeExpr = {
      $and: [
        { $gte: [createDateParsingExpression("$dateString"), fromDate] },
        { $lt: [createDateParsingExpression("$dateString"), toDateInclusive] },
      ],
    };
    filters.$expr = dateRangeExpr;
  } else if (fromDate) {
    filters.$expr = { $gte: [createDateParsingExpression("$dateString"), fromDate] };
  } else if (toDate) {
    const toDateInclusive = new Date(toDate);
    toDateInclusive.setDate(toDateInclusive.getDate() + 1);
    filters.$expr = { $lt: [createDateParsingExpression("$dateString"), toDateInclusive] };
  }

  const userObjectId = mongoose.Types.ObjectId.isValid(currentUserId)
    ? new mongoose.Types.ObjectId(currentUserId)
    : currentUserId;

  if (normalizedType === "me") {
    if (userId) {
      filters.userId = userId;
    } else if (currentUserId) {
      useOrQuery = true;
      orConditions.push({ userId: currentUserId });
      orConditions.push({ "currentApprovers.approverId": userObjectId, status: "pending" });
    }
  } else if (normalizedType === "myteam") {
    if (currentUserId) {
      const teamMembers = await EmployeeModel.find({
        companyId: cleanCompanyId,
        "employmentInformation.status": "Active",
        "employmentInformation.lineManager": currentUserId,
      }).select("_id");
      const teamIds = teamMembers.map((m) => m._id.toString());
      teamIds.push(currentUserId);
      filters.userId = { $in: teamIds };
    }
  } else if (normalizedType === "myfunction") {
    if (currentUserId) {
      const currentUser = await EmployeeModel.findById(currentUserId).select(
        "employmentInformation.department employmentInformation.legalEntityMappings"
      );
      let userFunctions = [];
      if (currentUser?.employmentInformation?.department) {
        userFunctions.push(currentUser.employmentInformation.department);
      }
      if (Array.isArray(currentUser?.employmentInformation?.legalEntityMappings)) {
        currentUser.employmentInformation.legalEntityMappings.forEach((mapping) => {
          if (mapping.function) userFunctions.push(mapping.function);
        });
      }
      userFunctions = [...new Set(userFunctions)];
      if (userFunctions.length > 0) {
        const functionMembers = await EmployeeModel.find({
          companyId: cleanCompanyId,
          "employmentInformation.status": "Active",
          $or: [
            { "employmentInformation.department": { $in: userFunctions } },
            { "employmentInformation.legalEntityMappings.function": { $in: userFunctions } },
          ],
        }).select("_id");
        filters.userId = { $in: functionMembers.map((m) => m._id.toString()) };
      } else {
        filters.userId = currentUserId;
      }
    }
  }

  if (useOrQuery && orConditions.length > 0) {
    if (filters.$expr) {
      const expr = filters.$expr;
      delete filters.$expr;
      filters.$and = [{ $or: orConditions }, { $expr: expr }];
    } else {
      filters.$or = orConditions;
    }
  }

  if (status && status !== "all") {
    if (filters.$and) filters.$and.push({ status });
    else filters.status = status;
  }

  if (method && method !== "all") {
    filters.method = method.toLowerCase();
  }

  if (search) {
    const searchRegex = new RegExp(search, "i");
    const searchConditions = [
      { day: searchRegex },
      { dateString: searchRegex },
      { method: searchRegex },
      { "employeeInfo.name": searchRegex },
      { "employeeInfo.department": searchRegex },
    ];
    if (filters.$or || filters.$and) {
      filters.$and = filters.$and || [];
      if (filters.$or) {
        filters.$and.push({ $or: filters.$or });
        delete filters.$or;
      }
      filters.$and.push({ $or: searchConditions });
    } else {
      filters.$or = searchConditions;
    }
  }

  return { filters, hasDateRange: Boolean(from || to) };
};

const getTimeTrackingsForExport = async (query) => {
  const { filters, hasDateRange } = await buildTimeTrackingFilters(query);
  const { excludeSelf } = query;

  let entries;
  if (hasDateRange) {
    const pipeline = [
      { $match: filters },
      {
        $addFields: {
          parsedDate: {
            $dateFromString: {
              dateString: "$dateString",
              format: "%d %b %Y",
              onError: null,
            },
          },
        },
      },
      { $sort: { parsedDate: 1, createdAt: 1 } },
    ];
    entries = await TimeTrackingModel.aggregate(pipeline);
  } else {
    entries = await TimeTrackingModel.find(filters).sort({ createdAt: -1 }).lean();
  }

  if (excludeSelf === "true" && query.currentUserId) {
    entries = entries.filter((e) => String(e.userId) !== String(query.currentUserId));
  }

  const userIds = [...new Set(entries.map((e) => String(e.userId || "")).filter(Boolean))];
  const employees = userIds.length
    ? await EmployeeModel.find({ _id: { $in: userIds } })
        .select("_id personalInformation.firstName personalInformation.lastName contactInformation.email employmentInformation.employeeNumber employmentInformation.department")
        .lean()
    : [];
  const employeeMap = new Map(employees.map((e) => [e._id.toString(), e]));

  return entries.map((entry) => {
    const emp = employeeMap.get(String(entry.userId || ""));
    return {
      employeeNumber: emp?.employmentInformation?.employeeNumber || entry.employeeInfo?.employeeNumber || "",
      employeeName:
        emp
          ? `${emp.personalInformation?.firstName || ""} ${emp.personalInformation?.lastName || ""}`.trim()
          : entry.employeeInfo?.name || "",
      email: emp?.contactInformation?.email || entry.employeeInfo?.email || "",
      department: emp?.employmentInformation?.department || entry.employeeInfo?.department || "",
      dateString: entry.dateString || "",
      day: entry.day || "",
      timeIn: entry.timeIn || "",
      timeOut: entry.timeOut || "",
      hours: entry.hours || "",
      method: entry.method || "",
      status: entry.status || "",
      comments: entry.comments || entry.reason || "",
      userId: entry.userId,
    };
  });
};

module.exports = { getTimeTrackingsForExport, buildTimeTrackingFilters };
