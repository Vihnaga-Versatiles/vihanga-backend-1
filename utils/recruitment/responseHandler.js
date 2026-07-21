//order  here is respeonse stastus,message,data
const successResponse = (res, data, message = "Success", statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
};

const ErrorLog = require("../../models/ErrorLog");

const errorResponse = (res, error, statusCode = 500) => {
  // Attempt to persist error log without blocking the response
  try {
    const req = res?.req || {};
    const originalUrl = req.originalUrl || "";
    const baseUrl = req.baseUrl || "";
    const path = originalUrl || req?.route?.path || baseUrl || "";
    // Derive module from first segment after /api/
    let module = "General";
    const apiIndex = path.indexOf("/api/");
    if (apiIndex > -1) {
      const after = path.substring(apiIndex + 5);
      module = (after.split("/")[0] || "General").replace(/-/g, " ");
      module = module
        .split(" ")
        .map((s) => (s ? s[0].toUpperCase() + s.slice(1) : s))
        .join(" ");
    } else if (baseUrl) {
      const after = baseUrl.replace(/^\//, "");
      module = (after.split("/")[0] || "General");
    }

    const derivedStage =
      (req.body && (req.body.status || req.body.stage)) ||
      (req.query && (req.query.status || req.query.stage)) ||
      (req.params && (req.params.stage || req.params.status)) ||
      (req.route && req.route.path) ||
      "";

    // Prefix candidateId into message for easier keyword search
    const candidateIdForMsg =
      (req.body && (req.body.candidateId || req.body._id)) ||
      (req.query && (req.query.candidateId || req.query._id)) ||
      (req.params && (req.params.candidateId || req.params.id)) ||
      "";
    const finalMessage =
      (candidateIdForMsg ? `[${candidateIdForMsg}] ` : "") +
      ((error && (error.message || error.msg || error.toString?.())) ||
        "Something went wrong");

    const logDoc = {
      module,
      stage: String(derivedStage || "").toString(),
      action: req.method || "",
      method: req.method || "",
      path,
      query: req.query || {},
      params: req.params || {},
      body: req.body || {},
      headers: {
        "user-agent": req.headers ? req.headers["user-agent"] : undefined,
        "content-type": req.headers ? req.headers["content-type"] : undefined,
      },
      ip: (req.headers && req.headers["x-forwarded-for"]) || req.ip || "",
      companyId:
        (req.body && (req.body.companyId || req.body.companyID)) ||
        (req.query && (req.query.companyId || req.query.companyID)) ||
        "",
      candidateId:
        (req.body && (req.body.candidateId || req.body._id)) ||
        (req.query && (req.query.candidateId || req.query._id)) ||
        (req.params && (req.params.candidateId || req.params.id)) ||
        "",
      userId: (req.user && req.user._id) || "",
      userEmail: (req.user && req.user.email) || "",
      statusCode,
      message: finalMessage,
      stack: (error && error.stack) || "",
      rawError:
        error && typeof error === "object"
          ? { ...error }
          : { value: String(error) },
    };
    // Fire and forget
    ErrorLog.create(logDoc).catch(() => {});
  } catch (_) {
    // Do not block the response if logging fails
  }

  return res.status(statusCode).json({
    success: false,
    message: error?.message || "Something went wrong",
    error,
  });
};


const normalizeString = (str) => (str || "").replace(/\s+/g, "").toLowerCase();


module.exports = {
  successResponse,
  errorResponse,
  normalizeString,
};
