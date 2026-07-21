const { uploadFileToDrive } = require("../../middlewares/recruitment/drive");
const LeaveTypeModel = require("../../models/recruitment/LeaveType/LeaveType");
const EmployeeModel = require("../../models/employee.model");
const EmployeeLeaveBalance = require("../../models/recruitment/EmployeeLeaveBalance");
const { successResponse, errorResponse } = require("../../utils/recruitment/responseHandler");


const createLeaveType = async (req, res) => {
  try {
    // Check for duplicate name within the same company
    const existingLeaveType = await LeaveTypeModel.findOne({
      name: req.body.name,
      companyId: req.body.companyId
    });

    if (existingLeaveType) {
      return errorResponse(res, { message: "Leave type with this name already exists for this company" }, 400);
    }

    // Handle file upload
    let iconUrl = null;


    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const uploaded = await uploadFileToDrive(
          file.buffer,
          file.originalname,
          file.mimetype
        );
        iconUrl = uploaded.url;
      }
    }


    // Prepare leave type data
    const leaveTypeData = {
      ...req.body,
      icon: iconUrl,
      carryOver: {
        carryOverDate: req.body.carryOverDate || '01',
        carryOverExpiry: req.body.carryOverExpiry === 'true',
        maxDays: req.body.maxDays ? parseInt(req.body.maxDays) : 0
      },
      attachmentsRequired: req.body.attachmentsRequired === 'true',
      // Advanced Configuration
      maxLeavesAtOnce: req.body.maxLeavesAtOnce ? parseInt(req.body.maxLeavesAtOnce) : null,
      autoAddLeaves: {
        enabled: req.body.autoAddLeavesEnabled === 'true',
        ...(req.body.autoAddLeavesType && { type: req.body.autoAddLeavesType }),
        days: (() => { const v = req.body.autoAddLeavesDays; if (v == null || v === '') return null; const n = parseFloat(v); return Number.isNaN(n) ? null : n; })(),
        maxElapsedDays: req.body.autoAddLeavesMaxElapsedDays ? parseInt(req.body.autoAddLeavesMaxElapsedDays) : null
      },
      attachmentRequiredDays: {
        operator: req.body.attachmentRequiredOperator || 'greater_than_or_equal_to',
        value: req.body.attachmentRequiredDays ? parseInt(req.body.attachmentRequiredDays) : null
      },
      maxAdvanceDays: req.body.maxAdvanceDays ? JSON.parse(req.body.maxAdvanceDays) : [],
      maxHalfDays: req.body.maxHalfDays ? parseInt(req.body.maxHalfDays) : null
    };

    const newLeaveType = new LeaveTypeModel(leaveTypeData);
    const savedLeaveType = await newLeaveType.save();

    // Initialize per-employee balances for this leave type
    try {
      const companyId = savedLeaveType.companyId;
      const initialBalance = parseFloat(savedLeaveType.balanceBasedOn) || 0;
      const unit = savedLeaveType.unit || 'days';
      const employees = await EmployeeModel.find({ companyId, 'employmentInformation.status': 'Active' }).select('_id employmentInformation');

      const bulkOps = [];
      for (const emp of employees) {
        const empIdStr = String(emp._id);
        const empNumber = emp?.employmentInformation?.employeeNumber ? String(emp.employmentInformation.employeeNumber) : null;

        // Upsert into existing doc (by either empId or employeeNumber), else create new
        bulkOps.push({
          updateOne: {
            filter: { companyId, empId: { $in: empNumber ? [empIdStr, empNumber] : [empIdStr] } },
            update: {
              $setOnInsert: { companyId, empId: empIdStr },
            },
            upsert: true,
          }
        });
      }
      if (bulkOps.length) await EmployeeLeaveBalance.bulkWrite(bulkOps, { ordered: false });

      // Now push or set the leave type entry for each employee
      const balanceDocs = await EmployeeLeaveBalance.find({ companyId });
      const updateOps = [];
      for (const doc of balanceDocs) {
        const types = Array.isArray(doc.leaveTypes) ? doc.leaveTypes : [];
        const idx = types.findIndex(t => String(t.leaveTypeId) === String(savedLeaveType._id));
        if (idx >= 0) {
          types[idx].name = savedLeaveType.name;
          types[idx].unit = unit;
          types[idx].balance = initialBalance;
        } else {
          types.push({
            leaveTypeId: String(savedLeaveType._id),
            name: savedLeaveType.name,
            unit,
            balance: initialBalance
          });
        }
        updateOps.push({
          updateOne: {
            filter: { _id: doc._id },
            update: { $set: { leaveTypes: types } }
          }
        });
      }
      if (updateOps.length) await EmployeeLeaveBalance.bulkWrite(updateOps, { ordered: false });
    } catch (_) { /* best-effort init; ignore errors */ }

    return successResponse(
      res,
      savedLeaveType,
      "Leave type created successfully"
    );
  } catch (error) {
    return errorResponse(res, error);
  }
};


const getAllLeaveTypes = async (req, res) => {
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

    // Search filter (applies to leaveTypeName field)
    if (search) {
      const searchRegex = new RegExp(search, "i");
      filters.$or = [
        { name: searchRegex },
        { code: searchRegex },
        { balanceBasedOn: searchRegex },
        { unit: searchRegex },
        { status: searchRegex },
        { eligibility: searchRegex },
      ];
    }

    const leaveTypes = await LeaveTypeModel.find(filters)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await LeaveTypeModel.countDocuments(filters);
    const totalPages = Math.ceil(total / limit);

    

    const result = {
      totalRecords: total,
      page,
      limit,
      totalPages:totalPages,
      data: leaveTypes,
    };


return successResponse(res, result, "Fetched leave types with pagination");
   
  } catch (error) {
    return errorResponse(res, error);
  }
};



