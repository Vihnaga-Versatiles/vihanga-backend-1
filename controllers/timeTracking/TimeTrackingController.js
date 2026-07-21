const TimeTrackingModel = require("../../models/timeTrackingModel/TimeTrackingModel");
const TimeTrackingUploadBatchModel = require("../../models/timeTrackingModel/TimeTrackingUploadBatch");
const WorkflowModel = require("../../models/recruitment/workflow/workflowModel");
const EmployeeModel = require("../../models/employee.model");
const { sendEmail } = require("../../middlewares/recruitment/sendMail");
const jwt = require("jsonwebtoken");
const { CLIENTURL, JWT_SECRET } = require("../../config/environment");
const { uploadFileToDrive, deleteFileFromDrive } = require("../../middlewares/recruitment/drive");
const mongoose = require("mongoose");
const {
  successResponse,
  errorResponse,
} = require("../../utils/recruitment/responseHandler");

const buildEmailLoginLink = ({ emailId, redirectPath }) => {
  const cleanEmail = (emailId || "").toString().replace(/[\r\n]/g, "").trim().toLowerCase();
  const safeRedirect = (redirectPath || "/admin/dashboard").toString().trim();
  const token = jwt.sign(
    { email: cleanEmail, fromEmail: true, purpose: "email_link_login" },
    process.env.JWT_SECRET || JWT_SECRET,
    { expiresIn: "2d" }
  );
  return `${CLIENTURL}/auth/login?fromEmail=true&emailId=${encodeURIComponent(
    cleanEmail
  )}&token=${encodeURIComponent(token)}&redirect=${encodeURIComponent(safeRedirect)}`;
};

// Helper function to calculate distance between two coordinates using Haversine formula
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  // Check if coordinates are valid
  if (!lat1 || !lon1 || !lat2 || !lon2) {
    return "00km 00m";
  }

  // Convert latitude and longitude from degrees to radians
  const toRadians = (degrees) => degrees * (Math.PI / 180);

  const R = 6371; // Earth's radius in kilometers
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distanceInKm = R * c;

  // Convert to km and meters format
  const kilometers = Math.floor(distanceInKm);
  const meters = Math.round((distanceInKm - kilometers) * 1000);

  // Format as "00km 00m"
  const formattedKm = kilometers.toString().padStart(2, '0');
  const formattedMeters = meters.toString().padStart(2, '0');

  return `${formattedKm}km ${formattedMeters}m`;
};

// Function to get approver details based on approver type
const getApproverDetails = async (approverId, employee, companyId) => {
  try {
    switch (approverId) {
      case 'line_manager':
        if (employee.employmentInformation && employee.employmentInformation.lineManager) {
          const lineManager = await EmployeeModel.findById(employee.employmentInformation.lineManager);
          return {
            approverType: 'Line Manager',
            approverDetails: lineManager,
            approverId: employee.employmentInformation.lineManager
          };
        }
        return null;

      case 'hr_manager':
        // Find HR Manager based on company and role
        const hrManager = await EmployeeModel.findOne({
          companyId: companyId,
          'employmentInformation.role': 'HR Admin',
          'employmentInformation.status': 'Active'
        });
        return {
          approverType: 'HR Manager',
          approverDetails: hrManager,
          approverId: hrManager?._id
        };

      case 'dept_head':
        // Find Department Head based on company and department
        const deptHead = await EmployeeModel.findOne({
          companyId: companyId,
          'employmentInformation.department': employee.employmentInformation?.department,
          'employmentInformation.departmentHead': 'Yes',
          'employmentInformation.status': 'Active'
        });
        return {
          approverType: 'Functional Head',
          approverDetails: deptHead,
          approverId: deptHead?._id
        };

      case 'ceo':
        // Find CEO based on company and role
        const ceo = await EmployeeModel.findOne({
          companyId: companyId,
          'employmentInformation.role': 'Super Admin',
          'employmentInformation.status': 'Active'
        });
        return {
          approverType: 'CEO',
          approverDetails: ceo,
          approverId: ceo?._id
        };

      case 'project_manager':
        // Find Project Manager based on company and role
        const projectManager = await EmployeeModel.findOne({
          companyId: companyId,
          'employmentInformation.role': 'Manager',
          'employmentInformation.status': 'Active'
        });
        return {
          approverType: 'Project Manager',
          approverDetails: projectManager,
          approverId: projectManager?._id
        };

      default:
        return null;
    }
  } catch (error) {
    console.error('Error getting approver details:', error);
    return null;
  }
};

// Helper function to check for time overlaps
/** Round hours to 2 decimal places when it's a numeric value; preserve strings like "7h 13m" */
const roundHours = (val) => {
  if (val == null || val === '') return null;
  if (typeof val === 'string' && /[a-zA-Z]/.test(val)) return val; // e.g. "7h 13m"
  const num = parseFloat(val);
  if (isNaN(num)) return val;
  return Math.round(num * 100) / 100;
};

const checkTimeOverlap = async (userId, dateString, timeIn, timeOut, excludeId = null) => {
  try {
    console.log(`Checking time overlap for user ${userId} on ${dateString} from ${timeIn} to ${timeOut}`);

    // Helper to convert various time forms into decimal hours (0..24)
    const toDecimal = (t) => {
      if (t == null) return null;
      // number
      if (typeof t === 'number') {
        if (t > 0 && t <= 1) return t * 24; // Excel day fraction
        return t; // assume hours
      }
      if (typeof t === 'string') {
        const s = t.trim();
        if (!s) return null;
        // 12h with AM/PM
        const ampmMatch = s.match(/^(\d{1,2})(?::(\d{1,2}))?(?::(\d{1,2}))?\s*([AaPp][Mm])$/);
        if (ampmMatch) {
          let h = parseInt(ampmMatch[1] || '0', 10);
          const m = parseInt(ampmMatch[2] || '0', 10);
          const sec = parseInt(ampmMatch[3] || '0', 10);
          const mer = ampmMatch[4].toUpperCase();
          if (mer === 'PM' && h !== 12) h += 12;
          if (mer === 'AM' && h === 12) h = 0;
          return h + m / 60 + sec / 3600;
        }
        // 24h HH:mm(:ss)
        if (s.includes(':')) {
          const parts = s.split(':').map(Number);
          const hours = parts[0] || 0;
          const minutes = parts[1] || 0;
          const seconds = parts[2] || 0;
          return hours + minutes / 60 + seconds / 3600;
        }
        // plain number string
        const num = parseFloat(s);
        if (Number.isFinite(num)) {
          if (num > 0 && num <= 1) return num * 24; // Excel day fraction as string
          return num; // decimal hours
        }
      }
      return null;
    };

    // Convert time strings to comparable format (decimal hours)
    const newTimeIn = toDecimal(timeIn);
    const newTimeOut = toDecimal(timeOut);

    // Handle case where timeOut is next day (like 4.55 next day)
    let adjustedTimeOut = newTimeOut;
    if (newTimeOut < newTimeIn) {
      adjustedTimeOut = newTimeOut + 24; // Add 24 hours for next day
    }

    // Build query to find existing entries for same user and date
    // Exclude rejected entries as they don't count for overlap
    const query = {
      userId: userId,
      dateString: dateString,
      status: { $ne: "rejected" },
      $or: [
        { timeIn: { $exists: true } },
        { timeOut: { $exists: true } }
      ]
    };

    // Exclude current entry if updating
    if (excludeId) {
      query._id = { $ne: excludeId };
    }

    const existingEntries = await TimeTrackingModel.find(query);
    console.log(`Found ${existingEntries.length} existing entries for overlap check`);

    for (const entry of existingEntries) {
      if (!entry.timeIn || !entry.timeOut) continue;

      const existingTimeIn = toDecimal(entry.timeIn);
      let existingTimeOut = toDecimal(entry.timeOut);

      // Handle next day scenario for existing entry
      if (existingTimeOut < existingTimeIn) {
        existingTimeOut = existingTimeOut + 24;
      }

      // Check for overlap
      const hasOverlap = (newTimeIn < existingTimeOut && adjustedTimeOut > existingTimeIn);

      if (hasOverlap) {
        console.log(`⚠️ Time overlap detected!`);
        console.log(`Existing: ${existingTimeIn} to ${existingTimeOut}`);
        console.log(`New: ${newTimeIn} to ${adjustedTimeOut}`);

        // Format times for display
        const formatTime = (decimalTime) => {
          const hours = Math.floor(decimalTime % 24);
          const minutes = Math.round((decimalTime % 1) * 60);
          return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        };

        return {
          hasOverlap: true,
          conflictingEntry: {
            date: entry.dateString,
            existingTimeIn: formatTime(existingTimeIn),
            existingTimeOut: formatTime(existingTimeOut),
            newTimeIn: formatTime(newTimeIn),
            newTimeOut: formatTime(adjustedTimeOut)
          }
        };
      }
    }

    console.log(`✅ No time overlap found`);
    return { hasOverlap: false };
  } catch (error) {
    console.error('Error checking time overlap:', error);
    return { hasOverlap: false };
  }
};

// Helper function to move to next approval level
const moveToNextLevel = async (timeEntry, currentLevel) => {
  const workflow = await WorkflowModel.findById(timeEntry.workflowId);
  if (!workflow) return false;

  const nextLevel = (parseInt(currentLevel) + 1).toString();
  const nextLevelApprovers = workflow.approvalChain[nextLevel];

  if (nextLevelApprovers && nextLevelApprovers.length > 0) {
    // Set next level as current
    timeEntry.currentLevel = nextLevel;

    // Update current approvers
    const nextApprovers = [];
    const levelData = timeEntry.approverLevels.get(nextLevel);

    if (levelData) {
      levelData.status = 'pending';
      nextApprovers.push(...levelData.approvers.map(approver => ({
        approverId: approver.approverId,
        approverType: approver.approverType,
        approverName: approver.approverName,
        approverEmail: approver.approverEmail,
        level: nextLevel
      })));
    }

    timeEntry.currentApprovers = nextApprovers;
    await timeEntry.save();

    // Send notifications to next level approvers
    for (const approver of nextApprovers) {
      if (approver.approverEmail) {
        try {
          await sendEmail(
            approver.approverEmail,
            `Time Entry Approval Required - ${timeEntry.employeeInfo.name}`,
            {
              name: approver.approverName,
              timeEntryApproval: true,
              timeEntryDetails: {
                employeeName: timeEntry.employeeInfo.name,
                employeeEmail: timeEntry.employeeInfo.email,
                date: timeEntry.dateString,
                timeIn: timeEntry.timeIn,
                timeOut: timeEntry.timeOut || 'Not specified',
                hours: timeEntry.hours,
                method: timeEntry.method,
                reason: timeEntry.reason || 'No reason provided',
                approvalLink: buildEmailLoginLink({
                  emailId: approver.approverEmail,
                  redirectPath: "/admin/previlages/time-tracking",
                }),
              }
            },
            true
          );
        } catch (emailError) {
          console.error('Failed to send approval email:', emailError);
        }
      }
    }

    return true;
  }

  return false; // No more levels
};

