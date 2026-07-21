const DocumentTypeModel = require("../../models/recruitment/DocumentPanel/DocumentTypeModel");
const DocumentSubmissionModel = require("../../models/recruitment/DocumentPanel/DocumentSubmissionModel");
const PrivilegeGroup = require("../../models/privilegesGroup.model");
const { successResponse, errorResponse } = require("../../utils/recruitment/responseHandler");

// Create Document Type
const createDocumentType = async (req, res) => {
  try {
    // Check for duplicate name within the same company
    const existingDocumentType = await DocumentTypeModel.findOne({
      documentTypeName: req.body.documentTypeName,
      companyId: req.body.companyId,
    });

    if (existingDocumentType) {
      return errorResponse(
        res,
        { message: "Document type with this name already exists for this company" },
        400
      );
    }

    // Parse dynamicFields if it's a string
    let dynamicFields = req.body.dynamicFields;
    if (typeof dynamicFields === "string") {
      try {
        dynamicFields = JSON.parse(dynamicFields);
      } catch (parseError) {
        return errorResponse(
          res,
          { message: "Invalid dynamicFields format" },
          400
        );
      }
    }

    // Prepare document type data
    const documentTypeData = {
      documentTypeName: req.body.documentTypeName,
      documentCode: req.body.documentCode,
      status: req.body.status || "active",
      privilegeGroup: req.body.privilegeGroup || "",
      privilegeGroupId: req.body.privilegeGroupId || "",
      companyId: req.body.companyId,
      requiresFileUpload: req.body.requiresFileUpload !== false,
      dynamicFields: Array.isArray(dynamicFields)
        ? dynamicFields.map((field, index) => ({
            fieldName: field.fieldName,
            fieldType: field.fieldType,
            isRequired: field.isRequired || false,
            fieldOptions: field.fieldOptions || "",
            fieldOrder: field.fieldOrder || index,
          }))
        : [],
    };

    const newDocumentType = new DocumentTypeModel(documentTypeData);
    const savedDocumentType = await newDocumentType.save();

    return successResponse(
      res,
      savedDocumentType,
      "Document type created successfully"
    );
  } catch (error) {
    console.error("Create Document Type Error:", error);
    return errorResponse(res, error);
  }
};

// Get All Document Types
const getAllDocumentTypes = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const search = req.query.search || "";
    const companyId = req.query.companyId;

    const filters = {};

    // Company filter
    if (companyId) {
      filters.companyId = companyId;
    }

    // Search filter
    if (search) {
      const searchRegex = new RegExp(search, "i");
      filters.$or = [
        { documentTypeName: searchRegex },
        { documentCode: searchRegex },
        { status: searchRegex },
        { privilegeGroup: searchRegex },
      ];
    }

    const documentTypes = await DocumentTypeModel.find(filters)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await DocumentTypeModel.countDocuments(filters);
    const totalPages = Math.ceil(total / limit);

    const result = {
      totalRecords: total,
      page,
      limit,
      totalPages,
      data: documentTypes,
    };

    return successResponse(res, result, "Fetched document types with pagination");
  } catch (error) {
    console.error("Get All Document Types Error:", error);
    return errorResponse(res, error);
  }
};

// Get Active Document Types (for employee dropdown)
const getActiveDocumentTypes = async (req, res) => {
  try {
    const companyId = req.query.companyId;
    const employeeId = req.query.employeeId; // Employee ID to filter by privilege group membership

    if (!companyId) {
      return errorResponse(res, { message: "Company ID is required" }, 400);
    }

    if (!employeeId) {
      return errorResponse(res, { message: "Employee ID is required. We cannot find document templates for you without your employee information." }, 400);
    }

    const filters = {
      companyId,
      /*  status: "active", */
    };

    const documentTypes = await DocumentTypeModel.find(filters)
      .sort({ documentTypeName: 1 })
      .select("_id documentTypeName documentCode requiresFileUpload dynamicFields privilegeGroup privilegeGroupId status");

    // Filter document types based on privilege group membership
    try {
      // Fetch all privilege groups for this company
      const privilegeGroups = await PrivilegeGroup.find({ companyId }).select("_id groupName activeGroupMembers");
      
      // Filter document types based on privilege group membership
      const filteredDocumentTypes = documentTypes.filter((docType) => {
        // If no privilege group assigned to document type, show to all employees
        if (!docType.privilegeGroupId || !docType.privilegeGroup) {
          return true;
        }
        
        // Find the privilege group assigned to this document type
        // First try to match by privilegeGroupId (more reliable)
        let assignedGroup = privilegeGroups.find(
          (group) => group._id && group._id.toString() === docType.privilegeGroupId.toString()
        );
        
        // Fallback to groupName if ID match fails
        if (!assignedGroup) {
          assignedGroup = privilegeGroups.find(
            (group) => group.groupName === docType.privilegeGroup
          );
        }
        
        // If group not found, don't show the document type
        if (!assignedGroup) {
          return false;
        }
        
        // Check if activeGroupMembers exists and is an array
        if (!assignedGroup.activeGroupMembers || !Array.isArray(assignedGroup.activeGroupMembers) || assignedGroup.activeGroupMembers.length === 0) {
          return false;
        }
        
        // Check if employee is in the activeGroupMembers
        const employeeIdStr = employeeId.toString();
        const isMember = assignedGroup.activeGroupMembers.some((member) => {
          // Handle both string IDs and object IDs
          let memberId;
          if (typeof member === 'object' && member !== null) {
            // If it's an object, try _id first, then id, then the object itself
            memberId = (member._id || member.id || member).toString();
          } else {
            memberId = String(member);
          }
          
          // Compare both as strings for reliability
          return memberId === employeeIdStr;
        });
        
        return isMember;
      });
      
      // If no document types are available for this employee
      if (filteredDocumentTypes.length === 0) {
        return successResponse(res, [], "We couldn't find any document templates available for you. Please contact your administrator.");
      }
      
      return successResponse(res, filteredDocumentTypes, "Fetched document types based on your privilege group membership");
    } catch (privilegeError) {
      console.error("Error filtering by privilege groups:", privilegeError);
      return errorResponse(res, { message: "Failed to fetch document templates. Please try again later." }, 500);
    }
  } catch (error) {
    console.error("Get all document types Error:", error);
    return errorResponse(res, error);
  }
};

