const ErrorLog = require("../models/ErrorLog");
const { successResponse, errorResponse } = require("../utils/recruitment/responseHandler");

// GET /api/error-logs
// Query params: fromDate, toDate, module, stage, companyId, candidateId, statusCode, search, page, limit
const getErrorLogs = async (req, res) => {
  try {
    const {
      fromDate,
      toDate,
      module,
      stage,
      companyId,
      candidateId,
      statusCode,
      search = "",
    } = req.query;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const skip = (page - 1) * limit;

    const filter = {};

    if (fromDate || toDate) {
      filter.createdAt = {};
      if (fromDate) {
        const from = new Date(fromDate);
        // normalize to start of day (local time)
        from.setHours(0, 0, 0, 0);
        filter.createdAt.$gte = from;
      }
      if (toDate) {
        const to = new Date(toDate);
        // normalize to end of day (local time)
        to.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = to;
      }
    }
    if (module && module.toLowerCase() !== "all") {
      filter.module = new RegExp(`^${module}$`, "i");
    }
    if (stage && stage.toLowerCase() !== "all") {
      filter.stage = new RegExp(stage, "i");
    }
    if (companyId) filter.companyId = companyId;
    if (candidateId) filter.candidateId = candidateId;
    if (statusCode) filter.statusCode = parseInt(statusCode, 10);

    if (search) {
      const regex = new RegExp(search, "i");
      filter.$or = [
        { message: regex },
        { path: regex },
        { userEmail: regex },
        { module: regex },
        { stage: regex },
        { candidateId: regex },
      ];
    }

    const total = await ErrorLog.countDocuments(filter);
    const data = await ErrorLog.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    return successResponse(res, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      data,
    }, "Fetched error logs");
  } catch (error) {
    return errorResponse(res, error);
  }
};

// GET /api/error-logs/modules - list modules and stages
const getErrorLogFacets = async (req, res) => {
  try {
    const facets = await ErrorLog.aggregate([
      {
        $group: {
          _id: { module: "$module", stage: "$stage" },
        },
      },
      {
        $group: {
          _id: "$_id.module",
          stages: { $addToSet: "$_id.stage" },
        },
      },
      {
        $project: {
          _id: 0,
          module: "$_id",
          stages: 1,
        },
      },
      { $sort: { module: 1 } },
    ]);
    return successResponse(res, facets, "Fetched modules and stages");
  } catch (error) {
    return errorResponse(res, error);
  }
};

// GET /api/error-logs/:id
const getErrorLogById = async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await ErrorLog.findById(id);
    if (!doc) {
      return errorResponse(res, new Error("Log not found"), 404);
    }
    return successResponse(res, doc, "Fetched error log");
  } catch (error) {
    return errorResponse(res, error);
  }
};

module.exports = {
  getErrorLogs,
  getErrorLogFacets,
  getErrorLogById,
};


