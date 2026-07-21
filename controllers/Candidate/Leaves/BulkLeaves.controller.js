const LeavesModel = require("../../../models/recruitment/Leaves/Leaves.model");
const LeaveTypeModel = require("../../../models/recruitment/LeaveType/LeaveType");
const EmployeeModel = require("../../../models/employee.model");
const EmployeeLeaveBalance = require("../../../models/recruitment/EmployeeLeaveBalance");
  const LeaveUploadBatchModel = require("../../../models/recruitment/Leaves/LeaveUploadBatch");
const {
  successResponse,
  errorResponse,
} = require("../../../utils/recruitment/responseHandler");

// Update employee leave balances function - handles multiple employees
const bulkUploadLeaves = async (req, res) => {
  let batchDoc = null;
  try {
    const { employees, fileMeta, type } = req.body; // Array of employees with their leave balances
    
    if (!employees || !Array.isArray(employees) || employees.length === 0) {
      return errorResponse(res, "Employees data is required as an array", 400);
    }

    const allResults = [];
    const allWarnings = [];
    let totalSuccessCount = 0;
    let processedEmployees = 0;
    const createdBalanceUpdateIds = [];
    const previousBalances = [];

    // Get company ID from first employee (assuming all employees are from same company)
    const firstEmployee = await EmployeeModel.findOne({ 
      'employmentInformation.employeeNumber': employees[0].empId
    }).select('companyId');
    
    if (!firstEmployee) {
      return errorResponse(res, `Employee with ID ${employees[0].empId} not found`, 404);
    }
    
    const companyId = firstEmployee.companyId;

    // Create a batch record upfront for tracking and rollback (only if fileMeta is provided)
    let totalRecords = employees.length;
    if (fileMeta) {
      batchDoc = await LeaveUploadBatchModel.create({
        companyId,
        filename: fileMeta?.filename || null,
        fileSize: fileMeta?.fileSize || null,
        s3Key: fileMeta?.s3Key || null,
        s3Url: fileMeta?.s3Url || null,
        type: type || null,
        status: 'processing',
        totalRecords
      });
    }

    // Get all leave types for the company once
    const leaveTypesFromDB = await LeaveTypeModel.find({ companyId });
    const leaveTypeMap = new Map();
    leaveTypesFromDB.forEach(leaveType => {
      // Extract first word only (e.g., "Sick Leave (SL)" -> "sick")
      const baseName = (leaveType.name || '').split(' ')[0].trim().toLowerCase();
      if (baseName) leaveTypeMap.set(baseName, leaveType);
      // Also map full normalized name (e.g., "sick leave (sl)")
      const fullName = (leaveType.name || '').trim().toLowerCase();
      if (fullName) leaveTypeMap.set(fullName, leaveType);
      // Also map by code if present (e.g., "sl")
      const code = (leaveType.code || '').trim().toLowerCase();
      if (code) leaveTypeMap.set(code, leaveType);
    });

    // Process each employee
    for (const employeeData of employees) {
      const { empId, leaveTypes } = employeeData;
      
      if (!empId) {
        allWarnings.push(`Employee data missing empId`);
        continue;
      }

      if (!leaveTypes || typeof leaveTypes !== 'object') {
        allWarnings.push(`Employee ${empId}: Leave types data is required`);
        continue;
      }

      // Find employee by employeeNumber to get their ObjectId
      const employee = await EmployeeModel.findOne({ 
        'employmentInformation.employeeNumber': empId,
        companyId: companyId
      }).select('_id personalInformation employmentInformation companyId');

      if (!employee) {
        allWarnings.push(`Employee with employee number ${empId} not found in company`);
        continue;
      }

      const employeeName = `${employee.personalInformation?.firstName || ''} ${employee.personalInformation?.lastName || ''}`.trim();
      const employeeObjectId = String(employee._id); // This is the _id we'll use for EmployeeLeaveBalance

      const employeeResults = [];
      const employeeWarnings = [];
      let employeeSuccessCount = 0;

      // Process each leave type for this employee
      for (const [leaveTypeName, requestedDays] of Object.entries(leaveTypes)) {
        const parsedDays = Number(requestedDays);
        // Skip only if not a finite number; allow 0 and negatives
        if (!Number.isFinite(parsedDays)) {
          employeeWarnings.push(`Invalid days count for ${leaveTypeName}: ${requestedDays}`);
          continue;
        }
        
        // Allow zeros - explicitly handle them
        // days can be 0, positive, or negative

        // Find the leave type using multiple keys (base word, full name, or code)
        const baseLeaveTypeName = (leaveTypeName || '').split(' ')[0].trim().toLowerCase();
        const fullLeaveTypeName = (leaveTypeName || '').trim().toLowerCase();
        const leaveType = leaveTypeMap.get(baseLeaveTypeName) || leaveTypeMap.get(fullLeaveTypeName);
        if (!leaveType) {
          employeeWarnings.push(`Leave type "${leaveTypeName}" not found`);
          continue;
        }

        // Replace per-employee balance (not company-wide leave type)
        const keyLeaveTypeName = leaveType ? leaveType.name : leaveTypeName;

        // Use employee._id (ObjectId) for balanceDoc lookup
        const balanceDoc = await EmployeeLeaveBalance.findOne({ companyId, empId: employeeObjectId });
        if (!balanceDoc) {
          // Create with this leave type only, using employee._id
          const newBalanceDoc = await EmployeeLeaveBalance.create({
            companyId,
            empId: employeeObjectId,
            leaveTypes: [
              {
                leaveTypeId: String(leaveType._id),
                name: keyLeaveTypeName,
                unit: leaveType.unit || 'days',
                balance: parsedDays,
              },
            ],
          });
          
          // Track for batch
          createdBalanceUpdateIds.push(newBalanceDoc._id);
          previousBalances.push({
            balanceId: newBalanceDoc._id,
            leaveTypes: [] // No previous balance since it's new
          });
          
          employeeSuccessCount++;
          employeeResults.push({
            leaveType: keyLeaveTypeName,
            leaveTypeId: leaveType ? leaveType._id : null,
            daysChanged: parsedDays,
            previousBalance: 0,
            newBalance: parsedDays,
            status: 'Replaced',
          });
        } else {
          // Store previous balance snapshot for rollback
          const previousLeaveTypes = JSON.parse(JSON.stringify(balanceDoc.leaveTypes || []));
          const existingSnapshot = previousBalances.find(pb => String(pb.balanceId) === String(balanceDoc._id));
          if (!existingSnapshot) {
            previousBalances.push({
              balanceId: balanceDoc._id,
              leaveTypes: previousLeaveTypes
            });
          }
          
          // Upsert into leaveTypes array for this employee
          const types = Array.isArray(balanceDoc.leaveTypes)
            ? balanceDoc.leaveTypes
            : [];
          const idx = types.findIndex(
            (t) => String(t.leaveTypeId) === String(leaveType._id)
          );
          const previousBalance = idx >= 0 ? Number(types[idx].balance ?? 0) : 0;
          const newBalance = parsedDays;
          if (idx >= 0) {
            types[idx].balance = newBalance;
            types[idx].name = keyLeaveTypeName;
            types[idx].unit = leaveType.unit || 'days';
          } else {
            types.push({
              leaveTypeId: String(leaveType._id),
              name: keyLeaveTypeName,
              unit: leaveType.unit || 'days',
              balance: newBalance,
            });
          }
          await EmployeeLeaveBalance.findByIdAndUpdate(
            balanceDoc._id,
            { $set: { leaveTypes: types } },
            { new: true }
          );

          // Track for batch if not already tracked
          if (!createdBalanceUpdateIds.includes(balanceDoc._id)) {
            createdBalanceUpdateIds.push(balanceDoc._id);
          }

          employeeSuccessCount++;
          employeeResults.push({
            leaveType: keyLeaveTypeName,
            leaveTypeId: leaveType ? leaveType._id : null,
            daysChanged: newBalance - previousBalance,
            previousBalance: previousBalance,
            newBalance: newBalance,
            status: newBalance === previousBalance ? 'Unchanged' : 'Replaced',
          });
        }
      }

      // Add employee results to overall results
      allResults.push({
        empId: empId, // This is the employeeNumber from the upload
        employeeObjectId: employeeObjectId, // This is the _id used in EmployeeLeaveBalance
        employeeName: employeeName,
        companyId: companyId,
        updated: employeeResults,
        warnings: employeeWarnings,
        successCount: employeeSuccessCount
      });

      allWarnings.push(...employeeWarnings.map(warning => `${empId}: ${warning}`));
      totalSuccessCount += employeeSuccessCount;
      processedEmployees++;
    }

    // Update batch record with results (if batch was created)
    if (batchDoc && batchDoc._id) {
      const errorCount = allWarnings.length;
      await LeaveUploadBatchModel.findByIdAndUpdate(batchDoc._id, {
        status: errorCount > 0 && processedEmployees === 0 ? 'failed' : 'completed',
        successCount: processedEmployees,
        errorCount: errorCount,
        createdBalanceUpdateIds: createdBalanceUpdateIds,
        previousBalances: previousBalances
      });
    }

    return successResponse(res, {
      message: `Leave balances updated for ${processedEmployees} employees`,
      results: allResults,
      warnings: allWarnings,
      batchId: batchDoc ? batchDoc._id : null,
      summary: {
        totalEmployees: employees.length,
        processedEmployees: processedEmployees,
        totalSuccessCount: totalSuccessCount,
        warningCount: allWarnings.length
      }
    });

  } catch (error) {
    console.error('Bulk upload leave balances error:', error);
    // Update batch status to failed if batch was created
    if (batchDoc && batchDoc._id) {
      try {
        await LeaveUploadBatchModel.findByIdAndUpdate(batchDoc._id, {
          status: 'failed'
        });
      } catch (updateError) {
        console.error('Error updating batch status:', updateError);
      }
    }
    return errorResponse(res, error);
  }
};





