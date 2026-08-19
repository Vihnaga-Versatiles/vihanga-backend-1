const { uploadFileToDrive } = require("../../middlewares/recruitment/drive");
const DocumentSubmissionModel = require("../../models/recruitment/DocumentPanel/DocumentSubmissionModel");
const DocumentTypeModel = require("../../models/recruitment/DocumentPanel/DocumentTypeModel");
const EmployeeModel = require("../../models/employee.model");
const { successResponse, errorResponse } = require("../../utils/recruitment/responseHandler");
const AWS = require("aws-sdk");

// Configure AWS SDK for S3 download
const s3 = new AWS.S3({
  region: process.env.AWS_REGION || "ap-south-1",
});

// Helper function to get employee name
const getEmployeeName = async (employeeId) => {
  try {
    const employee = await EmployeeModel.findById(employeeId).select(
      "personalInformation.firstName personalInformation.lastName"
    );
    if (employee && employee.personalInformation) {
      const firstName = employee.personalInformation.firstName || "";
      const lastName = employee.personalInformation.lastName || "";
      return `${firstName} ${lastName}`.trim() || "N/A";
    }
    return "N/A";
  } catch (error) {
    console.error("Error fetching employee name:", error);
    return "N/A";
  }
};

// Create Document Submission
const createDocumentSubmission = async (req, res) => {
  try {
    const { documentTypeId, submissionDate, employeeId, companyId, dynamicFieldValues } = req.body;

    // Validation
    if (!documentTypeId || !submissionDate || !employeeId || !companyId) {
      return errorResponse(
        res,
        { message: "Missing required fields: documentTypeId, submissionDate, employeeId, companyId" },
        400
      );
    }

    // Check if document type exists and is active
    const documentType = await DocumentTypeModel.findOne({
      _id: documentTypeId,
      companyId,
      status: "active",
    });

    if (!documentType) {
      return errorResponse(
        res,
        { message: "Document type not found or inactive" },
        404
      );
    }

    // Parse dynamic field values
    let parsedDynamicFieldValues = {};
    if (dynamicFieldValues) {
      try {
        parsedDynamicFieldValues =
          typeof dynamicFieldValues === "string"
            ? JSON.parse(dynamicFieldValues)
            : dynamicFieldValues;
      } catch (parseError) {
        return errorResponse(
          res,
          { message: "Invalid dynamicFieldValues format" },
          400
        );
      }
    }

    // Handle main document file upload
    let fileUrl = null;
    let fileName = null;
    let fileSize = null;

    // Find the main document file (fieldname: documentFile)
    const mainFile = req.files?.find((file) => file.fieldname === "documentFile");
    
    if (mainFile) {
      const uploaded = await uploadFileToDrive(
        mainFile.buffer,
        mainFile.originalname,
        mainFile.mimetype,
        "document-submissions"
      );
      fileUrl = uploaded.url;
      fileName = mainFile.originalname;
      fileSize = mainFile.size.toString();
    }

    // Handle dynamic file field uploads
    const dynamicFileUrls = {};
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        if (file.fieldname.startsWith("dynamicFile_")) {
          const fieldId = file.fieldname.replace("dynamicFile_", "");
          const uploaded = await uploadFileToDrive(
            file.buffer,
            file.originalname,
            file.mimetype,
            "document-submissions"
          );
          dynamicFileUrls[fieldId] = uploaded.url;
        }
      }
    }

    // Create submission
    const submissionData = {
      companyId,
      employeeId,
      documentTypeId,
      submissionDate: new Date(submissionDate),
      fileUrl,
      fileName,
      fileSize,
      status: "pending",
      dynamicFieldValues: parsedDynamicFieldValues,
      dynamicFileUrls: Object.keys(dynamicFileUrls).length > 0 ? dynamicFileUrls : undefined,
    };

    const newSubmission = new DocumentSubmissionModel(submissionData);
    const savedSubmission = await newSubmission.save();

    // Populate document type name for response
    const populatedSubmission = await DocumentSubmissionModel.findById(savedSubmission._id)
      .populate("documentTypeId", "documentTypeName")
      .lean();

    // Add employee name
    const employeeName = await getEmployeeName(employeeId);
    populatedSubmission.employeeName = employeeName;
    populatedSubmission.documentTypeName = populatedSubmission.documentTypeId?.documentTypeName || "N/A";

    return successResponse(
      res,
      populatedSubmission,
      "Document submitted successfully"
    );
  } catch (error) {
    console.error("Create Document Submission Error:", error);
    return errorResponse(res, error);
  }
};