const createTimeTracking = async (req, res) => {
  try {
    const { companyId, userId } = req.query;

    const uploading = req.body.uploading || false;

    if (!companyId) {
      return res.status(400).json({ message: "Company ID is required" });
    }

    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }

    // Fetch employee details
    const employee = await EmployeeModel.findById(userId);
    if (!employee) {
      return errorResponse(res, "Employee not found", 404);
    }


    let timeData;
    if (uploading) {
      timeData = req.body.json.map(item => {

        const dateObj = new Date(item.Date);
        const formattedDate = `${dateObj.getMonth() + 1}/${dateObj.getDate()}/${dateObj.getFullYear()}`;

        return {
          longitude: item.longitude || null, // Legacy field for backward compatibility
          latitude: item.latitude || null, // Legacy field for backward compatibility
          distanceTraveled: {
            clockInCoordinates: {
              longitude: item.longitude || null,
              latitude: item.latitude || null
            },
            clockOutCoordinates: {
              longitude: null,
              latitude: null
            },
            distanceInKm: "00 km and 00 meters",
            calculatedAt: null
          },
          Timetable: item.Timetable || "",
          Duration: item.Duration || "",
          ActualWT: item.ActualWT || "",
          TotalOT: item.TotalOT || "",
          NormalOT: item.NormalOT || "",
          WeekOffOT: item.WeekOffOT || "",
          HolidayOT: item.HolidayOT || "",
          Remarks: item.Remarks || item.remarks || "", // Handle both uppercase and lowercase remarks
          dateString: formattedDate,
          timeIn: item.TimeIn,
          timeOut: item.TimeOut,
          method: item.Method?.toLowerCase() || "",
        };
      });


      const allManual = timeData.every(item => item.method === 'manual');
      if (!allManual) {
        return res.status(400).json({ message: "All entries must have the method set to 'manual'" });
      }
    } else {
      timeData = [req.body]; // Single entry for non-uploading case
    }



    // Employee information for quick access
    const employeeInfo = {
      name: `${employee.personalInformation?.firstName} ${employee.personalInformation?.lastName}`,
      email: employee.contactInformation?.email,
      department: employee.employmentInformation?.department,
      position: employee.employmentInformation?.position,
      location: employee.employmentInformation?.location
    };

    const createdEntries = [];
    let anyRequiresApproval = false;



    for (const entry of timeData) {

      const dateObj = new Date(entry.Date);

      const formattedDate = `${dateObj.getMonth() + 1}/${dateObj.getDate()}/${dateObj.getFullYear()}`;
      // Prepare data for the current time entry
      const data = {
        longitude: entry.longitude || null, // Legacy field for backward compatibility
        latitude: entry.latitude || null, // Legacy field for backward compatibility
        distanceTraveled: {
          clockInCoordinates: {
            longitude: entry.longitude || null,
            latitude: entry.latitude || null
          },
          clockOutCoordinates: {
            longitude: null,
            latitude: null
          },
          distanceInKm: "00km 00m",
          calculatedAt: null
        },
        Timetable: entry.Timetable || "",
        Duration: entry.Duration || "",
        ActualWT: entry.ActualWT || "",
        TotalOT: entry.TotalOT || "",
        NormalOT: entry.NormalOT || "",
        WeekOffOT: entry.WeekOffOT || "",
        HolidayOT: entry.HolidayOT || "",
        Remarks: entry.Remarks || entry.remarks || "", // Handle both uppercase and lowercase remarks
        dateString: entry.dateString || formattedDate,
        timeIn: entry.timeIn || entry.TimeIn,
        timeOut: entry.timeOut || entry.TimeOut,
        method: (entry.method || entry.Method)?.toLowerCase() || "",
        companyId,
        userId,
        hours: roundHours(entry.hours) ?? (entry.hours || null), // Round numeric hours to 2 decimals
        reason: entry.reason || null // Include reason if provided in payload
      };

      // Check for time overlap if timeIn and timeOut are provided
      if (data.timeIn && data.timeOut) {
        const overlapCheck = await checkTimeOverlap(userId, data.dateString, data.timeIn, data.timeOut);
        if (overlapCheck.hasOverlap) {
          return res.status(400).json({
            message: `Time overlap detected for ${data.dateString}. Employee is already logged in from ${overlapCheck.conflictingEntry.existingTimeIn} to ${overlapCheck.conflictingEntry.existingTimeOut}. New entry time: ${overlapCheck.conflictingEntry.newTimeIn} to ${overlapCheck.conflictingEntry.newTimeOut}`
          });
        }
      }

      // For manual entries, check for workflow and setup approval process
      let workflow = null;
      let requiresApproval = false;

      if (data.method === 'manual') {
        // Check for workflow with transaction type "time_tracking"
        workflow = await WorkflowModel.findOne({
          companyId,
          "transactionType.id": "timesheet"
        });

        requiresApproval = !!workflow;
        if (requiresApproval) {
          anyRequiresApproval = true;
        }
      }


      // // For manual entries, check for workflow and setup approval process
      // let workflow = null;
      // let requiresApproval = false;

      // if (data.method === 'manual') {
      //   // Check for workflow with transaction type "time_tracking"
      //   workflow = await WorkflowModel.findOne({
      //     companyId,
      //     "transactionType.id": "timesheet"
      //   });

      //   requiresApproval = !!workflow;



      // Setup approval workflow data if required
      let approverLevels = new Map();
      let currentApprovers = [];
      let firstApprover = null;

      if (requiresApproval && workflow && workflow.approvalChain) {
        // Build approver levels from workflow
        for (const [level, approvers] of Object.entries(workflow.approvalChain)) {
          const levelApprovers = [];

          for (const approverData of approvers) {
            console.log(`Fetching approver details for: ${approverData.id}`);
            const approverInfo = await getApproverDetails(approverData.id, employee, companyId);

            if (approverInfo && approverInfo.approverDetails) {
              const approverEntry = {
                approverId: approverInfo.approverId,
                approverType: approverInfo.approverType,
                approverName: `${approverInfo.approverDetails.personalInformation?.firstName} ${approverInfo.approverDetails.personalInformation?.lastName}`,
                approverEmail: approverInfo.approverDetails.contactInformation?.email,
                status: 'pending'
              };
              levelApprovers.push(approverEntry);
              console.log(`Added approver for level ${level}:`, approverEntry);
            } else {
              console.log(`No approver found for: ${approverData.id}`);
            }
          }

          if (levelApprovers.length > 0) {
            approverLevels.set(level, {
              status: level === "0" ? 'pending' : 'pending',
              approvers: levelApprovers
            });

            // Set current approvers for level 0
            if (level === "0") {
              currentApprovers = levelApprovers.map(approver => ({
                approverId: approver.approverId,
                approverType: approver.approverType,
                approverName: approver.approverName,
                approverEmail: approver.approverEmail,
                level: level
              }));
              firstApprover = levelApprovers[0]; // Get first approver for email
              console.log('Level 0 current approvers set:', currentApprovers);
            }
          }
        }

        // Send email notification to the first approver
        if (firstApprover && firstApprover.approverEmail) {
          try {
            await sendEmail(
              firstApprover.approverEmail,
              `Time Entry Approval Required - ${employeeInfo.name}`,
              {
                name: firstApprover.approverName,
                timeEntryApproval: true,
                timeEntryDetails: {
                  employeeName: employeeInfo.name,
                  employeeEmail: employeeInfo.email,
                  date: data.dateString,
                  timeIn: data.timeIn,
                  timeOut: data.timeOut || 'Not specified',
                  hours: data.hours,
                  method: data.method,
                  reason: data.reason || 'No reason provided',
                  approvalLink: buildEmailLoginLink({
                    emailId: firstApprover.approverEmail,
                    redirectPath: "/admin/previlages/time-tracking",
                  }),
                }
              },
              true
            );
            console.log(`✅ Time entry approval email sent to ${firstApprover.approverName}`);
          } catch (emailError) {
            console.error('❌ Failed to send time entry approval email:', emailError);
          }
        }
      }

      // Create time tracking entry
      const timeTrackingData = {
        ...data,
        status: requiresApproval ? 'pending' : 'approved',
        workflowId: workflow ? workflow._id : null,
        currentLevel: requiresApproval ? "0" : null,
        approverLevels: approverLevels,
        currentApprovers: currentApprovers,
        employeeInfo: employeeInfo,
        approvalHistory: []
      };

      const newTimeTracking = await TimeTrackingModel.create(timeTrackingData);

      console.log('Time tracking entry created successfully with ID:', newTimeTracking._id);
      createdEntries.push(newTimeTracking);
    }
    const message = anyRequiresApproval
      ? "Time tracking entry created successfully and sent for approval"
      : "Time tracking entry created successfully";

    return successResponse(res, {
      data: createdEntries,
      message: message
    });
  } catch (error) {
    return errorResponse(res, error);
  }
};



const excelDateToJSDate = (serial) => {
  const utc_days = Math.floor(serial - 25569);
  const utc_value = utc_days * 86400; // seconds
  return new Date(utc_value * 1000);   // ms
};