// Get leave records for all employees in company
const getLeavesByCompany = async (req, res) => {
  try {
    const { companyId,startDate,endDate } = req.query;
    const cleanCompanyId = (companyId || '').toString().replace(/^"|"$/g, '').trim();
    
    if (!cleanCompanyId) {
      return errorResponse(res, "Company ID is required", 400);
    }

    console.log("INFO: Retrieving leave records for all employees in company:", cleanCompanyId);

    // Get all employees for the company
    const employees = await EmployeeModel.find({ 
      companyId: cleanCompanyId,
      'employmentInformation.status': 'Active'
    }).select('_id personalInformation employmentInformation contactInformation');

   
    // Deduplicate employees by employeeNumber (keep the most recent one)
    const uniqueEmployees = new Map();
    employees.forEach(employee => {
      const employeeNumber = employee.employmentInformation?.employeeNumber;
      if (employeeNumber) {
        
        if (!uniqueEmployees.has(employeeNumber) || 
            (employee.personalInformation?.firstName && !uniqueEmployees.get(employeeNumber).personalInformation?.firstName)) {
          uniqueEmployees.set(employeeNumber, employee);
        }
      }
    });

  

    const employeeBalances = [];
    

    // Process each unique employee
    for (const [employeeNumber, employee] of uniqueEmployees) {
      const employeeName = `${employee.personalInformation?.firstName || ''} ${employee.personalInformation?.lastName || ''}`.trim();
      
      const employeeBalance = {
        empId: employeeNumber,
        employeeName: employeeName,
        legalEntity: employee.employmentInformation?.legalEntity || '',
        department: employee.employmentInformation?.department || '',
        designation: employee.employmentInformation?.position || employee.employmentInformation?.designation || '',
        leaveRecords: []
      };

      const employeeObjectId = String(employee._id);
      const empIdArray = [employeeObjectId];
      if (employeeNumber) {
        empIdArray.push(employeeNumber);
      }
      const leaveQuery = {
        companyId: cleanCompanyId,
        empId: { $in: empIdArray }
      };
      
      if (startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        
        leaveQuery.$and = [
          { from: { $lte: end } },
          { to: { $gte: start } }
        ];
      }
      
      // Get actual leave records for this employee
      const employeeLeaves = await LeavesModel.find(leaveQuery).sort({ from: -1 });

      // Transform leave records to the required format
      employeeBalance.leaveRecords = employeeLeaves.map(leave => ({
        leaveType: leave.absenceType || '',
        leaveFromDate: leave.from || null,
        leaveToDate: leave.to || null,
        duration: leave.durationOfAbsence || '',
        status: leave.status || '',
        note: leave.note || '',
        from: leave.from || null,
        to: leave.to || null,
        currentApprovers: leave.currentApprovers || []
      }));

      employeeBalances.push(employeeBalance);
    }

    console.log("INFO: Found leave records for", employeeBalances.length, "unique employees");

    return successResponse(res, {
      message: "Employee leave records retrieved successfully",
      data: employeeBalances,
      count: employeeBalances.length
    });

  } catch (error) {
    console.error('Get leave balances by company error:', error);
    return errorResponse(res, error);
  }
};