const updateLeaveType = async (req, res) => {
  try {
    const { id } = req.query;
    if (!id) {
      return errorResponse(res, "LeaveType ID is required in query", 400);
    }

    // Check for duplicate name within the same company (excluding current record)
    if (req.body.name) {
      const existingLeaveType = await LeaveTypeModel.findOne({
        name: req.body.name,
        companyId: req.body.companyId,
        _id: { $ne: id }
      });

      if (existingLeaveType) {
        return errorResponse(res, { message: "Leave type with this name already exists for this company" }, 400);
      }
    }

    // Handle file upload
    let iconUrl = null;
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const uploaded = await uploadFileToDrive(
          file.buffer,
          file.originalname,
          file.mimetype
        );
        iconUrl = uploaded.url;
      }
    }

    // Prepare update data
    const updateData = {
      ...req.body,
      carryOver: {
        carryOverDate: req.body.carryOverDate || '01',
        carryOverExpiry: req.body.carryOverExpiry === 'true',
        maxDays: req.body.maxDays ? parseInt(req.body.maxDays) : 0
      },
      attachmentsRequired: req.body.attachmentsRequired === 'true',
      // Advanced Configuration
      maxLeavesAtOnce: req.body.maxLeavesAtOnce ? parseInt(req.body.maxLeavesAtOnce) : null,
      autoAddLeaves: {
        enabled: req.body.autoAddLeavesEnabled === 'true',
        ...(req.body.autoAddLeavesType && { type: req.body.autoAddLeavesType }),
        days: (() => { const v = req.body.autoAddLeavesDays; if (v == null || v === '') return null; const n = parseFloat(v); return Number.isNaN(n) ? null : n; })(),
        maxElapsedDays: req.body.autoAddLeavesMaxElapsedDays ? parseInt(req.body.autoAddLeavesMaxElapsedDays) : null
      },
      attachmentRequiredDays: {
        operator: req.body.attachmentRequiredOperator || 'greater_than_or_equal_to',
        value: req.body.attachmentRequiredDays ? parseInt(req.body.attachmentRequiredDays) : null
      },
      maxAdvanceDays: req.body.maxAdvanceDays ? JSON.parse(req.body.maxAdvanceDays) : [],
      maxHalfDays: req.body.maxHalfDays ? parseInt(req.body.maxHalfDays) : null
    };

    // Add icon URL only if a new file was uploaded
    if (iconUrl) {
      updateData.icon = iconUrl;
    }

    const updatedLeaveType = await LeaveTypeModel.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!updatedLeaveType) {
      return errorResponse(res, "LeaveType not found", 404);
    }

    // Propagate changes to per-employee balances (name/unit only, NOT balance)
    try {
      const companyId = updatedLeaveType.companyId;
      const unit = updatedLeaveType.unit || 'days';
      const docs = await EmployeeLeaveBalance.find({ companyId });
      const ops = [];
      for (const doc of docs) {
        const types = Array.isArray(doc.leaveTypes) ? doc.leaveTypes : [];
        const idx = types.findIndex(t => String(t.leaveTypeId) === String(updatedLeaveType._id));
        if (idx >= 0) {
          types[idx].name = updatedLeaveType.name;
          types[idx].unit = unit;
          // Note: Balance is NOT updated here - only during creation or manual adjustment
          ops.push({ updateOne: { filter: { _id: doc._id }, update: { $set: { leaveTypes: types } } } });
        }
      }
      if (ops.length) await EmployeeLeaveBalance.bulkWrite(ops, { ordered: false });
    } catch (_) { /* ignore propagate errors */ }

    return successResponse(
      res,
      updatedLeaveType,
      "Leave type updated successfully"
    );
  } catch (error) {
    return errorResponse(res, error);
  }
};



const getLeaveTypeById = async (req, res) => {
  try {
    const { id } = req.query; // Get ID from query

    if (!id) {
      return errorResponse(res, "LeaveType ID is required in query", 400);
    }

    const leaveType = await LeaveTypeModel.findById(id);

    if (!leaveType) {
      return errorResponse(res, "LeaveType not found", 404);
    }

    return successResponse(res, leaveType, "Fetched leave type by ID");
  } catch (error) {
    return errorResponse(res, error);
  }
};

const deleteLeaveTypeById = async (req, res) => {
  try {
    const { id } = req.query; // ID from query

    if (!id) {
      return errorResponse(res, "LeaveType ID is required in query", 400);
    }

    const deletedLeaveType = await LeaveTypeModel.findByIdAndDelete(id);

    if (!deletedLeaveType) {
      return errorResponse(res, "LeaveType not found or already deleted", 404);
    }

    // Remove the leave type from per-employee balances
    try {
      await EmployeeLeaveBalance.updateMany(
        { companyId: deletedLeaveType.companyId },
        { $pull: { leaveTypes: { leaveTypeId: String(deletedLeaveType._id) } } }
      );
    } catch (_) { /* ignore */ }

    return successResponse(
      res,
      deletedLeaveType,
      "Leave type deleted successfully"
    );
  } catch (error) {
    return errorResponse(res, error);
  }
};


module.exports = {
  createLeaveType,
  getAllLeaveTypes,
  updateLeaveType,
  getLeaveTypeById,
  deleteLeaveTypeById,
};
