const mongoose = require("mongoose");
const EmployeeModel = require("../models/employee.model");

/**
 * Builds MongoDB filters for leave queries — shared by list and export endpoints.
 */
const buildLeavesFilters = async (query) => {
  const search = query.search || "";
  const { companyId, empId, currentUserId, status, viewType, id, from, startDate, endDate } = query;
  const normalizedType = (query.type || "me").toString().trim().toLowerCase();
  const cleanCompanyId = (companyId || "").toString().replace(/^"|"$/g, "").trim();

  let filters = {};
  let useOrQuery = false;
  let orConditions = [];

  if (cleanCompanyId) {
    filters.companyId = cleanCompanyId;
  }

  if (id) {
    filters._id = id;
  }

  if (startDate && endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    filters.$and = filters.$and || [];
    filters.$and.push({ from: { $lte: end } }, { to: { $gte: start } });
  }

  const userObjectId = mongoose.Types.ObjectId.isValid(currentUserId)
    ? new mongoose.Types.ObjectId(currentUserId)
    : currentUserId;

  if (normalizedType === "me") {
    if (from === "teamleave") {
      if (currentUserId) {
        const currentUser = await EmployeeModel.findById(currentUserId).select("employmentInformation.lineManager");
        const lineManagerId = currentUser?.employmentInformation?.lineManager;
        if (lineManagerId) {
          const teamMembers = await EmployeeModel.find({
            companyId: cleanCompanyId,
            "employmentInformation.status": "Active",
            "employmentInformation.lineManager": lineManagerId,
          }).select("_id");
          filters.empId = { $in: teamMembers.map((m) => m._id.toString()) };
        } else {
          filters.empId = currentUserId;
        }
      }
    } else if (empId) {
      filters.empId = empId;
    } else if (currentUserId) {
      useOrQuery = true;
      orConditions.push({ empId: currentUserId });
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
      filters.empId = { $in: teamIds };
    }
  } else if (normalizedType === "myfunction") {
    if (currentUserId) {
      const currentUser = await EmployeeModel.findById(currentUserId).select(
        "employmentInformation.department employmentInformation.legalEntityMappings"
      );
      let userFunctions = [];
      if (currentUser?.employmentInformation) {
        if (currentUser.employmentInformation.department) {
          userFunctions.push(currentUser.employmentInformation.department);
        }
        if (Array.isArray(currentUser.employmentInformation.legalEntityMappings)) {
          currentUser.employmentInformation.legalEntityMappings.forEach((mapping) => {
            if (mapping.function) userFunctions.push(mapping.function);
          });
        }
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
        filters.empId = { $in: functionMembers.map((m) => m._id.toString()) };
      } else {
        filters.empId = currentUserId;
      }
    }
  } else if (normalizedType === "mycompany" || viewType === "all-leaves") {
    // company-wide leaves scoped by companyId only
  } else {
    if (viewType === "pending-approvals" && currentUserId) {
      filters["currentApprovers.approverId"] = userObjectId;
      filters.status = "pending";
    } else if (viewType !== "all-leaves" && currentUserId) {
      useOrQuery = true;
      orConditions.push({ empId: currentUserId });
      orConditions.push({ "currentApprovers.approverId": userObjectId, status: "pending" });
    }
  }

  if (useOrQuery && orConditions.length > 0) {
    filters.$or = orConditions;
  }

  if (status && status !== "all" && !useOrQuery) {
    filters.status = status;
  }

  if (search) {
    const searchRegex = new RegExp(search, "i");
    const searchConditions = [
      { absenceType: searchRegex },
      { note: searchRegex },
      { "employeeInfo.name": searchRegex },
      { "employeeInfo.department": searchRegex },
    ];

    if (useOrQuery) {
      filters.$and = [{ $or: orConditions }, { $or: searchConditions }];
      delete filters.$or;
    } else {
      filters.$or = searchConditions;
    }
  }

  if (status && status !== "all") {
    if (filters.$and) {
      filters.$and.push({ status });
    } else if (filters.$or) {
      filters.$and = [{ $or: filters.$or }, { status }];
      delete filters.$or;
    } else {
      filters.status = status;
    }
  }

  return { filters, cleanCompanyId };
};

module.exports = { buildLeavesFilters };