const bulkUploadTimeTracking = async (req, res) => {
  try {
    const { companyId } = req.query;
    const { uploading, data, fileMeta, type } = req.body;

    if (!companyId) {
      return res.status(400).json({ message: "Company ID is required" });
    }

    if (!data || typeof data !== 'object' || Object.keys(data).length === 0) {
      return res.status(400).json({ message: "No time tracking data provided" });
    }

    const createdEntries = [];
    let anyRequiresApproval = false;
    const processingErrors = [];

    // Create a batch record upfront for tracking and rollback
    let totalRecords = 0;
    try {
      totalRecords = Object.values(data || {}).reduce((acc, arr) => acc + (Array.isArray(arr) ? arr.length : 0), 0);
    } catch (_) { totalRecords = 0; }

    const batchDoc = await TimeTrackingUploadBatchModel.create({
      companyId,
      filename: fileMeta?.filename || null,
      fileSize: fileMeta?.fileSize || null,
      s3Key: fileMeta?.s3Key || null,
      s3Url: fileMeta?.s3Url || null,
      type: type || null,
      status: 'processing',
      totalRecords
    });

    // Helper to robustly parse date strings like '21-7-25', '2025-07-25', '7/25/2025', or '01/10/25'
    function parseDateString(dateStr) {
      if (!dateStr) return null;
      if (typeof dateStr === 'number') return excelDateToJSDate(dateStr);
      const str = String(dateStr).trim();
      // Try to parse 'YY-M-D' or 'YYYY-MM-DD'
      let parts = str.split('-');
      if (parts.length === 3 && parts.every(Boolean)) {
        let [p1, p2, p3] = parts;
        let year, month, day;
        if (p1.length === 4) {
          // YYYY-MM-DD
          year = p1; month = p2; day = p3;
        } else {
          // DD-MM-YY or DD-MM-YYYY
          year = p3;
          month = p2;
          day = p1;
        }
        if (year.length === 2) year = '20' + year; // 25 => 2025
        return new Date(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
      }
      // Try slashes: support both M/D/YYYY and D/M/YY (Indian style)
      parts = str.split('/');
      if (parts.length === 3 && parts.every(Boolean)) {
        let [a, b, c] = parts; // a and b are day/month in some order; c is year
        let year = c.length === 2 ? ('20' + c) : c;
        const nA = parseInt(a, 10);
        const nB = parseInt(b, 10);
        let day, month;
        if (nA > 12 && nB <= 12) {
          // D/M/YY or D/M/YYYY (unambiguous day-first)
          day = a; month = b;
        } else if (nB > 12 && nA <= 12) {
          // M/D/YYYY (unambiguous month-first)
          month = a; day = b;
        } else {
          // Ambiguous (both <= 12). Prefer day-first for Indian-style formats.
          day = a; month = b;
        }
        return new Date(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
      }
      // Fallback
      return new Date(str);
    }

    // Loop over each employeeNumber
    // Track in-batch duplicates by user/date/timeIn/timeOut
    const inBatchSeen = new Set();
    for (const [employeeNumber, timeData] of Object.entries(data)) {
      if (!employeeNumber) continue;

      // Fetch employee details using employeeNumber
      const employee = await EmployeeModel.findOne({
        companyId: companyId,
        'employmentInformation.employeeNumber': employeeNumber
      });
      if (!employee) {
        const errorMsg = `Employee not found for employeeNumber: ${employeeNumber}`;
        processingErrors.push({
          employeeNumber: employeeNumber,
          error: errorMsg
        });
        continue;
      }

      // Get the actual userId from the found employee
      const userId = employee._id.toString();

      // Employee info for quick reuse
      const employeeInfo = {
        name: `${employee.personalInformation?.firstName} ${employee.personalInformation?.lastName}`,
        email: employee.contactInformation?.email,
        department: employee.employmentInformation?.department,
        position: employee.employmentInformation?.position,
        location: employee.employmentInformation?.location
      };

      // Helpers to normalize time inputs
      const parseDurationToHours = (row) => {
        // Support Hours/Minutes or Duration strings like "7h 30m"
        let durH = null;
        if (row.Hours != null || row.hours != null || row.Minutes != null || row.minutes != null) {
          const H = parseFloat(row.Hours ?? row.hours ?? 0) || 0;
          const M = parseFloat(row.Minutes ?? row.minutes ?? 0) || 0;
          durH = H + M / 60;
        } else if (typeof row.Duration === 'string') {
          const m = row.Duration.match(/(\d+)\s*h(?:r)?\s*(\d+)?\s*m?/i);
          if (m) {
            const H = parseInt(m[1] || '0', 10);
            const M = parseInt(m[2] || '0', 10);
            durH = H + M / 60;
          }
        }
        return durH;
      };

      const parseTimeFlexible = (val) => {
        if (val == null || val === '') return null;

        // If already HH:mm or HH:mm:ss format, return as-is
        if (typeof val === 'string' && val.match(/^\d{1,2}:\d{2}(:\d{2})?$/)) {
          const parts = val.split(':').map(p => parseInt(p, 10) || 0);
          const h = parts[0] || 0;
          const m = parts[1] || 0;
          return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        }

        // Convert other formats to HH:mm
        let hours = 0;

        if (typeof val === 'number') {
          // Excel day fraction or decimal hours
          hours = (val > 0 && val <= 1) ? val * 24 : val;
        } else {
          const s = String(val).trim();
          if (!s) return null;

          // Dot separated like 9.28 or 9.28 AM
          const dotMatch = s.match(/^(\d{1,2})\.(\d{1,2})(?:\.(\d{1,2}))?\s*([AaPp][Mm])?$/);
          if (dotMatch) {
            let h = parseInt(dotMatch[1] || '0', 10);
            const m = parseInt(dotMatch[2] || '0', 10);
            const sec = parseInt(dotMatch[3] || '0', 10);
            const mer = (dotMatch[4] || '').toUpperCase();
            if (mer) {
              if (mer === 'PM' && h !== 12) h += 12;
              if (mer === 'AM' && h === 12) h = 0;
            }
            hours = h + m / 60 + sec / 3600;
          }
          // AM/PM format
          else if (s.match(/^(\d{1,2})(?::(\d{1,2}))?(?::(\d{1,2}))?\s*([AaPp][Mm])$/)) {
            const ampmMatch = s.match(/^(\d{1,2})(?::(\d{1,2}))?(?::(\d{1,2}))?\s*([AaPp][Mm])$/);
            let h = parseInt(ampmMatch[1] || '0', 10);
            const m = parseInt(ampmMatch[2] || '0', 10);
            const sec = parseInt(ampmMatch[3] || '0', 10);
            const mer = ampmMatch[4].toUpperCase();
            if (mer === 'PM' && h !== 12) h += 12;
            if (mer === 'AM' && h === 12) h = 0;
            hours = h + m / 60 + sec / 3600;
          }
          // Numeric string (could be day fraction)
          else {
            const num = parseFloat(s);
            if (Number.isFinite(num)) {
              hours = (num > 0 && num <= 1) ? num * 24 : num;
            } else {
              return null;
            }
          }
        }

        // Convert hours to HH:mm format
        const h = Math.floor(hours);
        const m = Math.round((hours - h) * 60);
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      };

      // Map each timeData row to normalized entry
      let processedData = timeData.map(item => {
        let dateObj = parseDateString(item.Date || item.dateString);
        // Prepare day name and date string in "DD Mon YYYY" (e.g., 29 Oct 2025)
        const dayName = dateObj && !isNaN(dateObj)
          ? dateObj.toLocaleDateString('en-GB', { weekday: 'long' })
          : '';
        const formattedDate = dateObj && !isNaN(dateObj)
          ? dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/,/g, '')
          : '';

        // Normalize time in/out from various formats
        const rawIn = item.TimeIn ?? item.timeIn ?? item["Time In"] ?? item.In ?? null;
        const rawOut = item.TimeOut ?? item.timeOut ?? item["Time Out"] ?? item.Out ?? null;
        let timeInNorm = parseTimeFlexible(rawIn);
        let timeOutNorm = parseTimeFlexible(rawOut);

        // If duration provided (Hours/Minutes) and timeOut missing but timeIn present, compute timeOut
        if (!timeOutNorm && timeInNorm) {
          const durH = parseDurationToHours(item);
          if (durH != null) {
            // convert stored day fraction back to hours, add duration, then re-fraction
            const inHours = parseFloat(timeInNorm) * 24;
            let outHours = inHours + durH;
            if (outHours >= 24) outHours -= 24; // wrap next day
            timeOutNorm = String(outHours / 24);
          }
        }

        // Hours text (for display)
        let hoursText = item.hours || item.Hours || null;
        if (!hoursText) {
          const durH = parseDurationToHours(item);
          if (durH != null) {
            const h = Math.floor(durH);
            const m = Math.round((durH - h) * 60);
            hoursText = `${h}h ${m}m`;
          }
        }

        return {
          userId: userId,
          companyId: companyId,
          batchId: batchDoc._id,
          Remarks: item.Remarks || item.remarks || '',
          // Store both friendly date and day-of-week for UI rendering
          day: dayName,
          dateString: formattedDate,
          timeIn: timeInNorm,
          timeOut: timeOutNorm,
          method: (item.Method || item.method || '').toLowerCase(),
          reason: item.Reason || item.reason || '',
          hours: roundHours(hoursText) ?? hoursText
        };
      });

      // Helper to format time values into HH:mm for error messages
      const formatHM = (val) => {
        if (val == null) return '-';
        let hours;
        if (typeof val === 'number') {
          // number may be decimal hours or day fraction
          hours = val <= 1 ? val * 24 : val;
        } else {
          const num = parseFloat(val);
          if (!isNaN(num)) {
            hours = num <= 1 ? num * 24 : num;
          } else {
            // Try HH:mm
            const parts = String(val).split(':').map(Number);
            if (parts.length >= 2) return `${String(parts[0]).padStart(2, '0')}:${String(parts[1]).padStart(2, '0')}`;
            return String(val);
          }
        }
        const h = Math.floor(hours);
        const m = Math.round((hours - h) * 60);
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      };

      // Now process each entry
      for (const entry of processedData) {
        try {
          // Skip duplicates within this batch
          const seenKey = `${userId}|${entry.dateString}|${entry.timeIn || ''}|${entry.timeOut || ''}`;
          if (inBatchSeen.has(seenKey)) {
            const errorMsg = `Duplicate entry · Emp ${employeeNumber} · Date ${entry.dateString} · Time ${formatHM(entry.timeIn)}-${formatHM(entry.timeOut)}`;
            // Rollback any created entries, mark batch failed and stop
            if (createdEntries.length > 0) {
              await TimeTrackingModel.deleteMany({ _id: { $in: createdEntries.map(e => e._id) } });
            }
            await TimeTrackingUploadBatchModel.findByIdAndUpdate(batchDoc._id, {
              status: 'failed', successCount: 0, errorCount: 1, anyRequiresApproval
            });
            return res.status(400).json({ success: false, message: errorMsg });
          }
          inBatchSeen.add(seenKey);

          // Check for time overlap if timeIn and timeOut are provided
          if (entry.timeIn && entry.timeOut) {
            const overlapCheck = await checkTimeOverlap(userId, entry.dateString, entry.timeIn, entry.timeOut);
            if (overlapCheck.hasOverlap) {
              const existIn = overlapCheck.conflictingEntry?.existingTimeIn;
              const existOut = overlapCheck.conflictingEntry?.existingTimeOut;
              const newIn = overlapCheck.conflictingEntry?.newTimeIn;
              const newOut = overlapCheck.conflictingEntry?.newTimeOut;
              const errorMsg = `Overlap · Emp ${employeeNumber} · Date ${entry.dateString} · Existing ${formatHM(existIn)}-${formatHM(existOut)} · New ${formatHM(newIn)}-${formatHM(newOut)}`;
              // Rollback any created entries, mark batch failed and stop
              if (createdEntries.length > 0) {
                await TimeTrackingModel.deleteMany({ _id: { $in: createdEntries.map(e => e._id) } });
              }
              await TimeTrackingUploadBatchModel.findByIdAndUpdate(batchDoc._id, {
                status: 'failed', successCount: 0, errorCount: 1, anyRequiresApproval
              });
              return res.status(400).json({ success: false, message: errorMsg });
            }
          }

          // Exact duplicate check against DB (only when at least timeIn is present)
          if (entry.timeIn) {
            const existingExact = await TimeTrackingModel.findOne({
              userId,
              companyId,
              dateString: entry.dateString,
              timeIn: entry.timeIn,
              timeOut: entry.timeOut || null
            }).lean();
            if (existingExact) {
              const errorMsg = `Duplicate · Emp ${employeeNumber} · Date ${entry.dateString} · Time ${formatHM(entry.timeIn)}-${formatHM(entry.timeOut)}`;
              // Rollback any created entries, mark batch failed and stop
              if (createdEntries.length > 0) {
                await TimeTrackingModel.deleteMany({ _id: { $in: createdEntries.map(e => e._id) } });
              }
              await TimeTrackingUploadBatchModel.findByIdAndUpdate(batchDoc._id, {
                status: 'failed', successCount: 0, errorCount: 1, anyRequiresApproval
              });
              return res.status(400).json({ success: false, message: errorMsg });
            }
          }

          let workflow = null;
          let requiresApproval = false;

          if (entry.method === 'manual') {
            workflow = await WorkflowModel.findOne({
              companyId,
              "transactionType.id": "timesheet"
            });
            requiresApproval = !!workflow;
            if (requiresApproval) anyRequiresApproval = true;
          }

          // Prepare approval levels
          let approverLevels = new Map();
          let currentApprovers = [];
          let firstApprover = null;

          if (requiresApproval && workflow && workflow.approvalChain) {
            for (const [level, approvers] of Object.entries(workflow.approvalChain)) {
              const levelApprovers = [];
              for (const approverData of approvers) {
                const approverInfo = await getApproverDetails(approverData.id, employee, companyId);
                if (approverInfo && approverInfo.approverDetails) {
                  const approverEntry = {
                    approverId: approverInfo.approverId,
                    approverType: approverInfo.approverType,
                    approverName: `${approverInfo.approverDetails.personalInformation?.firstName} ${approverInfo.approverDetails.personalInformation?.lastName}`,
                    approverEmail: approverInfo.approverDetails.contactInformation?.email,
                    status: 'pending'
                  };
                  levelApprovers.push(approverEntry);
                }
              }
              if (levelApprovers.length > 0) {
                approverLevels.set(level, {
                  status: 'pending',
                  approvers: levelApprovers
                });
                if (level === "0") {
                  currentApprovers = levelApprovers.map(approver => ({
                    approverId: approver.approverId,
                    approverType: approver.approverType,
                    approverName: approver.approverName,
                    approverEmail: approver.approverEmail,
                    level
                  }));
                  firstApprover = levelApprovers[0];
                }
              }
            }
            // Send first approver email
            if (firstApprover && firstApprover.approverEmail) {
              try {
                await sendEmail(
                  firstApprover.approverEmail,
                  `Time Entry Approval Required - ${employeeInfo.name}`,
                  {
                    name: firstApprover.approverName,
                    timeEntryApproval: true,
                    timeEntryDetails: {
                      employeeName: employeeInfo.name,
                      employeeEmail: employeeInfo.email,
                      date: entry.dateString,
                      timeIn: entry.timeIn,
                      timeOut: entry.timeOut || 'Not specified',
                      reason: entry.reason || 'No reason provided',
                      approvalLink: buildEmailLoginLink({
                        emailId: firstApprover.approverEmail,
                        redirectPath: "/admin/previlages/time-tracking",
                      }),
                    }
                  },
                  true
                );
              } catch (err) {
                // log but don't block
              }
            }
          }

          // Create time tracking entry
          const timeTrackingData = {
            ...entry,
            companyId,
            userId,
            status: requiresApproval ? 'pending' : 'approved',
            workflowId: workflow ? workflow._id : null,
            currentLevel: requiresApproval ? "0" : null,
            approverLevels,
            currentApprovers,
            employeeInfo,
            approvalHistory: []
          };

          const newTimeTracking = await TimeTrackingModel.create(timeTrackingData);
          createdEntries.push(newTimeTracking);
        } catch (entryError) {
          processingErrors.push({
            employeeNumber: employeeNumber,
            date: entry.dateString,
            error: entryError.message
          });
        }
      }
    }

    // Check if no entries were created
    if (createdEntries.length === 0 && processingErrors.length > 0) {
      // Mark batch as failed
      await TimeTrackingUploadBatchModel.findByIdAndUpdate(batchDoc._id, {
        status: 'failed',
        successCount: 0,
        errorCount: processingErrors.length,
        anyRequiresApproval
      });
      const topErrors = processingErrors.slice(0, 2);
      let errorMessage = "No time tracking entries were created due to errors. ";
      topErrors.forEach((error, index) => {
        errorMessage += `${index + 1}. ${error.error} `;
      });
      if (processingErrors.length > 2) {
        errorMessage += `and ${processingErrors.length - 2} more errors.`;
      }
      return res.status(400).json({
        success: false,
        message: errorMessage.trim(),
        totalProcessed: 0,
        batchId: batchDoc._id
      });
    }

    let message = anyRequiresApproval
      ? "Time tracking entries created successfully and sent for approval."
      : "Time tracking entries created successfully.";

    if (processingErrors.length > 0) {
      message += ` Note: ${processingErrors.length} entries failed to process. `;
      const topErrors = processingErrors.slice(0, 2);
      topErrors.forEach((error, index) => {
        message += `${index + 1}. ${error.error} `;
      });
      if (processingErrors.length > 2) {
        message += `and ${processingErrors.length - 2} more errors.`;
      }
    }

    // Update batch as completed
    await TimeTrackingUploadBatchModel.findByIdAndUpdate(batchDoc._id, {
      status: 'completed',
      successCount: createdEntries.length,
      errorCount: processingErrors.length,
      anyRequiresApproval,
      createdEntryIds: createdEntries.map(e => e._id)
    });

    const responseData = {
      success: true,
      data: createdEntries,
      message: message.trim(),
      totalProcessed: createdEntries.length,
      batchId: batchDoc._id
    };

    return res.status(200).json(responseData);

  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

// S3 file upload for time-tracking batch files
const uploadTimeTrackingFile = async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ success: false, message: "No file provided" });
    }
    const uploaded = await uploadFileToDrive(file.buffer, file.originalname, file.mimetype);
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
const listTimeTrackingBatches = async (req, res) => {
  try {
    const { companyId, limit = 20 } = req.query;
    if (!companyId) return res.status(400).json({ success: false, message: "Company ID is required" });
    const batches = await TimeTrackingUploadBatchModel.find({ companyId }).sort({ createdAt: -1 }).limit(parseInt(limit));
    return res.status(200).json({ success: true, data: batches });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Get batch details
const getTimeTrackingBatch = async (req, res) => {
  try {
    const { batchId } = req.params;
    const batch = await TimeTrackingUploadBatchModel.findById(batchId);
    if (!batch) return res.status(404).json({ success: false, message: "Batch not found" });
    return res.status(200).json({ success: true, data: batch });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Get records created by batch (paginated)
const getTimeTrackingBatchRecords = async (req, res) => {
  try {
    const { batchId } = req.params;
    const { companyId, page = 1, limit = 50 } = req.query;
    if (!companyId) return res.status(400).json({ success: false, message: "Company ID is required" });
    const query = { companyId, batchId };
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [items, total] = await Promise.all([
      TimeTrackingModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)),
      TimeTrackingModel.countDocuments(query)
    ]);
    return res.status(200).json({ success: true, data: items, total });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Rollback a batch: delete all time-tracking entries created by this batch
const rollbackTimeTrackingBatch = async (req, res) => {
  try {
    const { batchId } = req.params;
    const { companyId } = req.query;
    if (!companyId) return res.status(400).json({ success: false, message: "Company ID is required" });

    const batch = await TimeTrackingUploadBatchModel.findById(batchId);
    if (!batch) return res.status(404).json({ success: false, message: "Batch not found" });
    if (batch.status === 'rolled_back') {
      return res.status(400).json({ success: false, message: "Batch already rolled back" });
    }

    const deleteResult = await TimeTrackingModel.deleteMany({ companyId, batchId });
    await TimeTrackingUploadBatchModel.findByIdAndUpdate(batchId, {
      status: 'rolled_back',
      rolledBackAt: new Date()
    });

    return res.status(200).json({ success: true, data: { deletedCount: deleteResult.deletedCount } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Delete a batch record (and S3 file) after rollback or failure
const deleteTimeTrackingBatch = async (req, res) => {
  try {
    const { batchId } = req.params;
    const { companyId } = req.query;
    if (!companyId) return res.status(400).json({ success: false, message: "Company ID is required" });

    const batch = await TimeTrackingUploadBatchModel.findById(batchId);
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

    await TimeTrackingUploadBatchModel.findByIdAndDelete(batchId);
    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};


const getAllTimeTrackings = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || null;
    const limit = parseInt(req.query.limit) || null;
    const skip = (page - 1) * limit;
    const search = req.query.search || "";
    const { companyId, userId, currentUserId, status, viewType, id, from, to, method } = req.query;
    const normalizedType = (req.query.type || 'me').toString().trim().toLowerCase();
    const cleanCompanyId = (companyId || '').toString().replace(/^"|"$/g, '').trim();

    let filters = {};
    let useOrQuery = false;
    let orConditions = [];

    // Company filter (always required)
    if (cleanCompanyId) {
      filters.companyId = cleanCompanyId;
    }

    if (id) {
      filters._id = id;
    }

    // Date range filter - handle multiple date formats
    if (from || to) {
      // Helper function to parse date strings in various formats
      const parseDateString = (dateStr) => {
        if (!dateStr) return null;

        // Handle "D-M-YYYY" format (e.g., "16-8-2025")
        if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(dateStr)) {
          const [day, month, year] = dateStr.split('-');
          return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        }

        // Handle "DD MMM YYYY" format (e.g., "06 Jul 2025")
        if (/^\d{2} \w{3} \d{4}$/.test(dateStr)) {
          return new Date(dateStr);
        }

        // Handle "M/D/YYYY" format (e.g., "7/7/2025")
        if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateStr)) {
          return new Date(dateStr);
        }

        // Handle ISO format (e.g., "2025-08-16")
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
          return new Date(dateStr);
        }

        // Try default parsing
        return new Date(dateStr);
      };

      const fromDate = parseDateString(from);
      const toDate = parseDateString(to);

      // Helper function to create date parsing expressions for different formats
      const createDateParsingExpression = (dateStr) => {
        return {
          $dateFromString: {
            dateString: dateStr,
            format: {
              $switch: {
                branches: [
                  // Handle "D-M-YYYY" format (e.g., "16-8-2025")
                  {
                    case: { $regexMatch: { input: dateStr, regex: /^\d{1,2}-\d{1,2}-\d{4}$/ } },
                    then: "%d-%m-%Y"
                  },
                  // Handle "DD MMM YYYY" format (e.g., "06 Jul 2025")
                  {
                    case: { $regexMatch: { input: dateStr, regex: /^\d{2} \w{3} \d{4}$/ } },
                    then: "%d %b %Y"
                  },
                  // Handle "M/D/YYYY" format (e.g., "7/7/2025")
                  {
                    case: { $regexMatch: { input: dateStr, regex: /^\d{1,2}\/\d{1,2}\/\d{4}$/ } },
                    then: "%m/%d/%Y"
                  }
                ],
                default: "%d %b %Y"
              }
            },
            onError: null
          }
        };
      };

      if (fromDate && toDate) {
        // Add one day to toDate to make it inclusive
        const toDateInclusive = new Date(toDate);
        toDateInclusive.setDate(toDateInclusive.getDate() + 1);

        filters.$expr = {
          $and: [
            { $gte: [createDateParsingExpression("$dateString"), fromDate] },
            { $lt: [createDateParsingExpression("$dateString"), toDateInclusive] }
          ]
        };
      } else if (fromDate) {
        filters.$expr = {
          $gte: [createDateParsingExpression("$dateString"), fromDate]
        };
      } else if (toDate) {
        const toDateInclusive = new Date(toDate);
        toDateInclusive.setDate(toDateInclusive.getDate() + 1);
        filters.$expr = {
          $lt: [createDateParsingExpression("$dateString"), toDateInclusive]
        };
      }
    }

    // Convert currentUserId to ObjectId for queries
    const userObjectId = mongoose.Types.ObjectId.isValid(currentUserId)
      ? new mongoose.Types.ObjectId(currentUserId)
      : currentUserId;

    // Determine filtering logic based on type
    if (normalizedType === 'me') {
      if (userId) {
        // When userId is provided, show only that user's time entries
        filters.userId = userId;
        console.log('Type: me with userId → Specific user time entries only');
      } else if (currentUserId) {
        // Default: user's own entries + pending approvals
        useOrQuery = true;
        orConditions.push({ userId: currentUserId });
        orConditions.push({ 'currentApprovers.approverId': userObjectId, status: 'pending' });
        console.log('Type: me → Own entries + Pending approvals');
      }
    } else if (normalizedType === 'myteam') {
      // Show team members' time entries (and optionally manager's own entries)
      if (currentUserId) {
        const teamMembers = await EmployeeModel.find({
          companyId: cleanCompanyId,
          'employmentInformation.status': 'Active',
          'employmentInformation.lineManager': currentUserId
        }).select('_id');
        const teamIds = teamMembers.map(m => m._id.toString());
        // Include manager as well
        teamIds.push(currentUserId);
        filters.userId = { $in: teamIds };
        console.log('Type: myteam → Team time entries');
      }
    } else if (normalizedType === 'myfunction') {
      // Show function members' time entries (same department)
      if (currentUserId) {
        const currentUser = await EmployeeModel.findById(currentUserId).select('employmentInformation.department employmentInformation.legalEntityMappings');

        let userFunctions = [];
        if (currentUser && currentUser.employmentInformation) {
          // Add primary department
          if (currentUser.employmentInformation.department) {
            userFunctions.push(currentUser.employmentInformation.department);
          }
          // Add functions from legal entity mappings
          if (currentUser.employmentInformation.legalEntityMappings && Array.isArray(currentUser.employmentInformation.legalEntityMappings)) {
            currentUser.employmentInformation.legalEntityMappings.forEach(mapping => {
              if (mapping.function) {
                userFunctions.push(mapping.function);
              }
            });
          }
        }

        // Remove duplicates
        userFunctions = [...new Set(userFunctions)];

        if (userFunctions.length > 0) {
          const functionMembers = await EmployeeModel.find({
            companyId: cleanCompanyId,
            'employmentInformation.status': 'Active',
            $or: [
              { "employmentInformation.department": { $in: userFunctions } },
              { "employmentInformation.legalEntityMappings.function": { $in: userFunctions } }
            ]
          }).select('_id');
          const functionIds = functionMembers.map(m => m._id.toString());
          filters.userId = { $in: functionIds };
          console.log('Type: myfunction → Function time entries');
        } else {
          filters.userId = currentUserId;
        }
      }
    } else if (normalizedType === 'mycompany') {
      // Company-wide time entries already scoped by companyId
      console.log('Type: mycompany → Company time entries');

    } else {
      // Fallback to role-based logic for backward compatibility
      if (userId && userId === currentUserId) {
        // Special case: Show user's own entries AND entries they need to approve
        useOrQuery = true;

        // Condition 1: User's own entries
        orConditions.push({ userId: userId });

        // Condition 2: Entries where user is a current approver
        orConditions.push({
          'currentApprovers.approverId': userObjectId,
          status: 'pending'
        });

        console.log('Combined view: Own entries + Pending approvals');

      } else if (viewType === "pending-approvals" && currentUserId) {
        // Manager view - show only entries needing their approval
        filters['currentApprovers.approverId'] = userObjectId;
        filters.status = 'pending';
        console.log('Manager view: Pending approvals only');

      } else if (viewType === "all-entries" && currentUserId) {
        // Admin view - show all company entries
        console.log('Admin view: All company entries');

      } else if (currentUserId && !userId) {
        // Determine access based on user role
        const currentUser = await EmployeeModel.findById(currentUserId);
        if (currentUser) {
          const userRole = currentUser.employmentInformation?.role;
          if (['HR Admin', 'Super Admin', 'Manager'].includes(userRole)) {
            // Admin access - show all company entries
            console.log('Auto-detected admin access');
          } else {
            // Regular employee - show their own entries + approvals
            useOrQuery = true;
            orConditions.push({ userId: currentUserId });
            orConditions.push({
              'currentApprovers.approverId': userObjectId,
              status: 'pending'
            });
            console.log('Employee access: Own entries + Pending approvals');
          }
        }
      }
    }

    // Build final query - separate date range expr from other filters
    const hasDateRange = Boolean(req.query.from || req.query.to);

    // Ensure filters is always an object
    if (!filters || typeof filters !== 'object') {
      filters = { companyId: cleanCompanyId };
    }

    const dateRangeExpr = filters.$expr;

    // Remove $expr from filters to build other filters separately
    if (filters.$expr) {
      delete filters.$expr;
    }

    if (useOrQuery && orConditions.length > 0) {
      filters.$or = orConditions;
    }

    // Status filter
    if (status && status !== 'all' && !useOrQuery) {
      filters.status = status;
    }

    // Method filter
    if (method && method !== 'all') {
      filters.method = method.toLowerCase();
    }

    // Search functionality
    if (search) {
      const searchRegex = new RegExp(search, "i");
      const searchConditions = [
        { day: searchRegex },
        { dateString: searchRegex },
        { method: searchRegex },
        { 'employeeInfo.name': searchRegex },
        { 'employeeInfo.department': searchRegex },
        { reason: searchRegex }
      ];

      if (useOrQuery) {
        filters.$and = [
          { $or: orConditions },
          { $or: searchConditions }
        ];
        delete filters.$or;
      } else {
        filters.$or = searchConditions;
      }
    }

    // Combine date range filter with other filters using $and if needed
    if (hasDateRange && dateRangeExpr) {
      // Ensure filters is an object
      if (!filters || typeof filters !== 'object') {
        filters = { companyId: cleanCompanyId };
      }

      // If we have complex filters ($or, $and), we need to combine with $and
      if (filters.$or || filters.$and) {
        const combinedConditions = [];

        // Add existing $and conditions if any
        if (filters.$and && Array.isArray(filters.$and)) {
          combinedConditions.push(...filters.$and);
        }

        // Add $or condition if exists
        if (filters.$or) {
          combinedConditions.push({ $or: filters.$or });
        }

        // Add date range filter
        combinedConditions.push({ $expr: dateRangeExpr });

        // Add any remaining simple filters (excluding companyId and operators)
        const simpleFilters = {};
        if (filters && typeof filters === 'object') {
          Object.keys(filters).forEach(key => {
            if (key !== 'companyId' && key !== '$or' && key !== '$and' && key !== '$expr') {
              simpleFilters[key] = filters[key];
            }
          });
        }

        if (Object.keys(simpleFilters).length > 0) {
          combinedConditions.push(simpleFilters);
        }

        // Rebuild filters with $and
        filters = {
          companyId: filters.companyId || cleanCompanyId
        };
        if (combinedConditions.length > 0) {
          filters.$and = combinedConditions;
        }
      } else {
        // Simple case: just add date range filter back
        if (!filters) {
          filters = { companyId: cleanCompanyId };
        }
        filters.$expr = dateRangeExpr;
      }
    }

    // Ensure filters always has companyId
    if (!filters.companyId && cleanCompanyId) {
      filters.companyId = cleanCompanyId;
    }

    // Ensure filters is valid and not null/undefined
    if (!filters || typeof filters !== 'object') {
      filters = { companyId: cleanCompanyId };
    }

    // Ensure companyId is always present
    if (!filters.companyId && cleanCompanyId) {
      filters.companyId = cleanCompanyId;
    }

    console.log("Final filters:", JSON.stringify(filters, null, 2));

    const companyFilter = { companyId: filters.companyId || cleanCompanyId };

    let timeTrackings;
    if (hasDateRange) {
      // Use aggregation to sort by parsed date ascending for correct chronological order
      // Final safety check for filters
      if (!filters || typeof filters !== 'object' || Array.isArray(filters)) {
        filters = { companyId: cleanCompanyId };
      }
      const matchStage = { $match: filters };
      const addFieldsStage = {
        $addFields: {
          parsedDate: {
            $dateFromString: {
              dateString: "$dateString",
              format: {
                $switch: {
                  branches: [
                    { case: { $regexMatch: { input: "$dateString", regex: /^\d{1,2}-\d{1,2}-\d{4}$/ } }, then: "%d-%m-%Y" },
                    { case: { $regexMatch: { input: "$dateString", regex: /^\d{2} \w{3} \d{4}$/ } }, then: "%d %b %Y" },
                    { case: { $regexMatch: { input: "$dateString", regex: /^\d{1,2}\/\d{1,2}\/\d{4}$/ } }, then: "%m/%d/%Y" },
                    { case: { $regexMatch: { input: "$dateString", regex: /^\d{4}-\d{2}-\d{2}$/ } }, then: "%Y-%m-%d" }
                  ],
                  default: "%d %b %Y"
                }
              },
              onError: null
            }
          }
        }
      };
      const sortStage = { $sort: { parsedDate: 1, createdAt: 1 } };
      const pipeline = [matchStage, addFieldsStage, sortStage];

      // Only add skip and limit stages if they are valid numbers
      if (skip != null && !isNaN(skip) && skip >= 0) {
        pipeline.push({ $skip: skip });
      }
      if (limit != null && !isNaN(limit) && limit > 0) {
        pipeline.push({ $limit: limit });
      }

      timeTrackings = await TimeTrackingModel.aggregate(pipeline);
    } else {
      // Final safety check for filters
      if (!filters || typeof filters !== 'object' || Array.isArray(filters)) {
        filters = { companyId: cleanCompanyId };
      }
      let query = TimeTrackingModel.find(filters)
        .populate('finalApprover', 'personalInformation')
        .populate('rejectedBy', 'personalInformation')
        .sort({ createdAt: -1 });

      // Only add skip and limit if they are valid numbers
      if (skip != null && !isNaN(skip) && skip >= 0) {
        query = query.skip(skip);
      }
      if (limit != null && !isNaN(limit) && limit > 0) {
        query = query.limit(limit);
      }

      timeTrackings = await query;
    }

    // Enrich with employeeNumber for each entry (returned under employeeInfo)
    let userIdToEmployeeMeta = new Map();
    try {
      const userIds = Array.from(
        new Set(
          (timeTrackings || [])
            .map(e => (e.userId && e.userId.toString ? e.userId.toString() : String(e.userId || '')))
            .filter(Boolean)
        )
      );
      if (userIds.length > 0) {
        const employees = await EmployeeModel.find({ _id: { $in: userIds } })
          .select('_id employmentInformation.employeeNumber employmentInformation.location')
          .lean();
        userIdToEmployeeMeta = new Map(
          employees.map(emp => [
            emp._id.toString(),
            {
              employeeNumber: emp.employmentInformation?.employeeNumber || null,
              location: emp.employmentInformation?.location || null
            }
          ])
        );
      }
    } catch (_) {
      // best-effort enrichment; ignore failures
    }

    // Calculate total hours and minutes for filtered entries
    let totalMinutes = 0;
    for (const entry of timeTrackings) {
      if (entry.hours) {
        // Parse hours like '7hr 13m' or '7h 13m'
        const match = entry.hours.match(/(\d+)\s*h?r?\s*(\d+)?\s*m?/i);
        if (match) {
          const hrs = parseInt(match[1] || '0', 10);
          const mins = parseInt(match[2] || '0', 10);
          totalMinutes += (hrs * 60) + mins;
        }
      }
    }
    const totalHours = Math.floor(totalMinutes / 60);
    const totalMins = totalMinutes % 60;

    console.log(`Found ${timeTrackings.length} time tracking entries for filters`);

    // Final safety check before countDocuments
    const countFilters = (filters && typeof filters === 'object' && !Array.isArray(filters))
      ? filters
      : { companyId: cleanCompanyId };
    const total = await TimeTrackingModel.countDocuments(countFilters);
    const totalPages = (limit != null && !isNaN(limit) && limit > 0) ? Math.ceil(total / limit) : 1;

    // Get current user info for role-based data
    let currentUser = null;
    if (currentUserId) {
      currentUser = await EmployeeModel.findById(currentUserId);
    }

    // Enhance data with role-based information
    const enhancedEntries = timeTrackings.map(entry => {
      const entryObj = (typeof entry.toObject === 'function') ? entry.toObject() : entry;

      // Add status display with color coding
      entryObj.statusDisplay = entry.statusDisplay;
      entryObj.currentLevelDisplay = entry.currentLevelDisplay;

      // Add user-specific information
      if (currentUserId) {
        let userRole = 'viewer';
        let canApprove = false;

        if (entry.userId === currentUserId) {
          userRole = 'owner';
        } else if (entry.currentApprovers?.some(app => app.approverId.toString() === currentUserId)) {
          userRole = 'current_approver';
          canApprove = true;
        } else if (entry.approvalHistory?.some(history => history.approverId.toString() === currentUserId)) {
          userRole = 'past_approver';
        } else if (currentUser && ['HR Admin', 'Super Admin', 'Manager'].includes(currentUser.employmentInformation?.role)) {
          userRole = 'admin';
        }

        entryObj.userRole = userRole;
        entryObj.canApprove = canApprove;

        // Add current approval info if user is current approver
        if (userRole === 'current_approver') {
          // Handle both Map (from Mongoose) and plain object (from aggregation)
          let currentLevelData;
          if (entry.approverLevels) {
            if (typeof entry.approverLevels.get === 'function') {
              // It's a Map
              currentLevelData = entry.approverLevels.get(entry.currentLevel);
            } else {
              // It's a plain object
              currentLevelData = entry.approverLevels[entry.currentLevel];
            }
          }
          const userApprovalData = currentLevelData?.approvers?.find(
            app => app.approverId.toString() === currentUserId
          );
          entryObj.yourApprovalStatus = userApprovalData?.status || 'pending';
        }
      }

      // Enrich employeeInfo with employeeNumber if available
      try {
        const uid = entry.userId && entry.userId.toString ? entry.userId.toString() : String(entry.userId || '');
        const meta = userIdToEmployeeMeta.get(uid) || {};
        entryObj.employeeInfo = entryObj.employeeInfo || {};
        if (!entryObj.employeeInfo.employeeNumber) {
          entryObj.employeeInfo.employeeNumber = meta.employeeNumber || null;
        }
        if (!entryObj.employeeInfo.location) {
          entryObj.employeeInfo.location = meta.location || null;
        }
      } catch (_) {
        // ignore enrichment failures
      }

      // Convert Map to Object for JSON serialization
      if (entryObj.approverLevels && typeof entryObj.approverLevels.get === 'function') {
        entryObj.approverLevels = Object.fromEntries(entryObj.approverLevels);
      }

      return entryObj;
    });

    // Add summary statistics based on scoped filters
    // Final safety check for filters
    const statsFilters = (filters && typeof filters === 'object' && !Array.isArray(filters))
      ? filters
      : { companyId: cleanCompanyId };
    const statusCounts = await TimeTrackingModel.aggregate([
      { $match: statsFilters },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    const summary = {
      total: total,
      pending: statusCounts.find(s => s._id === 'pending')?.count || 0,
      approved: statusCounts.find(s => s._id === 'approved')?.count || 0,
      rejected: statusCounts.find(s => s._id === 'rejected')?.count || 0
    };

    // Add pending approvals count for current user scoped by type
    if (currentUserId) {
      let scopeApproverIds = [];
      if (normalizedType === 'me') {
        scopeApproverIds = [currentUserId];
      } else if (normalizedType === 'myteam') {
        const teamMembersScope = await EmployeeModel.find({
          companyId: cleanCompanyId,
          'employmentInformation.status': 'Active',
          'employmentInformation.lineManager': currentUserId
        }).select('_id');
        scopeApproverIds = teamMembersScope.map(e => e._id.toString());
        scopeApproverIds.push(currentUserId);
      } else if (normalizedType === 'mycompany') {
        const companyEmployeesScope = await EmployeeModel.find({
          companyId: cleanCompanyId,
          'employmentInformation.status': 'Active'
        }).select('_id');
        scopeApproverIds = companyEmployeesScope.map(e => e._id.toString());
      } else {
        scopeApproverIds = [currentUserId];
      }

      const pendingApprovals = await TimeTrackingModel.countDocuments({
        companyId: cleanCompanyId,
        status: 'pending',
        'currentApprovers.approverId': { $in: scopeApproverIds }
      });
      summary.pendingApprovals = pendingApprovals;
    }

    const result = {
      totalRecords: total,
      page,
      limit,
      totalPages: totalPages,
      data: enhancedEntries,
      summary: summary,
      totalHours: totalHours,
      totalMinutes: totalMins
    };

    return successResponse(
      res,
      result,
      "Time tracking entries fetched successfully with pagination and role-based data"
    );
  } catch (error) {
    return errorResponse(res, error);
  }
};

const getTimeTrackingById = async (req, res) => {
  try {
    const { id, currentUserId } = req.query;
    if (!id) return errorResponse(res, "Time tracking ID is required");
    if (!currentUserId) return errorResponse(res, "Current User ID is required");

    const timeEntry = await TimeTrackingModel.findById(id)
      .populate('workflowId')
      .populate('finalApprover', 'personalInformation contactInformation')
      .populate('rejectedBy', 'personalInformation contactInformation');

    if (!timeEntry) return errorResponse(res, "Time tracking entry not found", 404);

    // Get current user details to determine role
    const currentUser = await EmployeeModel.findById(currentUserId);
    if (!currentUser) return errorResponse(res, "Current user not found", 404);

    // Determine user role in relation to this time entry
    let userRole = 'employee';
    let canApprove = false;
    let canView = false;
    let canEdit = false;

    // Check if user is the entry owner
    if (timeEntry.userId === currentUserId) {
      userRole = 'owner';
      canView = true;
      canEdit = timeEntry.status === 'pending';
    }

    // Check if user is a current approver
    const isCurrentApprover = timeEntry.currentApprovers?.some(
      approver => approver.approverId.toString() === currentUserId
    );

    if (isCurrentApprover) {
      userRole = 'approver';
      canApprove = true;
      canView = true;
    }

    // Check if user has approved this entry before
    const hasApproved = timeEntry.approvalHistory?.some(
      history => history.approverId.toString() === currentUserId
    );

    if (hasApproved) {
      userRole = 'past_approver';
      canView = true;
    }

    // Check if user is HR/Manager
    const userEmploymentRole = currentUser.employmentInformation?.role;
    if (['HR Admin', 'Super Admin', 'Manager'].includes(userEmploymentRole)) {
      userRole = 'admin';
      canView = true;
    }

    // If user cannot view this entry
    if (!canView) {
      return errorResponse(res, "You don't have permission to view this time entry", 403);
    }

    // Prepare response data
    let responseData = {
      ...timeEntry.toObject(),
      statusDisplay: timeEntry.statusDisplay,
      currentLevelDisplay: timeEntry.currentLevelDisplay,
      userRole: userRole,
      permissions: {
        canApprove: canApprove,
        canView: canView,
        canEdit: canEdit
      }
    };

    // Add role-specific data
    if (userRole === 'approver') {
      const currentLevelData = timeEntry.approverLevels?.get(timeEntry.currentLevel);
      const userApprovalData = currentLevelData?.approvers?.find(
        app => app.approverId.toString() === currentUserId
      );

      responseData.approverInfo = {
        level: timeEntry.currentLevel,
        levelName: `Level ${parseInt(timeEntry.currentLevel) + 1}`,
        yourStatus: userApprovalData?.status || 'pending',
        otherApproversInLevel: currentLevelData?.approvers?.filter(
          app => app.approverId.toString() !== currentUserId
        ).map(app => ({
          name: app.approverName,
          type: app.approverType,
          status: app.status
        })) || []
      };
    }

    // Convert Map to Object for JSON serialization
    if (responseData.approverLevels) {
      responseData.approverLevels = Object.fromEntries(responseData.approverLevels);
    }

    return successResponse(res, responseData, "Time tracking entry fetched successfully");
  } catch (error) {
    return errorResponse(res, error);
  }
};

const updateTimeTracking = async (req, res) => {
  try {
    const { companyId, userId, timeEntryId } = req.query;
    const updateData = req.body;

    if (!companyId) {
      return errorResponse(res, "Company ID is required", 400);
    }
    if (!userId) {
      return errorResponse(res, "User ID is required", 400);
    }
    if (!timeEntryId) {
      return errorResponse(res, "Time tracking ID is required", 400);
    }

    // Get existing time entry to access clock-in coordinates
    const existingEntry = await TimeTrackingModel.findById(timeEntryId);
    if (!existingEntry) {
      return errorResponse(res, "Time tracking record not found", 404);
    }

    // Calculate distance traveled if clock-out coordinates are being provided
    if (updateData.longitude && updateData.latitude && existingEntry.distanceTraveled && existingEntry.distanceTraveled.clockInCoordinates) {
      // Calculate distance between clock-in and clock-out coordinates
      const calculatedDistance = calculateDistance(
        existingEntry.distanceTraveled.clockInCoordinates.latitude,
        existingEntry.distanceTraveled.clockInCoordinates.longitude,
        updateData.latitude,
        updateData.longitude
      );

      // Update distanceTraveled object
      updateData.distanceTraveled = {
        clockInCoordinates: {
          longitude: existingEntry.distanceTraveled.clockInCoordinates.longitude,
          latitude: existingEntry.distanceTraveled.clockInCoordinates.latitude
        },
        clockOutCoordinates: {
          longitude: updateData.longitude,
          latitude: updateData.latitude
        },
        distanceInKm: calculatedDistance,
        calculatedAt: new Date()
      };
    }

    // Round hours to 2 decimals if present
    if (updateData.hours != null) {
      updateData.hours = roundHours(updateData.hours) ?? updateData.hours;
    }

    // Check for time overlap if timeIn and timeOut are being updated
    if (updateData.timeIn && updateData.timeOut && updateData.dateString) {
      const overlapCheck = await checkTimeOverlap(userId, updateData.dateString, updateData.timeIn, updateData.timeOut, timeEntryId);
      if (overlapCheck.hasOverlap) {
        return errorResponse(res,
          `Time overlap detected for ${updateData.dateString}. Employee is already logged in from ${overlapCheck.conflictingEntry.existingTimeIn} to ${overlapCheck.conflictingEntry.existingTimeOut}. Updated entry time: ${overlapCheck.conflictingEntry.newTimeIn} to ${overlapCheck.conflictingEntry.newTimeOut}`,
          400
        );
      }
    }

    const updatedTimeTracking = await TimeTrackingModel.findOneAndUpdate(
      { _id: timeEntryId, companyId, userId },
      updateData,
      { new: true, runValidators: true }
    );

    if (!updatedTimeTracking) {
      return errorResponse(res, "Time tracking record not found", 404);
    }

    return successResponse(
      res,
      updatedTimeTracking,
      "Time tracking record updated successfully"
    );
  } catch (error) {
    return errorResponse(res, error);
  }
};

const approveTimeTracking = async (req, res) => {
  try {
    const { id } = req.query;
    const { approverId, action, comments, rejectionReason } = req.body;

    if (!id) return errorResponse(res, "Time tracking ID is required");
    if (!approverId) return errorResponse(res, "Approver ID is required");
    if (!action || !['approved', 'rejected'].includes(action)) {
      return errorResponse(res, "Valid action (approved/rejected) is required");
    }

    // Find the time entry
    const timeEntry = await TimeTrackingModel.findById(id);
    if (!timeEntry) return errorResponse(res, "Time tracking entry not found", 404);

    // Check if entry is still pending
    if (timeEntry.status !== 'pending') {
      return errorResponse(res, `Time entry is already ${timeEntry.status}`, 400);
    }

    // Find approver details
    const approver = await EmployeeModel.findById(approverId);
    if (!approver) return errorResponse(res, "Approver not found", 404);

    const approverName = `${approver.personalInformation?.firstName} ${approver.personalInformation?.lastName}`;

    // Check if this approver is authorized for current level
    const currentLevelData = timeEntry.approverLevels.get(timeEntry.currentLevel);
    if (!currentLevelData) {
      return errorResponse(res, "Invalid approval level", 400);
    }

    const approverIndex = currentLevelData.approvers.findIndex(
      app => app.approverId.toString() === approverId.toString()
    );

    if (approverIndex === -1) {
      return errorResponse(res, "You are not authorized to approve this time entry at current level", 403);
    }

    // Check if already approved/rejected by this approver
    if (currentLevelData.approvers[approverIndex].status !== 'pending') {
      return errorResponse(res, `You have already ${currentLevelData.approvers[approverIndex].status} this time entry`, 400);
    }

    // Update approver status
    currentLevelData.approvers[approverIndex].status = action;
    currentLevelData.approvers[approverIndex].approvedAt = new Date();
    currentLevelData.approvers[approverIndex].comments = comments;
    currentLevelData.approvers[approverIndex].rejectionReason = rejectionReason;

    // Add to approval history
    timeEntry.approvalHistory.push({
      approverId: approverId,
      approverName: approverName,
      approverType: currentLevelData.approvers[approverIndex].approverType,
      level: timeEntry.currentLevel,
      action: action,
      comments: comments,
      rejectionReason: rejectionReason,
      timestamp: new Date()
    });

    if (action === 'rejected') {
      // If rejected, mark entire entry as rejected
      timeEntry.status = 'rejected';
      timeEntry.rejectionReason = rejectionReason;
      timeEntry.rejectedBy = approverId;
      timeEntry.rejectedAt = new Date();

      // Mark current level as rejected
      currentLevelData.status = 'rejected';

      await timeEntry.save();

      // Send rejection notification to employee
      if (timeEntry.employeeInfo.email) {
        try {
          await sendEmail(
            timeEntry.employeeInfo.email,
            `Time Entry Rejected`,
            {
              name: timeEntry.employeeInfo.name,
              timeEntryRejected: true,
              timeEntryDetails: {
                date: timeEntry.dateString,
                timeIn: timeEntry.timeIn,
                timeOut: timeEntry.timeOut || 'Not specified',
                rejectedBy: approverName,
                rejectionReason: rejectionReason || 'No reason provided'
              }
            },
            true
          );
        } catch (emailError) {
          console.error('Failed to send rejection email:', emailError);
        }
      }

      return successResponse(res, {
        data: timeEntry,
        message: "Time entry rejected successfully"
      });
    }

    // Check if all approvers in current level have approved
    const allApproved = currentLevelData.approvers.every(app => app.status === 'approved');

    if (allApproved) {
      // Mark current level as approved
      currentLevelData.status = 'approved';

      // Try to move to next level
      const hasNextLevel = await moveToNextLevel(timeEntry, timeEntry.currentLevel);

      if (!hasNextLevel) {
        // Final approval - no more levels
        timeEntry.status = 'approved';
        timeEntry.finalApprovalDate = new Date();
        timeEntry.finalApprover = approverId;
        timeEntry.currentApprovers = [];

        await timeEntry.save();

        // Send final approval notification to employee
        if (timeEntry.employeeInfo.email) {
          try {
            await sendEmail(
              timeEntry.employeeInfo.email,
              `Time Entry Approved`,
              {
                name: timeEntry.employeeInfo.name,
                timeEntryApproved: true,
                timeEntryDetails: {
                  date: timeEntry.dateString,
                  timeIn: timeEntry.timeIn,
                  timeOut: timeEntry.timeOut || 'Not specified',
                  finalApprovedBy: approverName
                }
              },
              true
            );
          } catch (emailError) {
            console.error('Failed to send approval email:', emailError);
          }
        }

        return successResponse(res, {
          data: timeEntry,
          message: "Time entry approved successfully - Final approval"
        });
      } else {
        await timeEntry.save();
        return successResponse(res, {
          data: timeEntry,
          message: `Level ${parseInt(timeEntry.currentLevel)} approved. Forwarded to next level.`
        });
      }
    } else {
      await timeEntry.save();
      return successResponse(res, {
        data: timeEntry,
        message: "Your approval recorded. Waiting for other approvers in this level."
      });
    }

  } catch (error) {
    return errorResponse(res, error);
  }
};

const getPendingApprovals = async (req, res) => {
  try {
    const { currentUserId, companyId } = req.query;
    const normalizedType = (req.query.type || 'me').toString().trim().toLowerCase();
    const cleanCompanyId = (companyId || '').toString().replace(/^"|"$/g, '').trim();

    if (!currentUserId) return errorResponse(res, "Current User ID is required");
    if (!cleanCompanyId) return errorResponse(res, "Company ID is required");

    // Scope approver IDs based on type
    let scopeApproverIds = [];
    if (normalizedType === 'me') {
      scopeApproverIds = [currentUserId];
    } else if (normalizedType === 'myteam') {
      const teamMembersScope = await EmployeeModel.find({
        companyId: cleanCompanyId,
        'employmentInformation.status': 'Active',
        'employmentInformation.lineManager': currentUserId
      }).select('_id');
      scopeApproverIds = teamMembersScope.map(e => e._id.toString());
      scopeApproverIds.push(currentUserId);
    } else if (normalizedType === 'mycompany') {
      const companyEmployeesScope = await EmployeeModel.find({
        companyId: cleanCompanyId,
        'employmentInformation.status': 'Active'
      }).select('_id');
      scopeApproverIds = companyEmployeesScope.map(e => e._id.toString());
    } else {
      scopeApproverIds = [currentUserId];
    }

    // Find all time entries where scoped users are pending approvers
    const pendingEntries = await TimeTrackingModel.find({
      companyId: cleanCompanyId,
      status: 'pending',
      'currentApprovers.approverId': { $in: scopeApproverIds }
    })
      .populate('workflowId')
      .sort({ createdAt: -1 });

    // Enhance data with approval-specific information
    const enhancedPendingEntries = pendingEntries.map(entry => {
      const entryObj = entry.toObject();

      // Add status display
      entryObj.statusDisplay = entry.statusDisplay;
      entryObj.currentLevelDisplay = entry.currentLevelDisplay;

      // Find current user's approval data
      const currentLevelData = entry.approverLevels?.get(entry.currentLevel);
      const userApprovalData = currentLevelData?.approvers?.find(
        app => app.approverId.toString() === currentUserId
      );

      entryObj.approverInfo = {
        level: entry.currentLevel,
        levelName: `Level ${parseInt(entry.currentLevel) + 1}`,
        yourStatus: userApprovalData?.status || 'pending',
        approverType: userApprovalData?.approverType,
        otherApproversInLevel: currentLevelData?.approvers?.filter(
          app => app.approverId.toString() !== currentUserId
        ).map(app => ({
          name: app.approverName,
          type: app.approverType,
          status: app.status
        })) || []
      };

      // Convert Map to Object
      if (entryObj.approverLevels) {
        entryObj.approverLevels = Object.fromEntries(entryObj.approverLevels);
      }

      return entryObj;
    });

    const result = {
      total: enhancedPendingEntries.length,
      data: enhancedPendingEntries
    };

    return successResponse(res, result, "Pending time entry approvals fetched successfully");
  } catch (error) {
    return errorResponse(res, error);
  }
};

const getApprovalDashboard = async (req, res) => {
  try {
    const { currentUserId, companyId } = req.query;
    const normalizedType = (req.query.type || 'me').toString().trim().toLowerCase();
    const cleanCompanyId = (companyId || '').toString().replace(/^"|"$/g, '').trim();

    if (!currentUserId) return errorResponse(res, "Current User ID is required");
    if (!cleanCompanyId) return errorResponse(res, "Company ID is required");

    // Get current user details
    const currentUser = await EmployeeModel.findById(currentUserId);
    if (!currentUser) return errorResponse(res, "User not found", 404);

    const userRole = currentUser.employmentInformation?.role;
    const isAdmin = ['HR Admin', 'Super Admin', 'Manager'].includes(userRole);

    // Scope approver IDs based on type
    let scopeApproverIds = [];
    if (normalizedType === 'me') {
      scopeApproverIds = [currentUserId];
    } else if (normalizedType === 'myteam') {
      const teamMembersScope = await EmployeeModel.find({
        companyId: cleanCompanyId,
        'employmentInformation.status': 'Active',
        'employmentInformation.lineManager': currentUserId
      }).select('_id');
      scopeApproverIds = teamMembersScope.map(e => e._id.toString());
      scopeApproverIds.push(currentUserId);
    } else if (normalizedType === 'mycompany') {
      const companyEmployeesScope = await EmployeeModel.find({
        companyId: cleanCompanyId,
        'employmentInformation.status': 'Active'
      }).select('_id');
      scopeApproverIds = companyEmployeesScope.map(e => e._id.toString());
    } else {
      scopeApproverIds = [currentUserId];
    }

    // Pending approvals for scoped users
    const pendingApprovals = await TimeTrackingModel.countDocuments({
      companyId: cleanCompanyId,
      status: 'pending',
      'currentApprovers.approverId': { $in: scopeApproverIds }
    });

    // Entries approved by scoped users
    const approvedByUser = await TimeTrackingModel.countDocuments({
      companyId: cleanCompanyId,
      'approvalHistory.approverId': { $in: scopeApproverIds },
      'approvalHistory.action': 'approved'
    });

    // Entries rejected by scoped users
    const rejectedByUser = await TimeTrackingModel.countDocuments({
      companyId: cleanCompanyId,
      'approvalHistory.approverId': { $in: scopeApproverIds },
      'approvalHistory.action': 'rejected'
    });

    let dashboardData = {
      userInfo: {
        name: `${currentUser.personalInformation?.firstName} ${currentUser.personalInformation?.lastName}`,
        role: userRole,
        department: currentUser.employmentInformation?.department,
        isAdmin: isAdmin
      },
      approvals: {
        pending: pendingApprovals,
        approved: approvedByUser,
        rejected: rejectedByUser,
        total: approvedByUser + rejectedByUser
      }
    };

    // Add company-wide statistics for admins or based on scope
    if (isAdmin || normalizedType === 'mycompany') {
      const companyStats = await TimeTrackingModel.aggregate([
        { $match: { companyId: cleanCompanyId } },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]);

      dashboardData.companyStats = {
        total: companyStats.reduce((sum, stat) => sum + stat.count, 0),
        pending: companyStats.find(s => s._id === 'pending')?.count || 0,
        approved: companyStats.find(s => s._id === 'approved')?.count || 0,
        rejected: companyStats.find(s => s._id === 'rejected')?.count || 0
      };
    }

    return successResponse(res, dashboardData, "Time tracking approval dashboard data fetched successfully");
  } catch (error) {
    return errorResponse(res, error);
  }
};

const deleteTimeTracking = async (req, res) => {
  try {
    const { id, currentUserId, companyId } = req.query;
    const normalizedType = (req.query.type || 'me').toString().trim().toLowerCase();
    const cleanCompanyId = (companyId || '').toString().replace(/^"|"$/g, '').trim();

    if (!id) return errorResponse(res, "Time tracking ID is required", 400);
    if (!currentUserId) return errorResponse(res, "Current User ID is required", 400);
    if (!cleanCompanyId) return errorResponse(res, "Company ID is required", 400);

    // Find the time entry
    const timeEntry = await TimeTrackingModel.findById(id);
    if (!timeEntry) return errorResponse(res, "Time tracking entry not found", 404);

    // Verify company ID matches
    if (timeEntry.companyId !== cleanCompanyId) {
      return errorResponse(res, "Time entry does not belong to this company", 403);
    }

    // Get current user details
    const currentUser = await EmployeeModel.findById(currentUserId);
    if (!currentUser) return errorResponse(res, "Current user not found", 404);

    const userRole = currentUser.employmentInformation?.role;
    const isAdmin = ['HR Admin', 'Super Admin'].includes(userRole);
    const isManager = userRole === 'Manager';

    let canDelete = false;
    let deleteReason = '';

    // Check deletion permissions based on type and role
    if (normalizedType === 'mycompany') {
      // For mycompany view, only admins and managers can delete
      if (isAdmin || isManager) {
        canDelete = true;
        deleteReason = `Deleted by ${userRole} in company view`;
      }
    } else if (normalizedType === 'myteam') {
      // For myteam view, check if the user is the line manager or admin/manager
      if (isAdmin || isManager) {
        canDelete = true;
        deleteReason = `Deleted by ${userRole} in team view`;
      } else {
        // Check if current user is the line manager of the employee who created the entry
        const entryEmployee = await EmployeeModel.findById(timeEntry.userId);
        if (entryEmployee &&
          entryEmployee.employmentInformation?.lineManager &&
          entryEmployee.employmentInformation.lineManager.toString() === currentUserId) {
          canDelete = true;
          deleteReason = 'Deleted by line manager';
        }
      }
    } else if (normalizedType === 'me') {
      // For 'me' view, allow if it's the user's own entry or if they're admin/manager
      if (timeEntry.userId === currentUserId) {
        canDelete = true;
        deleteReason = 'Deleted by owner';
      } else if (isAdmin || isManager) {
        canDelete = true;
        deleteReason = `Deleted by ${userRole}`;
      }
    } else {
      // Fallback: Allow admins and managers
      if (isAdmin || isManager) {
        canDelete = true;
        deleteReason = `Deleted by ${userRole}`;
      }
    }

    if (!canDelete) {
      return errorResponse(res, "You don't have permission to delete this time tracking entry", 403);
    }

    // Delete the time tracking entry
    await TimeTrackingModel.findByIdAndDelete(id);

    console.log(`Time tracking entry ${id} deleted by user ${currentUserId}. Reason: ${deleteReason}`);

    return successResponse(
      res,
      {
        deletedId: id,
        deletedBy: currentUserId,
        reason: deleteReason
      },
      "Time tracking entry deleted successfully"
    );
  } catch (error) {
    return errorResponse(res, error);
  }
};

module.exports = {
  createTimeTracking,
  getAllTimeTrackings,
  getTimeTrackingById,
  updateTimeTracking,
  deleteTimeTracking,
  approveTimeTracking,
  getPendingApprovals,
  getApprovalDashboard,
  bulkUploadTimeTracking,
  uploadTimeTrackingFile,
  listTimeTrackingBatches,
  getTimeTrackingBatch,
  getTimeTrackingBatchRecords,
  rollbackTimeTrackingBatch,
  deleteTimeTrackingBatch
};