// Get All Document Submissions
const getAllDocumentSubmissions = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const search = req.query.search || "";
    const companyId = req.query.companyId;
    const employeeId = req.query.employeeId; // For employee view
    const status = req.query.status; // Filter by status

    const filters = {};

    // Company filter
    if (companyId) {
      filters.companyId = companyId;
    }

    // Employee filter (for employee view)
    if (employeeId) {
      filters.employeeId = employeeId;
    }

    // Status filter
    if (status) {
      filters.status = status;
    }

    // Search filter
    if (search) {
      const searchRegex = new RegExp(search, "i");
      filters.$or = [
        { fileName: searchRegex },
        { status: searchRegex },
      ];
    }

    const submissions = await DocumentSubmissionModel.find(filters)
      .populate("documentTypeId", "documentTypeName documentCode")
      .sort({ submissionDate: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Get employee names for all submissions
    const employeeIds = [...new Set(submissions.map((s) => s.employeeId))];
    const employees = await EmployeeModel.find({
      _id: { $in: employeeIds },
    }).select("_id personalInformation.firstName personalInformation.lastName").lean();

    const employeeMap = {};
    employees.forEach((emp) => {
      const firstName = emp.personalInformation?.firstName || "";
      const lastName = emp.personalInformation?.lastName || "";
      employeeMap[emp._id.toString()] = `${firstName} ${lastName}`.trim() || "N/A";
    });

    // Add employee names and document type names
    const enrichedSubmissions = submissions.map((submission) => ({
      ...submission,
      employeeName: employeeMap[submission.employeeId] || "N/A",
      documentTypeName: submission.documentTypeId?.documentTypeName || "N/A",
    }));

    const total = await DocumentSubmissionModel.countDocuments(filters);
    const totalPages = Math.ceil(total / limit);

    const result = {
      totalRecords: total,
      page,
      limit,
      totalPages,
      data: enrichedSubmissions,
    };

    return successResponse(res, result, "Fetched document submissions with pagination");
  } catch (error) {
    console.error("Get All Document Submissions Error:", error);
    return errorResponse(res, error);
  }
};

// Get Document Submission by ID
const getDocumentSubmissionById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return errorResponse(res, { message: "Submission ID is required" }, 400);
    }

    const submission = await DocumentSubmissionModel.findById(id)
      .populate("documentTypeId", "documentTypeName documentCode dynamicFields")
      .lean();

    if (!submission) {
      return errorResponse(res, { message: "Document submission not found" }, 404);
    }

    // Add employee name
    const employeeName = await getEmployeeName(submission.employeeId);
    submission.employeeName = employeeName;
    submission.documentTypeName = submission.documentTypeId?.documentTypeName || "N/A";

    return successResponse(res, submission, "Fetched document submission by ID");
  } catch (error) {
    console.error("Get Document Submission by ID Error:", error);
    return errorResponse(res, error);
  }
};