// Get Document Type by ID (for form configuration)
const getDocumentTypeById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return errorResponse(res, { message: "Document Type ID is required" }, 400);
    }

    const documentType = await DocumentTypeModel.findById(id);

    if (!documentType) {
      return errorResponse(res, { message: "Document type not found" }, 404);
    }

    return successResponse(res, documentType, "Fetched document type by ID");
  } catch (error) {
    console.error("Get Document Type by ID Error:", error);
    return errorResponse(res, error);
  }
};

// Get Form Configuration for Document Type
const getDocumentTypeFormConfig = async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.query.companyId;

    if (!id) {
      return errorResponse(res, { message: "Document Type ID is required" }, 400);
    }

    const documentType = await DocumentTypeModel.findOne({
      _id: id,
      companyId: companyId,
      /*  status: "active", */
    });

    if (!documentType) {
      return errorResponse(res, { message: "Document type not found or inactive" }, 404);
    }

    // Return only necessary fields for form configuration
    const formConfig = {
      _id: documentType._id,
      documentTypeName: documentType.documentTypeName,
      requiresFileUpload: documentType.requiresFileUpload,
      dynamicFields: documentType.dynamicFields || [],
    };

    return successResponse(res, formConfig, "Fetched document type form configuration");
  } catch (error) {
    console.error("Get Form Config Error:", error);
    return errorResponse(res, error);
  }
};

// Update Document Type
const updateDocumentType = async (req, res) => {
  try {
    const { id } = req.query;

    if (!id) {
      return errorResponse(res, { message: "Document Type ID is required in query" }, 400);
    }

    // Check for duplicate name within the same company (excluding current record)
    if (req.body.documentTypeName) {
      const existingDocumentType = await DocumentTypeModel.findOne({
        documentTypeName: req.body.documentTypeName,
        companyId: req.body.companyId,
        _id: { $ne: id },
      });

      if (existingDocumentType) {
        return errorResponse(
          res,
          { message: "Document type with this name already exists for this company" },
          400
        );
      }
    }

    // Parse dynamicFields if it's a string
    let dynamicFields = req.body.dynamicFields;
    if (typeof dynamicFields === "string") {
      try {
        dynamicFields = JSON.parse(dynamicFields);
      } catch (parseError) {
        return errorResponse(
          res,
          { message: "Invalid dynamicFields format" },
          400
        );
      }
    }

    // Prepare update data
    const updateData = {
      ...req.body,
    };

    // Handle dynamicFields update
    if (Array.isArray(dynamicFields)) {
      updateData.dynamicFields = dynamicFields.map((field, index) => ({
        fieldName: field.fieldName,
        fieldType: field.fieldType,
        isRequired: field.isRequired || false,
        fieldOptions: field.fieldOptions || "",
        fieldOrder: field.fieldOrder || index,
      }));
    }

    // Handle boolean conversion
    if (req.body.requiresFileUpload !== undefined) {
      updateData.requiresFileUpload = req.body.requiresFileUpload !== false;
    }

    const updatedDocumentType = await DocumentTypeModel.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!updatedDocumentType) {
      return errorResponse(res, { message: "Document type not found" }, 404);
    }

    return successResponse(
      res,
      updatedDocumentType,
      "Document type updated successfully"
    );
  } catch (error) {
    console.error("Update Document Type Error:", error);
    return errorResponse(res, error);
  }
};

// Delete Document Type
const deleteDocumentTypeById = async (req, res) => {
  try {
    const { id } = req.query;

    if (!id) {
      return errorResponse(res, { message: "Document Type ID is required in query" }, 400);
    }

    // Delete all associated submissions first
    const deleteResult = await DocumentSubmissionModel.deleteMany({
      documentTypeId: id,
    });

    console.log(`Deleted ${deleteResult.deletedCount} submission(s) associated with document type ${id}`);

    // Delete the document type
    const deletedDocumentType = await DocumentTypeModel.findByIdAndDelete(id);

    if (!deletedDocumentType) {
      return errorResponse(
        res,
        { message: "Document type not found or already deleted" },
        404
      );
    }

    return successResponse(
      res,
      {
        documentType: deletedDocumentType,
        deletedSubmissions: deleteResult.deletedCount,
      },
      `Document type and ${deleteResult.deletedCount} related submission(s) deleted successfully`
    );
  } catch (error) {
    console.error("Delete Document Type Error:", error);
    return errorResponse(res, error);
  }
};

module.exports = {
  createDocumentType,
  getAllDocumentTypes,
  getActiveDocumentTypes,
  getDocumentTypeById,
  getDocumentTypeFormConfig,
  updateDocumentType,
  deleteDocumentTypeById,
};

