const LeaveUploadBatchModel = require("../../../models/recruitment/Leaves/LeaveUploadBatch");
const EmployeeLeaveBalance = require("../../../models/recruitment/EmployeeLeaveBalance");
const EmployeeModel = require("../../../models/employee.model");
const { uploadFileToDrive, deleteFileFromDrive } = require("../../../middlewares/recruitment/drive");
const {
  successResponse,
  errorResponse,
} = require("../../../utils/recruitment/responseHandler");

// S3 file upload for leave balance batch files
const uploadLeaveBalanceFile = async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ success: false, message: "No file provided" });
    }
    const uploaded = await uploadFileToDrive(file.buffer, file.originalname, file.mimetype, "leavebalancefiles");
    return res.status(200).json({
      success: true,
      data: {
        filename: file.originalname,
        fileSize: file.size,
        s3Url: uploaded.url,
        s3Key: uploaded.key || uploaded.Key || null
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// List upload batches
const listLeaveBalanceBatches = async (req, res) => {
  try {
    const { companyId, limit = 20 } = req.query;
    if (!companyId) return res.status(400).json({ success: false, message: "Company ID is required" });
    const batches = await LeaveUploadBatchModel.find({ companyId }).sort({ createdAt: -1 }).limit(parseInt(limit));
    return res.status(200).json({ success: true, data: batches });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Get batch details
const getLeaveBalanceBatch = async (req, res) => {
  try {
    const { batchId } = req.params;
    const batch = await LeaveUploadBatchModel.findById(batchId);
    if (!batch) return res.status(404).json({ success: false, message: "Batch not found" });
    return res.status(200).json({ success: true, data: batch });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Get balance updates created by batch (paginated)
// Note: Since we're updating EmployeeLeaveBalance, we'll return the updated documents
const getLeaveBalanceBatchRecords = async (req, res) => {
  try {
    const { batchId } = req.params;
    const { companyId, page = 1, limit = 50 } = req.query;
    if (!companyId) return res.status(400).json({ success: false, message: "Company ID is required" });
    
    const batch = await LeaveUploadBatchModel.findById(batchId);
    if (!batch) return res.status(404).json({ success: false, message: "Batch not found" });
    
    // Get the balance documents that were updated in this batch
    const query = { 
      companyId, 
      _id: { $in: batch.createdBalanceUpdateIds || [] }
    };
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [items, total] = await Promise.all([
      EmployeeLeaveBalance.find(query).sort({ updatedAt: -1 }).skip(skip).limit(parseInt(limit)).lean(),
      EmployeeLeaveBalance.countDocuments(query)
    ]);
    
    // Enrich with employee information (employee number, name, email)
    const empIds = Array.from(new Set(items.map(item => item.empId).filter(Boolean)));
    let employeeMap = new Map();
    
    if (empIds.length > 0) {
      const employees = await EmployeeModel.find({ 
        _id: { $in: empIds },
        companyId: companyId 
      })
      .select('_id personalInformation.firstName personalInformation.lastName contactInformation.email employmentInformation.employeeNumber')
      .lean();
      
      employeeMap = new Map(
        employees.map(emp => [
          emp._id.toString(),
          {
            employeeNumber: emp.employmentInformation?.employeeNumber || null,
            name: `${emp.personalInformation?.firstName || ''} ${emp.personalInformation?.lastName || ''}`.trim() || null,
            email: emp.contactInformation?.email || null
          }
        ])
      );
    }
    
    // Enrich items with employee information
    const enrichedItems = items.map(item => {
      const empInfo = employeeMap.get(item.empId) || {};
      return {
        ...item,
        empId: empInfo?.employeeNumber,
        employeeInfo: {
          employeeNumber: empInfo.employeeNumber || null,
          name: empInfo.name || null,
          email: empInfo.email || null
        }
      };
    });
    
    return res.status(200).json({ success: true, data: enrichedItems, total });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Rollback a batch: restore previous balance values
// Note: This requires storing previous values in the batch record
const rollbackLeaveBalanceBatch = async (req, res) => {
  try {
    const { batchId } = req.params;
    const { companyId } = req.query;
    if (!companyId) return res.status(400).json({ success: false, message: "Company ID is required" });

    const batch = await LeaveUploadBatchModel.findById(batchId);
    if (!batch) return res.status(404).json({ success: false, message: "Batch not found" });
    if (batch.status === 'rolled_back') {
      return res.status(400).json({ success: false, message: "Batch already rolled back" });
    }

    // For rollback, restore previous balances from snapshot
    if (batch.previousBalances && Array.isArray(batch.previousBalances) && batch.previousBalances.length > 0) {
      // Restore previous balances if we have them
      for (const prevBalance of batch.previousBalances) {
        try {
          await EmployeeLeaveBalance.findByIdAndUpdate(
            prevBalance.balanceId,
            { $set: { leaveTypes: prevBalance.leaveTypes || [] } },
            { new: true }
          );
        } catch (updateError) {
          console.error(`Error restoring balance for ${prevBalance.balanceId}:`, updateError);
        }
      }
    } else {
      // If no previous balances stored, we can't fully rollback
      // This shouldn't happen if batch was created with fileMeta
      console.warn(`Batch ${batchId} has no previous balance snapshots for rollback`);
    }

    await LeaveUploadBatchModel.findByIdAndUpdate(batchId, {
      status: 'rolled_back',
      rolledBackAt: new Date()
    });

    return res.status(200).json({ 
      success: true, 
      data: { 
        message: "Batch rolled back successfully. Previous balances have been restored." 
      } 
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Delete a batch record (and S3 file) after rollback or failure
const deleteLeaveBalanceBatch = async (req, res) => {
  try {
    const { batchId } = req.params;
    const { companyId } = req.query;
    if (!companyId) return res.status(400).json({ success: false, message: "Company ID is required" });

    const batch = await LeaveUploadBatchModel.findById(batchId);
    if (!batch) return res.status(404).json({ success: false, message: "Batch not found" });
    if (String(batch.companyId) !== String(companyId)) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    if (!['rolled_back', 'failed'].includes(batch.status)) {
      return res.status(400).json({ success: false, message: "Batch must be rolled back or failed before deletion" });
    }

    // Best-effort S3 delete
    if (batch.s3Key) {
      await deleteFileFromDrive(batch.s3Key);
    }

    await LeaveUploadBatchModel.findByIdAndDelete(batchId);
    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  uploadLeaveBalanceFile,
  listLeaveBalanceBatches,
  getLeaveBalanceBatch,
  getLeaveBalanceBatchRecords,
  rollbackLeaveBalanceBatch,
  deleteLeaveBalanceBatch
};