// Approve Document Submission
const approveDocumentSubmission = async (req, res) => {
  try {
    const { id } = req.params;
    const approvedBy = req.body.approvedBy || req.user?.id; // Get from auth if available

    if (!id) {
      return errorResponse(res, { message: "Submission ID is required" }, 400);
    }

    const submission = await DocumentSubmissionModel.findByIdAndUpdate(
      id,
      {
        status: "approved",
        approvedBy,
        approvedAt: new Date(),
        rejectionReason: null,
      },
      { new: true }
    )
      .populate("documentTypeId", "documentTypeName")
      .lean();

    if (!submission) {
      return errorResponse(res, { message: "Document submission not found" }, 404);
    }

    // Add employee name
    const employeeName = await getEmployeeName(submission.employeeId);
    submission.employeeName = employeeName;
    submission.documentTypeName = submission.documentTypeId?.documentTypeName || "N/A";

    return successResponse(res, submission, "Document approved successfully");
  } catch (error) {
    console.error("Approve Document Submission Error:", error);
    return errorResponse(res, error);
  }
};

// Reject Document Submission
const rejectDocumentSubmission = async (req, res) => {
  try {
    const { id } = req.params;
    const { rejectionReason } = req.body;
    const approvedBy = req.body.approvedBy || req.user?.id; // Get from auth if available

    if (!id) {
      return errorResponse(res, { message: "Submission ID is required" }, 400);
    }

    if (!rejectionReason || !rejectionReason.trim()) {
      return errorResponse(
        res,
        { message: "Rejection reason is required" },
        400
      );
    }

    const submission = await DocumentSubmissionModel.findByIdAndUpdate(
      id,
      {
        status: "rejected",
        approvedBy,
        approvedAt: new Date(),
        rejectionReason: rejectionReason.trim(),
      },
      { new: true }
    )
      .populate("documentTypeId", "documentTypeName")
      .lean();

    if (!submission) {
      return errorResponse(res, { message: "Document submission not found" }, 404);
    }

    // Add employee name
    const employeeName = await getEmployeeName(submission.employeeId);
    submission.employeeName = employeeName;
    submission.documentTypeName = submission.documentTypeId?.documentTypeName || "N/A";

    return successResponse(res, submission, "Document rejected successfully");
  } catch (error) {
    console.error("Reject Document Submission Error:", error);
    return errorResponse(res, error);
  }
};

// Download Document
const downloadDocument = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return errorResponse(res, { message: "Submission ID is required" }, 400);
    }

    const submission = await DocumentSubmissionModel.findById(id);

    if (!submission) {
      return errorResponse(res, { message: "Document submission not found" }, 404);
    }

    if (!submission.fileUrl) {
      return errorResponse(
        res,
        { message: "No file associated with this submission" },
        404
      );
    }

    // Extract S3 key from URL or use the fileUrl directly
    // If fileUrl is a full S3 URL, extract the key
    let s3Key = submission.fileUrl;
    if (submission.fileUrl.includes(process.env.AWS_BUCKET_NAME)) {
      const urlParts = submission.fileUrl.split(process.env.AWS_BUCKET_NAME);
      if (urlParts.length > 1) {
        s3Key = urlParts[1].substring(1); // Remove leading slash
      }
    }

    // Get file from S3
    const params = {
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: s3Key,
    };

    const s3Object = await s3.getObject(params).promise();

    // Set response headers
    res.setHeader("Content-Type", s3Object.ContentType || "application/octet-stream");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${submission.fileName || "document"}"`
    );
    res.setHeader("Content-Length", s3Object.ContentLength);

    // Send file
    res.send(s3Object.Body);
  } catch (error) {
    console.error("Download Document Error:", error);
    if (error.code === "NoSuchKey") {
      return errorResponse(res, { message: "File not found in storage" }, 404);
    }
    return errorResponse(res, error);
  }
};