const bulkExportBalances = async (req, res) => {
  try {
    const { companyId } = req.query;
    const cleanCompanyId = companyId;
    
    if (!cleanCompanyId) {
      return errorResponse(res, "Company ID is required", 400);
    }

    console.log("INFO: Bulk exporting leave balances for company:", cleanCompanyId);

    const employees = await EmployeeModel.find({ 
      companyId: cleanCompanyId,
      'employmentInformation.status': 'Active'
    }).select('_id personalInformation employmentInformation contactInformation');

    const uniqueEmployees = new Map();
    employees.forEach(employee => {
      const employeeNumber = employee.employmentInformation?.employeeNumber;
      if (employeeNumber) {
        if (!uniqueEmployees.has(employeeNumber) || 
            (employee.personalInformation?.firstName && !uniqueEmployees.get(employeeNumber).personalInformation?.firstName)) {
          uniqueEmployees.set(employeeNumber, employee);
        }
      }
    });

    // Filter leave types to only include specific ones
    const allLeaveTypes = await LeaveTypeModel.find({ companyId: cleanCompanyId });
    const leaveTypes = allLeaveTypes.filter(leaveType => {
      const lowerName = leaveType.name?.toLowerCase();
      return lowerName.includes('sick') || 
             lowerName.includes('casual') || 
             lowerName.includes('earned');
    });

    console.log("INFO: Filtered leave types:", leaveTypes.map(lt => lt.name));

    // Build query for leaves with optional date range filter based on from /to
    const leaveQuery = { companyId: cleanCompanyId };
    
    const allLeaves = await LeavesModel.find(leaveQuery);
    
    // Get all employee leave balances at once for better performance
    const employeeObjectIds = Array.from(uniqueEmployees.values()).map(emp => String(emp._id));
    const allEmployeeBalances = await EmployeeLeaveBalance.find({
      companyId: cleanCompanyId,
      empId: { $in: employeeObjectIds }
    });
    
    const balanceMap = new Map();
    allEmployeeBalances.forEach(balance => {
      balanceMap.set(balance.empId, balance);
    });

    const employeeBalances = [];
    for (const [employeeNumber, employee] of uniqueEmployees) {
      const employeeName = `${employee.personalInformation?.firstName || ''} ${employee.personalInformation?.lastName || ''}`.trim();
      
      if (!employeeNumber) {
        console.log("WARNING: Employee missing employeeNumber:", employee._id);
        continue;
      }
      
      const employeeLeaves = allLeaves.filter(leave => leave.empId == employeeNumber);
      console.log(`DEBUG: Employee ${employeeNumber} (${employeeName}) has ${employeeLeaves.length} leave records`);
      
      // Get employee's balance document (using employee._id as empId in EmployeeLeaveBalance)
      const employeeObjectId = String(employee._id);
      const balanceDoc = balanceMap.get(employeeObjectId);
      
      const leaveSummary = {};
      
      for (const leaveType of leaveTypes) {
        const approvedLeavesForType = employeeLeaves.filter(leave => 
          (leave.absenceType === leaveType.name || leave.absenceType === leaveType._id?.toString()) &&
          leave.status === 'approved'
        );
        
        const pendingLeavesForType = employeeLeaves.filter(leave => 
          (leave.absenceType === leaveType.name || leave.absenceType === leaveType._id?.toString()) &&
          leave.status === 'pending'
        );
        
        
        let approvedDays = 0;
        let pendingDays = 0;
        
        approvedLeavesForType.forEach(leave => {
          if (leave.durationOfAbsence) {
            approvedDays += parseFloat(leave.durationOfAbsence) || 0;
          } else if (leave.from && leave.to) {
            const diffTime = Math.abs(new Date(leave.to) - new Date(leave.from));
            approvedDays += Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
          }
        });
        
        pendingLeavesForType.forEach(leave => {
          if (leave.durationOfAbsence) {
            pendingDays += parseFloat(leave.durationOfAbsence) || 0;
          } else if (leave.from && leave.to) {
            const diffTime = Math.abs(new Date(leave.to) - new Date(leave.from));
            pendingDays += Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
          }
        });
        
        const usedDays = approvedDays + pendingDays;
        
        // Get current balance from EmployeeLeaveBalance
        let currentBalance = 0;
        if (balanceDoc && Array.isArray(balanceDoc.leaveTypes)) {
          const leaveTypeBalance = balanceDoc.leaveTypes.find(
            lt => String(lt.leaveTypeId) === String(leaveType._id)
          );
          if (leaveTypeBalance) {
            currentBalance = parseFloat(leaveTypeBalance.balance) || 0;
          }
        }
        
        // Allocated = current balance + used days
        const allocatedBalance = currentBalance + usedDays;
        const remainingDays = currentBalance;
        
        leaveSummary[leaveType.name] = {
          allocated: allocatedBalance,
          approved: approvedDays,
          pending: pendingDays,
          used: usedDays,
          remaining: Math.max(0, remainingDays),
          unit: leaveType.unit || 'days'
        };
      }
      
      employeeBalances.push({
        empId: employeeNumber,
        employeeName: employeeName,
        employeeNumber: employeeNumber,
        legalEntity: employee.employmentInformation?.legalEntity || '',
        department: employee.employmentInformation?.department || '',
        designation: employee.employmentInformation?.designation || employee.employmentInformation?.position || '',
        leaveSummary: leaveSummary
      });
    }

    console.log("INFO: Processed leave balances for", employeeBalances.length, "unique employees");
    
    if (employeeBalances.length > 0) {
      console.log("DEBUG: First employee sample:", {
        empId: employeeBalances[0].empId,
        employeeNumber: employeeBalances[0].employeeNumber,
        employeeName: employeeBalances[0].employeeName,
        leaveSummary: employeeBalances[0].leaveSummary
      });
      
      if (employeeBalances.length > 1) {
        console.log("DEBUG: Second employee sample:", {
          empId: employeeBalances[1].empId,
          employeeNumber: employeeBalances[1].employeeNumber,
          employeeName: employeeBalances[1].employeeName,
          leaveSummary: employeeBalances[1].leaveSummary
        });
      }
    }

    return successResponse(res, {
      employeeDetails: employeeBalances,
      totalEmployees: employeeBalances.length,
      companyId: cleanCompanyId,
      exportDate: new Date().toISOString()
    }, "Bulk leave balances exported successfully");

  } catch (error) {
    console.error('Bulk export leave balances error:', error);
    return errorResponse(res, error);
  }
};
module.exports = {
  bulkUploadLeaves,
  getLeavesByCompany,
  bulkExportBalances
};