// Update Document Submission
const updateDocumentSubmission = async (req, res) => {
  try {
    const { id } = req.params;
    const { documentTypeId, submissionDate, dynamicFieldValues } = req.body;

    if (!id) {
      return errorResponse(res, { message: "Submission ID is required" }, 400);
    }

    const submission = await DocumentSubmissionModel.findById(id);
    if (!submission) {
      return errorResponse(res, { message: "Document submission not found" }, 404);
    }

    // Check if submission can be edited (only pending submissions can be edited)
    if (submission.status !== "pending") {
      return errorResponse(
        res,
        { message: "Only pending submissions can be edited" },
        400
      );
    }

    const updateData = {};

    // Update document type if provided
    if (documentTypeId) {
      const documentType = await DocumentTypeModel.findOne({
        _id: documentTypeId,
        companyId: submission.companyId,
        status: "active",
      });

      if (!documentType) {
        return errorResponse(
          res,
          { message: "Document type not found or inactive" },
          404
        );
      }
      updateData.documentTypeId = documentTypeId;
    }

    // Update submission date if provided
    if (submissionDate) {
      updateData.submissionDate = new Date(submissionDate);
    }

    // Parse and update dynamic field values if provided
    if (dynamicFieldValues !== undefined) {
      let parsedDynamicFieldValues = {};
      if (dynamicFieldValues) {
        try {
          parsedDynamicFieldValues =
            typeof dynamicFieldValues === "string"
              ? JSON.parse(dynamicFieldValues)
              : dynamicFieldValues;
        } catch (parseError) {
          return errorResponse(
            res,
            { message: "Invalid dynamicFieldValues format" },
            400
          );
        }
      }
      updateData.dynamicFieldValues = parsedDynamicFieldValues;
    }

    // Handle file upload if provided
    if (req.files && req.files.length > 0) {
      const mainFile = req.files.find((file) => file.fieldname === "documentFile");
      if (mainFile) {
        const uploaded = await uploadFileToDrive(
          mainFile.buffer,
          mainFile.originalname,
          mainFile.mimetype,
          "document-submissions"
        );
        updateData.fileUrl = uploaded.url;
        updateData.fileName = mainFile.originalname;
        updateData.fileSize = mainFile.size.toString();
      }

      // Handle dynamic file field uploads
      const dynamicFileUrls = { ...submission.dynamicFileUrls } || {};
      for (const file of req.files) {
        if (file.fieldname.startsWith("dynamicFile_")) {
          const fieldId = file.fieldname.replace("dynamicFile_", "");
          const uploaded = await uploadFileToDrive(
            file.buffer,
            file.originalname,
            file.mimetype,
            "document-submissions"
          );
          dynamicFileUrls[fieldId] = uploaded.url;
        }
      }
      if (Object.keys(dynamicFileUrls).length > 0) {
        updateData.dynamicFileUrls = dynamicFileUrls;
      }
    }

    // Update the submission
    const updatedSubmission = await DocumentSubmissionModel.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    )
      .populate("documentTypeId", "documentTypeName documentCode")
      .lean();

    // Add employee name
    const employeeName = await getEmployeeName(updatedSubmission.employeeId);
    updatedSubmission.employeeName = employeeName;
    updatedSubmission.documentTypeName = updatedSubmission.documentTypeId?.documentTypeName || "N/A";

    return successResponse(res, updatedSubmission, "Document submission updated successfully");
  } catch (error) {
    console.error("Update Document Submission Error:", error);
    return errorResponse(res, error);
  }
};

// Delete Document Submission
const deleteDocumentSubmission = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return errorResponse(res, { message: "Submission ID is required" }, 400);
    }

    const submission = await DocumentSubmissionModel.findById(id);
    if (!submission) {
      return errorResponse(res, { message: "Document submission not found" }, 404);
    }

    // Check if submission can be deleted (only pending submissions can be deleted)
    if (submission.status !== "pending") {
      return errorResponse(
        res,
        { message: "Only pending submissions can be deleted" },
        400
      );
    }

    await DocumentSubmissionModel.findByIdAndDelete(id);

    return successResponse(res, null, "Document submission deleted successfully");
  } catch (error) {
    console.error("Delete Document Submission Error:", error);
    return errorResponse(res, error);
  }
};

module.exports = {
  createDocumentSubmission,
  getAllDocumentSubmissions,
  getDocumentSubmissionById,
  approveDocumentSubmission,
  rejectDocumentSubmission,
  downloadDocument,
  updateDocumentSubmission,
  deleteDocumentSubmission,
};

