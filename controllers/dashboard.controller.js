const moment = require("moment");
const Employee = require("../models/employee.model");
const Department = require("../models/department.model");
const Designation = require("../models/designation.model");
const Objectives = require("../models/objectives.model");
const KeyResults = require("../models/keyResults.model");
const Tasks2 = require("../models/tasks2.model");
const RewardPoints = require("../models/rewardpoints.model");
const TimeTracking = require("../models/timeTrackingModel/TimeTrackingModel");
const Leaves = require("../models/recruitment/Leaves/Leaves.model");
const HolidaysCalendar = require("../models/holidaysCalendar/holidaysCalendar");
const ReviewForm = require("../models/reviewForm.model");
const { percentageCalculation, totalSum } = require("../helpers/percentageCalculation");

const successResponse = ({ message, data }) => ({
  success: true,
  data: data ? data : null,
  message,
});

const failResponse = ({ message, data }) => ({
  success: false,
  data: data ? data : null,
  message,
});

const getDashboardData = async (req, res) => {
  try {
    const { companyId, type = "me", userId } = req.query;
    const normalizedType = (type || "me").toString().trim().toLowerCase();
    if (!companyId) {
      return res.status(400).send(failResponse({ message: "companyId is required" }));
    }
    if (["me", "myteam", "myfunction"].includes(normalizedType) && !userId) {
      return res.status(400).send(failResponse({ message: "userId is required for this type" }));
    }

    const now = new Date();
    const todayStr = `${now.getMonth() + 1}/${now.getDate()}/${now.getFullYear()}`;

    // Resolve subject userIds based on type - using same logic as tasks2 controller
    let subjectUserIds = [];
    if (normalizedType === "me") {
      subjectUserIds = [userId];
    } else if (normalizedType === "myteam") {
      // Find all employees who have this user as their line manager
      const teamMembers = await Employee.find({
        companyId,
        status: "Active",
        "employmentInformation.lineManager": userId
      }).select("_id");
      subjectUserIds = teamMembers.map(e => e._id.toString());

      // Also include the manager themselves
      subjectUserIds.push(userId);
    } else if (normalizedType === "myfunction") {
      // Find the current user's department and legal entity mappings
      const currentUser = await Employee.findById(userId).select("employmentInformation.department employmentInformation.legalEntityMappings");

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
        // Find all employees who are in ANY of these functions (either as primary department or in mappings)
        const functionMembers = await Employee.find({
          companyId,
          status: "Active",
          $or: [
            { "employmentInformation.department": { $in: userFunctions } },
            { "employmentInformation.legalEntityMappings.function": { $in: userFunctions } }
          ]
        }).select("_id");
        subjectUserIds = functionMembers.map(e => e._id.toString());
      } else {
        subjectUserIds = [userId];
      }
    } else if (normalizedType === "mycompany") {
      const employees = await Employee.find({ companyId, status: "Active" }).select("_id");
      subjectUserIds = employees.map(e => e._id.toString());
    } else {
      return res.status(400).send(failResponse({ message: "Invalid type. Use me, myteam, myfunction, or mycompany" }));
    }

    // Helper to build assignment filter for Tasks2 - using same logic as tasks2 controller
    const buildTaskAssignFilter = (ids) => ({
      companyId,
      assignTo: { $in: ids },
      userId: { $exists: true },
    });

    // Parse time strings like '09:30' or '9:30:00' to minutes since midnight
    const timeToMinutes = (t) => {
      if (!t) return null;
      if (typeof t === "number") return Math.round(t * 60);
      if (typeof t === "string") {
        if (t.includes(":")) {
          const [h, m = "0", s = "0"] = t.split(":");
          return parseInt(h) * 60 + parseInt(m) + Math.floor(parseInt(s) / 60);
        }
        const n = parseFloat(t);
        if (!isNaN(n)) return Math.round(n * 60);
      }
      return null;
    };

    // Core aggregates in parallel (without OKRs - will be handled separately)
    // Holiday "today" boundary (timezone-safe-ish for server local time)
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    const [
      // Employee stats
      totalEmployees,
      activeEmployees,
      inactiveEmployees,
      totalDepartments,
      totalDesignations,
      // Tasks
      activeTasksCount,
      urgentActiveTasksCount,
      kpiTasksCount,
      adHocTasksCount,
      recentTasks,
      // Attendance (company-wide, same for all types)
      activeEmpList,
      todayTimeEntries,
      todayLeaves,
      // Reward points for leaderboard/company
      rewardPointsCompanyAgg,
      employeesAllForLeaderboard,
      ongoingHoliday,
      upcomingHoliday
    ] = await Promise.all([
      Employee.countDocuments({ companyId, status: "Active" }),
      Employee.countDocuments({ companyId, status: "Active" }),
      Employee.countDocuments({ companyId, status: "Inactive" }),
      Department.countDocuments({ companyId }),
      Designation.countDocuments({ companyId }),

      Tasks2.countDocuments({ ...buildTaskAssignFilter(subjectUserIds), status: { $ne: "completed" }, mainTask: { $in: ["", null] } }),
      Tasks2.countDocuments({ ...buildTaskAssignFilter(subjectUserIds), status: { $ne: "completed" }, priority: "High Level", mainTask: { $in: ["", null] } }),
      // KPI Tasks: tasks that have a valid, non-empty krReferenceId (linked to Key Results)
      Tasks2.countDocuments({
        ...buildTaskAssignFilter(subjectUserIds),
        status: { $ne: "completed" },
        krReferenceId: { $type: "string", $regex: /\S/ },
        mainTask: { $in: ["", null] }
      }),
      // Ad-hoc Tasks: tasks that don't have a valid krReferenceId (missing, null, empty, or whitespace)
      Tasks2.countDocuments({
        ...buildTaskAssignFilter(subjectUserIds),
        status: { $ne: "completed" },
        $or: [
          { krReferenceId: { $exists: false } },
          { krReferenceId: null },
          { krReferenceId: "" },
          { krReferenceId: { $type: "string", $regex: /^\s*$/ } }
        ],
        mainTask: { $in: ["", null] }
      }),
      Tasks2.find({ ...buildTaskAssignFilter(subjectUserIds), mainTask: { $in: ["", null] } }).sort({ createdAt: -1 }).limit(5).lean(),

      // Use same "Active" definition as Employee list: employmentInformation.status only
      Employee.find({
        companyId,
        "employmentInformation.status": "Active",
      }).select("_id personalInformation.firstName personalInformation.lastName contactInformation.email employmentInformation.department employmentInformation.employeeNumber").lean(),
      TimeTracking.find({ companyId, dateString: todayStr }).select("userId dateString timeIn timeOut status").lean(),
      Leaves.find({ companyId, status: "approved", from: { $lte: now }, to: { $gte: now } }).select("empId").lean(),

      RewardPoints.aggregate([
        { $match: { isApproved: "approved" } },
        { $group: { _id: "$employeeReferenceId", totalPoints: { $sum: "$rewardPoints" } } },
        { $sort: { totalPoints: -1 } },
        { $limit: 50 }
      ]),
      Employee.find({
        companyId,
        status: { $ne: "Inactive" }, // top-level status should not be Inactive
        "employmentInformation.status": { $ne: "Inactive" }, // employment status should not be Inactive
        $or: [
          { "employmentInformation.inactiveDate": { $exists: false } },
          { "employmentInformation.inactiveDate": null },
          { "employmentInformation.inactiveDate": { $gt: now } } // exclude users whose inactiveDate has passed
        ]
      }).select("_id personalInformation.firstName personalInformation.lastName personalInformation.image personalInformation.profilePicture personalInformation.dateOfBirth personalInformation.gender contactInformation.email employmentInformation.department employmentInformation.employeeNumber employmentInformation.hireDate").lean(),
      // If today falls within a holiday range, prefer returning that; otherwise return the next upcoming holiday.
      HolidaysCalendar.findOne({
        companyId,
        fromDate: { $lte: startOfToday },
        toDate: { $gte: startOfToday }
      }).sort({ fromDate: 1 }).lean(),
      HolidaysCalendar.findOne({
        companyId,
        fromDate: { $gte: startOfToday }
      }).sort({ fromDate: 1 }).lean()
    ]);

    const nextHoliday = ongoingHoliday || upcomingHoliday || null;

    // Additional debugging: Get total tasks count for comparison
    const totalTasksInScope = await Tasks2.countDocuments({ ...buildTaskAssignFilter(subjectUserIds), mainTask: { $in: ["", null] } });
    const totalTasksInCompany = await Tasks2.countDocuments({ companyId, mainTask: { $in: ["", null] } });

    // OKRs scoped by type (handled separately to avoid nested queries)
    let objectivesInScope, krsInScope;
    if (normalizedType === "me") {
      objectivesInScope = await Objectives.find({
        $or: [
          { employeeReferenceId: userId },
          { owner: userId }
        ]
      }).select("owner ownerName employeeName employeeNumber employeeReferenceId progressStatus objective createdAt objectiveID weight dueDate").lean();
      const objectiveIds = objectivesInScope.map(o => o._id.toString());
      krsInScope = objectiveIds.length > 0 ? await KeyResults.find({ objectiveId: { $in: objectiveIds } }).select("objectiveId target actual polarity").lean() : [];
    } else if (normalizedType === "myteam") {
      objectivesInScope = await Objectives.find({ companyId, employeeReferenceId: { $in: subjectUserIds } }).select("owner ownerName employeeName employeeNumber employeeReferenceId progressStatus objective createdAt objectiveID weight dueDate").lean();
      const objectiveIds = objectivesInScope.map(o => o._id.toString());
      krsInScope = objectiveIds.length > 0 ? await KeyResults.find({ objectiveId: { $in: objectiveIds } }).select("objectiveId target actual polarity").lean() : [];
    } else if (normalizedType === "myfunction") {
      objectivesInScope = await Objectives.find({ companyId, employeeReferenceId: { $in: subjectUserIds } }).select("owner ownerName employeeName employeeNumber employeeReferenceId progressStatus objective createdAt objectiveID weight dueDate").lean();
      const objectiveIds = objectivesInScope.map(o => o._id.toString());
      krsInScope = objectiveIds.length > 0 ? await KeyResults.find({ objectiveId: { $in: objectiveIds } }).select("objectiveId target actual polarity").lean() : [];
    } else if (normalizedType === "mycompany") {
      objectivesInScope = await Objectives.find({ companyId }).select("owner ownerName employeeName employeeNumber employeeReferenceId progressStatus objective createdAt objectiveID weight dueDate").lean();
      const objectiveIds = objectivesInScope.map(o => o._id.toString());
      krsInScope = objectiveIds.length > 0 ? await KeyResults.find({ objectiveId: { $in: objectiveIds } }).select("objectiveId target actual polarity").lean() : [];
    } else {
      return res.status(400).send(failResponse({ message: "Invalid type. Use me, myteam, myfunction, or mycompany" }));
    }

    // Attendance calculations (company-wide)
    const activeEmpIds = new Set(activeEmpList.map(e => e._id.toString()));
    const presentTodayIds = new Set(todayTimeEntries.map(e => (e.userId || "").toString()));
    const presentCount = [...presentTodayIds].filter(id => activeEmpIds.has(id)).length;
    const presentPercent = activeEmpList.length > 0 ? Math.round((presentCount / activeEmpList.length) * 100) : 0;
    const lateArrivals = todayTimeEntries.filter(e => {
      const min = timeToMinutes(e.timeIn);
      return min != null && min > 10 * 60; // after 10:00
    }).length;
    const onLeaveCount = todayLeaves.length;

    // Punctuality score (based on subject users, last 30 days)
    const startWindow = new Date();
    startWindow.setDate(startWindow.getDate() - 30);
    const subjectTimeEntries = await TimeTracking.find({ companyId, userId: { $in: subjectUserIds }, createdAt: { $gte: startWindow } }).select("userId dateString timeIn timeOut status").lean();
    let punctDaysTotal = 0;
    let punctDaysGood = 0;
    const byUserDate = new Map();
    for (const e of subjectTimeEntries) {
      const key = `${e.userId}|${e.dateString}`;
      const inMin = timeToMinutes(e.timeIn);
      const outMin = timeToMinutes(e.timeOut);
      if (inMin == null && outMin == null) continue;
      const prev = byUserDate.get(key) || { inMin: null, outMin: null };
      byUserDate.set(key, {
        inMin: prev.inMin == null ? inMin : Math.min(prev.inMin, inMin ?? prev.inMin),
        outMin: prev.outMin == null ? outMin : Math.max(prev.outMin, outMin ?? prev.outMin)
      });
    }
    for (const [, v] of byUserDate.entries()) {
      punctDaysTotal += 1;
      if ((v.inMin != null && v.inMin <= 10 * 60) && (v.outMin != null && v.outMin >= 18 * 60)) {
        punctDaysGood += 1;
      }
    }
    const punctualityScore = punctDaysTotal > 0 ? Math.round((punctDaysGood / punctDaysTotal) * 100) : 0;

    // Achievements this month (completed tasks + KRs achieved)
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const achievementsTasks = await Tasks2.countDocuments({
      ...buildTaskAssignFilter(subjectUserIds),
      status: "completed",
      mainTask: { $in: ["", null] },
      updatedAt: { $gte: monthStart }
    });
    const krIdsByObjective = new Set(krsInScope.map(k => k.objectiveId?.toString()));
    const objectivesIdsInScope = objectivesInScope.map(o => o._id?.toString());
    // Key results considered achieved where actual >= target
    const achievementsKRs = await KeyResults.countDocuments({
      objectiveId: { $in: objectivesIdsInScope },
      updatedAt: { $gte: monthStart },
      $expr: {
        $cond: [
          { $eq: [{ $toLower: "$polarity" }, "positive"] },
          { $gte: ["$actual", "$target"] },
          { $gte: ["$target", "$actual"] }
        ]
      }
    });
    const myAchievementsThisMonth = achievementsTasks + achievementsKRs;

    // Calculate dynamic progressStatus for each objective based on KRs
    const objectivesWithDynamicProgress = objectivesInScope.map(objective => {
      // Find key results for this objective
      const objectiveKRs = krsInScope.filter(kr => kr.objectiveId?.toString() === objective._id?.toString());

      let dynamicProgressStatus = 0;

      if (objectiveKRs.length > 0) {
        // Calculate percentage for each KR using the same logic as objective3.controller.js
        const krPercentages = objectiveKRs.map(kr => {
          const percent = percentageCalculation(kr);
          return isNaN(percent) ? 0 : Number(percent);
        });

        // Calculate average percentage (same logic as objective3.controller.js)
        dynamicProgressStatus = Math.min(100, Math.round(totalSum(krPercentages.map(p => ({ percent: p })), "percent") / krPercentages.length));
      } else {
        // If no KRs, use stored progressStatus or default to 0
        dynamicProgressStatus = objective.progressStatus > 0 ? Math.min(100, objective.progressStatus) : 0;
      }

      return {
        ...objective,
        originalProgressStatus: objective.progressStatus,
        dynamicProgressStatus,
        krCount: objectiveKRs.length,
        krPercentages: objectiveKRs.map(kr => ({
          krId: kr._id,
          target: kr.target,
          actual: kr.actual,
          polarity: kr.polarity,
          percent: isNaN(percentageCalculation(kr)) ? 0 : Number(percentageCalculation(kr))
        }))
      };
    });

    // OKR progress distribution using dynamic progressStatus
    console.log('Debug OKR Progress - Request params:', { companyId, type, userId });
    console.log('Debug OKR Progress - Subject user IDs:', subjectUserIds);
    console.log('Debug OKR Progress - objectives with dynamic progress:', objectivesWithDynamicProgress.map(o => ({
      id: o._id,
      objective: o.objective,
      originalProgressStatus: o.originalProgressStatus,
      dynamicProgressStatus: o.dynamicProgressStatus,
      krCount: o.krCount,
      krPercentages: o.krPercentages
    })));

    // Use dynamicProgressStatus for classification instead of stored progressStatus
    const onTrackItems = objectivesWithDynamicProgress.filter(o => (o.dynamicProgressStatus || 0) >= 80);
    const atRiskItems = objectivesWithDynamicProgress.filter(o => (o.dynamicProgressStatus || 0) >= 50 && (o.dynamicProgressStatus || 0) < 80);
    const offTrackItems = objectivesWithDynamicProgress.filter(o => (o.dynamicProgressStatus || 0) < 50);

    console.log('Debug OKR Progress - Detailed classification:');
    console.log('On Track items:', onTrackItems.map(o => ({ id: o._id, objective: o.objective, dynamicProgressStatus: o.dynamicProgressStatus })));
    console.log('At Risk items:', atRiskItems.map(o => ({ id: o._id, objective: o.objective, dynamicProgressStatus: o.dynamicProgressStatus })));
    console.log('Off Track items:', offTrackItems.map(o => ({ id: o._id, objective: o.objective, dynamicProgressStatus: o.dynamicProgressStatus })));

    const okrOnTrack = onTrackItems.length;
    const okrAtRisk = atRiskItems.length;
    const okrOffTrack = offTrackItems.length;

    console.log('Debug OKR Progress - Final counts:', {
      onTrack: okrOnTrack,
      atRisk: okrAtRisk,
      offTrack: okrOffTrack,
      total: okrOnTrack + okrAtRisk + okrOffTrack
    });

    // Performance Trend Dashboard - based on performance review overall rating
    let performanceTrend = [];
    let rawReviews = [];

    if (normalizedType === "me") {
      // Get performance reviews for the specific user
      rawReviews = await ReviewForm.find({
        employeeId: userId,
        companyId,
        status: "Completed"
      }).sort({ createdAt: -1 }).limit(7).lean();

      performanceTrend = rawReviews.map((review, idx) => ({
        label: `${review.startDate} - ${review.endDate}`,
        current: parseFloat(review.overallRating || 0), // Keep original 0-5 scale
        target: 5
      }));
    } else if (normalizedType === "myteam") {
      // Get performance reviews for team members
      rawReviews = await ReviewForm.find({
        employeeId: { $in: subjectUserIds },
        companyId,
        status: "Completed"
      }).sort({ createdAt: -1 }).limit(7).lean();

      performanceTrend = rawReviews.map((review, idx) => ({
        label: `${review.startDate} - ${review.endDate}`,
        current: parseFloat(review.overallRating || 0), // Keep original 0-5 scale
        target: 5
      }));
    } else if (normalizedType === "myfunction") {
      // Get performance reviews for function members (same department)
      rawReviews = await ReviewForm.find({
        employeeId: { $in: subjectUserIds },
        companyId,
        status: "Completed"
      }).sort({ createdAt: -1 }).limit(7).lean();

      performanceTrend = rawReviews.map((review, idx) => ({
        label: `${review.startDate} - ${review.endDate}`,
        current: parseFloat(review.overallRating || 0), // Keep original 0-5 scale
        target: 5
      }));
    } else if (normalizedType === "mycompany") {
      // Get performance reviews for the entire company
      rawReviews = await ReviewForm.find({
        companyId,
        status: "Completed"
      }).sort({ createdAt: -1 }).limit(7).lean();

      performanceTrend = rawReviews.map((review, idx) => ({
        label: `${review.startDate} - ${review.endDate}`,
        current: parseFloat(review.overallRating || 0), // Keep original 0-5 scale
        target: 5
      }));
    }

    // If no performance reviews found, provide default data
    if (performanceTrend.length === 0) {
      performanceTrend = [
        { label: "No reviews available", current: 0, target: 5 }
      ];
    }

    // Debug: Log performance review data
    console.log('Debug Performance Trend - Raw reviews found:', rawReviews.length);
    console.log('Debug Performance Trend - Sample review data:', rawReviews.slice(0, 2).map(r => ({
      id: r._id,
      employeeId: r.employeeId,
      employeeName: r.employeeFullName,
      overallRating: r.overallRating,
      reviewPeriodStartDate: r.reviewPeriodStartDate,
      reviewPeriodEndDate: r.reviewPeriodEndDate,
      startDate: r.startDate,
      endDate: r.endDate,
      status: r.status
    })));

    // Calculate reward points for the current user/scope
    const toTwoDecimals = (num) => Number.parseFloat((Number(num || 0)).toFixed(2));
    let userRewardPoints = 0;
    if (normalizedType === "me") {
      const userRewardData = rewardPointsCompanyAgg.find(r => r._id?.toString() === userId);
      userRewardPoints = toTwoDecimals(userRewardData?.totalPoints || 0);
    } else if (normalizedType === "myteam") {
      userRewardPoints = toTwoDecimals(rewardPointsCompanyAgg
        .filter(r => subjectUserIds.includes(r._id?.toString()))
        .reduce((sum, r) => sum + (r.totalPoints || 0), 0));
    } else if (normalizedType === "myfunction") {
      userRewardPoints = toTwoDecimals(rewardPointsCompanyAgg
        .filter(r => subjectUserIds.includes(r._id?.toString()))
        .reduce((sum, r) => sum + (r.totalPoints || 0), 0));
    } else if (normalizedType === "mycompany") {
      userRewardPoints = toTwoDecimals(rewardPointsCompanyAgg.reduce((sum, r) => sum + (r.totalPoints || 0), 0));
    } else {
      return res.status(400).send(failResponse({ message: "Invalid type. Use me, myteam, myfunction, or mycompany" }));
    }

    // Reward Points Leaderboard - company-wide and department-wise
    const employeeMap = new Map(employeesAllForLeaderboard.map(e => [e._id.toString(), e]));
    const employeeMapByFullName = new Map(
      (employeesAllForLeaderboard || []).map(e => {
        const fullName = `${e.personalInformation?.firstName || ""} ${e.personalInformation?.lastName || ""}`.trim().toLowerCase();
        return [fullName, e];
      })
    );
    const employeeMapByEmpNumber = new Map(
      (employeesAllForLeaderboard || [])
        .filter(e => e.employmentInformation?.employeeNumber)
        .map(e => [String(e.employmentInformation.employeeNumber), e])
    );
    const leaderboardCompany = rewardPointsCompanyAgg
      .map(r => ({
        employeeId: r._id?.toString(),
        employeeNumber: employeeMap.get(r._id?.toString())?.employmentInformation?.employeeNumber || "",
        points: toTwoDecimals(r.totalPoints),
        name: employeeMap.get(r._id?.toString()) ? `${employeeMap.get(r._id.toString()).personalInformation.firstName || ""} ${employeeMap.get(r._id.toString()).personalInformation.lastName || ""}`.trim() : "",
        department: employeeMap.get(r._id?.toString())?.employmentInformation?.department || null,
        avatar: employeeMap.get(r._id?.toString())?.personalInformation?.profilePicture || employeeMap.get(r._id?.toString())?.personalInformation?.image || null
      }))
      .filter(x => employeeMap.has(x.employeeId))
      .slice(0, 10);

    // Department-wise employees leaderboard (individual employees by department, not department totals)
    const employeesByDepartment = {};
    for (const r of rewardPointsCompanyAgg) {
      const emp = employeeMap.get(r._id?.toString());
      if (!emp) continue;
      const dept = emp.employmentInformation?.department || "Unknown";
      if (!employeesByDepartment[dept]) {
        employeesByDepartment[dept] = [];
      }
      employeesByDepartment[dept].push({
        employeeId: r._id?.toString(),
        employeeNumber: emp.employmentInformation?.employeeNumber || "",
        points: toTwoDecimals(r.totalPoints),
        name: `${emp.personalInformation?.firstName || ""} ${emp.personalInformation?.lastName || ""}`.trim(),
        avatar: emp.personalInformation?.profilePicture || emp.personalInformation?.image || null
      });
    }

    // Sort employees within each department and show all employees per department
    const leaderboardDepartments = Object.entries(employeesByDepartment)
      .map(([department, employees]) => ({
        department,
        employees: employees.sort((a, b) => b.points - a.points) // Show all employees, not just top 5
      }))
      .sort((a, b) => {
        const aMaxPoints = Math.max(...a.employees.map(e => e.points));
        const bMaxPoints = Math.max(...b.employees.map(e => e.points));
        return bMaxPoints - aMaxPoints;
      })
      .slice(0, 10);

    // Birthday and Anniversary Lists (upcoming only in current month)
    const upcomingDays = 365; // Used for calculations, but filtered to upcoming dates in current month only

    // IST (Indian Standard Time) offset: UTC+5:30 = 330 minutes
    const IST_OFFSET_MINUTES = 330;

    // Convert date to IST date string (YYYY-MM-DD) for consistent API response
    const toISTDateString = (dateValue) => {
      if (!dateValue) return null;
      return moment(dateValue).utcOffset(IST_OFFSET_MINUTES).format("YYYY-MM-DD");
    };

    // Get IST date parts (year, month 1-12, day) for date-only logic
    const getISTDateParts = (dateValue) => {
      if (!dateValue) return null;
      const m = moment(dateValue).utcOffset(IST_OFFSET_MINUTES);
      return { year: m.year(), month: m.month() + 1, day: m.date() };
    };

    // Helper function to get next occurrence of a date (ignoring time of day, using IST)
    const getNextOccurrence = (date) => {
      if (!date) return null;
      const refParts = getISTDateParts(now);
      const baseParts = getISTDateParts(date);
      if (!refParts || !baseParts) return null;
      const currentYear = refParts.year;

      let nextYear = currentYear;
      // If the person joined in the current year, their first anniversary is next year
      if (baseParts.year === currentYear) {
        nextYear = currentYear + 1;
      } else {
        const nextThisYear = moment().utcOffset(IST_OFFSET_MINUTES).year(currentYear).month(baseParts.month - 1).date(baseParts.day).startOf("day");
        const refDate = moment(now).utcOffset(IST_OFFSET_MINUTES).startOf("day");
        if (nextThisYear.isBefore(refDate)) {
          nextYear = currentYear + 1;
        }
      }

      return moment().utcOffset(IST_OFFSET_MINUTES).year(nextYear).month(baseParts.month - 1).date(baseParts.day).startOf("day").toDate();
    };

    // Helper function to get days until next occurrence (using IST)
    const getDaysUntil = (date) => {
      const refDate = moment(now).utcOffset(IST_OFFSET_MINUTES).startOf("day");
      const nextOccurrence = getNextOccurrence(date);
      if (!nextOccurrence) return Infinity;
      const nextDate = moment(nextOccurrence).utcOffset(IST_OFFSET_MINUTES).startOf("day");
      return nextDate.diff(refDate, "days");
    };

    // Debug: Check what data we have
    console.log('Total employees found:', employeesAllForLeaderboard.length);
    console.log('Sample employee data:', employeesAllForLeaderboard.slice(0, 2).map(e => ({
      id: e._id,
      name: `${e.personalInformation?.firstName} ${e.personalInformation?.lastName}`,
      hasDateOfBirth: !!e.personalInformation?.dateOfBirth,
      hasHireDate: !!e.employmentInformation?.hireDate,
      dateOfBirth: e.personalInformation?.dateOfBirth,
      hireDate: e.employmentInformation?.hireDate
    })));

    // Get all employees with birthdays
    const nowISTParts = getISTDateParts(now);
    const currentMonthIST = nowISTParts ? nowISTParts.month : now.getMonth() + 1;
    const currentDayIST = nowISTParts ? nowISTParts.day : now.getDate();

    const allBirthdayData = employeesAllForLeaderboard
      .map(e => {
        const nextBirthday = getNextOccurrence(e.personalInformation?.dateOfBirth);
        const daysUntil = getDaysUntil(e.personalInformation?.dateOfBirth);
        const istParts = getISTDateParts(e.personalInformation?.dateOfBirth);
        const monthName = istParts ? moment().month(istParts.month - 1).format("MMMM") : null;

        return {
          employeeId: e._id,
          employeeNumber: e.employmentInformation?.employeeNumber || "",
          name: `${e.personalInformation?.firstName || ""} ${e.personalInformation?.lastName || ""}`.trim(),
          email: e.contactInformation?.email || "",
          date: toISTDateString(e.personalInformation?.dateOfBirth),
          nextOccurrence: nextBirthday ? toISTDateString(nextBirthday) : null,
          daysUntil: daysUntil,
          month: istParts ? istParts.month : null, // 1-12
          day: istParts ? istParts.day : null, // 1-31
          monthName,
          avatar: e.personalInformation?.profilePicture || e.personalInformation?.image || null,
          hasDateOfBirth: !!e.personalInformation?.dateOfBirth,
          isCurrentMonth: istParts ? istParts.month === currentMonthIST : false,
          gender: e.personalInformation?.gender ? e.personalInformation?.gender : ""
        };
      });

    const currentDay = currentDayIST;
    const birthdayList = allBirthdayData
      .filter(e => e.hasDateOfBirth && e.isCurrentMonth && e.day >= currentDay) // Only show upcoming/today in current month
      .sort((a, b) => a.day - b.day); // Sort by day of month

    console.log('Birthday processing:');
    console.log('Employees with DOB:', allBirthdayData.filter(e => e.hasDateOfBirth).length);
    console.log('Employees with upcoming birthdays:', birthdayList.length);
    console.log('Sample birthday data:', allBirthdayData.slice(0, 3));

    // Get all employees with anniversaries
    const allAnniversaryData = employeesAllForLeaderboard
      .map(e => {
        const hireDate = e.employmentInformation?.hireDate ? new Date(e.employmentInformation.hireDate) : null;
        const nextAnniversary = getNextOccurrence(hireDate);
        const daysUntil = getDaysUntil(hireDate);
        const istParts = getISTDateParts(e.employmentInformation?.hireDate);
        const monthName = istParts ? moment().month(istParts.month - 1).format("MMMM") : null;
        const hireDateIST = hireDate ? moment(hireDate).utcOffset(IST_OFFSET_MINUTES).startOf("day") : null;
        const nowIST = moment(now).utcOffset(IST_OFFSET_MINUTES).startOf("day");
        const hasStarted = !!hireDateIST && hireDateIST.isBefore(nowIST); // strictly before today in IST
        const yearsOfService = nextAnniversary && hireDate ? (moment(nextAnniversary).year() - moment(hireDate).year()) : null;

        return {
          employeeId: e._id,
          employeeNumber: e.employmentInformation?.employeeNumber || "",
          name: `${e.personalInformation?.firstName || ""} ${e.personalInformation?.lastName || ""}`.trim(),
          email: e.contactInformation?.email || "",
          date: toISTDateString(e.employmentInformation?.hireDate),
          nextOccurrence: nextAnniversary ? toISTDateString(nextAnniversary) : null,
          daysUntil: daysUntil,
          month: istParts ? istParts.month : null, // 1-12
          day: istParts ? istParts.day : null, // 1-31
          monthName,
          avatar: e.personalInformation?.profilePicture || e.personalInformation?.image || null,
          hasHireDate: !!e.employmentInformation?.hireDate,
          isCurrentMonth: istParts ? istParts.month === currentMonthIST : false,
          hasStarted,
          yearsOfService,
          gender: e.personalInformation?.gender ? e.personalInformation?.gender : ""
        };
      });

    const anniversaryList = allAnniversaryData
      .filter(e => e.hasHireDate && e.hasStarted && e.isCurrentMonth && e.day >= currentDay) // Only show upcoming/today in current month and exclude future hires
      .sort((a, b) => a.day - b.day); // Sort by day of month
    const employeeMap2 = new Map(
      (activeEmpList || []).map(e => [
        e._id?.toString(),
        {
          name: `${e.personalInformation?.firstName || ""} ${e.personalInformation?.lastName || ""}`.trim(),
          email: e.contactInformation?.email || "",
          department: e.employmentInformation?.department || "",
          employeeNumber: e.employmentInformation?.employeeNumber || ""
        }
      ])
    );
    const employeeMapByEmail = new Map(
      (activeEmpList || [])
        .map(e => {
          const email = (e.contactInformation?.email || "").toLowerCase();
          return [email, {
            name: `${e.personalInformation?.firstName || ""} ${e.personalInformation?.lastName || ""}`.trim(),
            email: e.contactInformation?.email || "",
            department: e.employmentInformation?.department || "",
            employeeNumber: e.employmentInformation?.employeeNumber || ""
          }];
        })
    );

    const okrProgressDetails = (objectivesWithDynamicProgress || []).map(o => {
      // Resolve strictly by employeeReferenceId for employeeNumber
      const employeeId = (o.employeeReferenceId || "").toString();
      const empAll = employeeMap.get(employeeId);
      const empActive = employeeMap2.get(employeeId);

      const name = empAll
        ? `${empAll.personalInformation?.firstName || ""} ${empAll.personalInformation?.lastName || ""}`.trim()
        : (empActive?.name || o.ownerName || o.employeeName || o.owner || "");
      const employeeNumber = empAll?.employmentInformation?.employeeNumber
        || empActive?.employeeNumber
        || "";
      const email =
        empAll?.contactInformation?.email
        || empActive?.email
        || o.ownerEmail
        || o.employeeEmail
        || o.email
        || "";
      const objectiveId = o.objectiveID || (o._id ? o._id.toString() : "");
      const parsedWeight = Number(o.weight);
      const weight = o.weight != null
        ? (typeof o.weight === "number" ? o.weight : Number.isNaN(parsedWeight) ? null : parsedWeight)
        : null;
      return {
        objectiveId,
        objective: o.objective || "",
        employeeName: name,
        employeeNumber,
        email,
        weight,
        dueDate: o.dueDate || null,
        progressPercent: Number(o.dynamicProgressStatus || 0),
        createdAt: o.createdAt || null,
        krCount: typeof o.krCount === 'number' ? o.krCount : undefined
      };
    });

    // Use todayTimeEntries for attendanceDetails to match "Today's Attendance" export
    const attendanceDetails = (todayTimeEntries || []).map(entry => {
      const byId = employeeMap2.get((entry.userId || "").toString());
      const byEmail = entry.employeeInfo?.email ? employeeMapByEmail.get(String(entry.employeeInfo.email).toLowerCase()) : undefined;
      const emp = byId || byEmail || {};
      return {
        employeeName: emp.name || "",
        employeeEmail: emp.email || "",
        employeeNumber: emp.employeeNumber || "",
        date: entry.dateString || "",
        timeIn: entry.timeIn || "",
        timeOut: entry.timeOut || "",
        status: entry.status || ""
      };
    });

    // console.log(activeEmpList,"activeEmpList-------->");
    // Assemble response
    const response = {
      headerCards: {
        myActiveTasks: { total: activeTasksCount, urgent: urgentActiveTasksCount },
        teamAttendance: { presentPercent },
        punctualityScore: punctualityScore,
        myAchievements: { thisMonth: myAchievementsThisMonth },
        rewardPoints: { available: userRewardPoints },
      },
      tasksDashboard: {
        kpiTasks: kpiTasksCount,
        adHocTasks: adHocTasksCount,
        urgent: urgentActiveTasksCount,
        recent: recentTasks,
      },
      leaderboard: {
        company: leaderboardCompany,
        departments: leaderboardDepartments,
      },
      okrProgress: {
        onTrack: okrOnTrack,
        offTrack: okrOffTrack,
        atRisk: okrAtRisk,
        total: okrOnTrack + okrOffTrack + okrAtRisk,
      },
      okrProgressDetails,
      todaysAttendance: {
        presentPercent,
        presentCount,
        totalEmployees: activeEmpList.length,
        lateArrivals,
        onLeave: onLeaveCount,
        nextHoliday: nextHoliday ? { name: nextHoliday.holidayName, date: nextHoliday.fromDate || nextHoliday.toDate } : null,
      },
      attendanceDetails,
      performanceTrend: performanceTrend,
      birthdays: birthdayList,
      anniversaries: anniversaryList,
      // Debug info
      debug: {
        type,
        subjectUserIds: subjectUserIds.length,
        objectivesCount: objectivesInScope.length,
        krsCount: krsInScope.length,
        taskFilters: {
          activeTasksCount,
          urgentActiveTasksCount,
          kpiTasksCount,
          adHocTasksCount,
          totalTasksInScope,
          totalTasksInCompany,
          subjectUserIds: subjectUserIds.slice(0, 5), // Show first 5 for debugging
          taskFilterQuery: buildTaskAssignFilter(subjectUserIds), // Show the actual query being used
        },
        okrFilters: {
          onTrack: okrOnTrack,
          offTrack: okrOffTrack,
          atRisk: okrAtRisk,
          total: okrOnTrack + okrOffTrack + okrAtRisk,
        },
        okrObjectivesDebug: objectivesWithDynamicProgress.map(o => ({
          id: o._id,
          objective: o.objective,
          originalProgressStatus: o.originalProgressStatus,
          dynamicProgressStatus: o.dynamicProgressStatus,
          krCount: o.krCount,
          krPercentages: o.krPercentages,
          classification: (o.dynamicProgressStatus || 0) >= 80 ? 'onTrack' :
            (o.dynamicProgressStatus || 0) >= 50 && (o.dynamicProgressStatus || 0) < 80 ? 'atRisk' : 'offTrack'
        })),
        performanceTrend: {
          reviewCount: performanceTrend.length,
          reviews: performanceTrend,
          rawReviews: rawReviews.slice(0, 3).map(r => ({
            id: r._id,
            employeeId: r.employeeId,
            employeeName: r.employeeFullName,
            overallRating: r.overallRating,
            reviewPeriodStartDate: r.reviewPeriodStartDate,
            reviewPeriodEndDate: r.reviewPeriodEndDate,
            startDate: r.startDate,
            endDate: r.endDate,
            status: r.status
          })),
          type: normalizedType
        },
        rewardPoints: {
          userRewardPoints,
          totalRewardPointsInCompany: toTwoDecimals(rewardPointsCompanyAgg.reduce((sum, r) => sum + (r.totalPoints || 0), 0)),
          rewardPointsCount: rewardPointsCompanyAgg.length,
        }
      }
    };

    res.status(200).send(successResponse({ message: "Dashboard data retrieved successfully", data: response }));
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Failed to load dashboard data",
      })
    );
  }
};

/**
 * Get task dashboard data with filters
 * @route GET /dashboard/getTaskDashboardData
 * @param {string} companyId - Company ID (required)
 * @param {string} userId - User ID (required for type "me" or "myTeam")
 * @param {string} type - Type of view: "me", "myTeam", "myCompany" (default: "me")
 * @param {string} filter - Time filter: "week", "month", "year", "all" (default: "all")
 * @returns {Object} Task dashboard data with counts and recent tasks
 */
const getTaskDashboardData = async (req, res) => {
  try {
    const { companyId, type = "me", userId, filter = "all" } = req.query;
    const normalizedType = (type || "me").toString().trim().toLowerCase();

    if (!companyId) {
      return res.status(400).send(failResponse({ message: "companyId is required" }));
    }
    if (["me", "myteam"].includes(normalizedType) && !userId) {
      return res.status(400).send(failResponse({ message: "userId is required for this type" }));
    }

    const now = new Date();

    // Calculate date range based on filter
    let startDate = null;
    let endDate = null;

    switch (filter) {
      case "week":
        startDate = new Date(now);
        startDate.setDate(now.getDate() - now.getDay()); // Start of current week (Sunday)
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 6); // End of current week (Saturday)
        endDate.setHours(23, 59, 59, 999);
        break;
      case "month":
        startDate = new Date(now.getFullYear(), now.getMonth(), 1); // Start of current month
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0); // End of current month
        endDate.setHours(23, 59, 59, 999);
        break;
      case "year":
        startDate = new Date(now.getFullYear(), 0, 1); // Start of current year
        endDate = new Date(now.getFullYear(), 11, 31); // End of current year
        endDate.setHours(23, 59, 59, 999);
        break;
      case "all":
      default:
        // No date filter for "all"
        break;
    }

    // Resolve subject userIds based on type
    let subjectUserIds = [];
    if (normalizedType === "me") {
      subjectUserIds = [userId];
    } else if (normalizedType === "myteam") {
      // Find all employees who have this user as their line manager
      const teamMembers = await Employee.find({
        companyId,
        status: "Active",
        "employmentInformation.lineManager": userId
      }).select("_id");
      subjectUserIds = teamMembers.map(e => e._id.toString());

      // Also include the manager themselves
      subjectUserIds.push(userId);
    } else if (normalizedType === "myfunction") {
      // Find the current user's department and legal entity mappings
      const currentUser = await Employee.findById(userId).select("employmentInformation.department employmentInformation.legalEntityMappings");

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
        // Find all employees who are in ANY of these functions (either as primary department or in mappings)
        const functionMembers = await Employee.find({
          companyId,
          status: "Active",
          $or: [
            { "employmentInformation.department": { $in: userFunctions } },
            { "employmentInformation.legalEntityMappings.function": { $in: userFunctions } }
          ]
        }).select("_id");
        subjectUserIds = functionMembers.map(e => e._id.toString());
      } else {
        subjectUserIds = [userId];
      }
    } else if (normalizedType === "mycompany") {
      const employees = await Employee.find({ companyId, status: "Active" }).select("_id");
      subjectUserIds = employees.map(e => e._id.toString());
    } else {
      return res.status(400).send(failResponse({ message: "Invalid type. Use me, myteam, or mycompany" }));
    }

    // Helper to build assignment filter for Tasks2
    const buildTaskAssignFilter = (ids) => ({
      companyId,
      assignTo: { $in: ids },
      userId: { $exists: true },
    });

    // Build date filter for tasks - use startDate for filtering
    const dateFilter = {};
    if (startDate && endDate) {
      dateFilter.startDate = { $gte: startDate, $lte: endDate };
    }

    // Get task counts and data with date filter
    const [
      activeTasks,
      urgentActiveTasks,
      kpiTasks,
      adHocTasks,
      recentTasks
    ] = await Promise.all([
      Tasks2.find({
        ...buildTaskAssignFilter(subjectUserIds),
        status: { $nin: ["completed"] },
        mainTask: { $in: ["", null] },
        ...dateFilter
      }).sort({ createdAt: -1 }).lean(),
      Tasks2.find({
        ...buildTaskAssignFilter(subjectUserIds),
        status: { $nin: ["completed"] },
        priority: "High Level",
        mainTask: { $in: ["", null] },
        ...dateFilter
      }).sort({ createdAt: -1 }).lean(),
      // KPI Tasks: tasks that have a valid, non-empty krReferenceId (linked to Key Results)
      Tasks2.find({
        ...buildTaskAssignFilter(subjectUserIds),
        status: { $nin: ["completed"] },
        krReferenceId: { $type: "string", $regex: /\S/ },
        mainTask: { $in: ["", null] },
        ...dateFilter
      }).sort({ createdAt: -1 }).lean(),
      // Ad-hoc Tasks: tasks that don't have a valid krReferenceId (missing, null, empty, or whitespace)
      Tasks2.find({
        ...buildTaskAssignFilter(subjectUserIds),
        status: { $nin: ["completed"] },
        $or: [
          { krReferenceId: { $exists: false } },
          { krReferenceId: null },
          { krReferenceId: "" },
          { krReferenceId: { $type: "string", $regex: /^\s*$/ } }
        ],
        mainTask: { $in: ["", null] },
        ...dateFilter
      }).sort({ createdAt: -1 }).lean(),
      Tasks2.find({
        ...buildTaskAssignFilter(subjectUserIds),
        mainTask: { $in: ["", null] },
        ...dateFilter
      }).sort({ createdAt: -1 }).limit(10).lean()
    ]);

    // Get counts from arrays
    const activeTasksCount = activeTasks.length;
    const urgentActiveTasksCount = urgentActiveTasks.length;
    const kpiTasksCount = kpiTasks.length;
    const adHocTasksCount = adHocTasks.length;

    // Get employee details for all tasks
    const allEmployeeIds = new Set();
    [activeTasks, urgentActiveTasks, kpiTasks, adHocTasks, recentTasks].forEach(taskArray => {
      taskArray.forEach(task => {
        if (task.assignTo) {
          if (Array.isArray(task.assignTo)) {
            task.assignTo.forEach(id => allEmployeeIds.add(id.toString()));
          } else {
            allEmployeeIds.add(task.assignTo.toString());
          }
        }
      });
    });

    const employees = await Employee.find({ _id: { $in: Array.from(allEmployeeIds) } })
      .select("_id personalInformation.firstName personalInformation.lastName personalInformation.profilePicture personalInformation.image")
      .lean();

    const employeeMap = new Map(employees.map(emp => [emp._id.toString(), emp]));

    // Helper function to enhance tasks with employee information
    const enhanceTasksWithEmployeeInfo = (tasks) => {
      return tasks.map(task => {
        const assignee = employeeMap.get(task.assignTo?.toString());
        return {
          ...task,
          assigneeName: assignee ? `${assignee.personalInformation?.firstName || ''} ${assignee.personalInformation?.lastName || ''}`.trim() : 'Unknown',
          assigneeAvatar: assignee?.personalInformation?.profilePicture || assignee?.personalInformation?.image || null
        };
      });
    };

    // Enhance all task arrays with employee information
    const enhancedActiveTasks = enhanceTasksWithEmployeeInfo(activeTasks);
    const enhancedUrgentTasks = enhanceTasksWithEmployeeInfo(urgentActiveTasks);
    const enhancedKpiTasks = enhanceTasksWithEmployeeInfo(kpiTasks);
    const enhancedAdHocTasks = enhanceTasksWithEmployeeInfo(adHocTasks);
    const enhancedRecentTasks = enhanceTasksWithEmployeeInfo(recentTasks);

    const response = {
      filter,
      dateRange: startDate && endDate ? {
        start: startDate,
        end: endDate
      } : null,
      debug: {
        dateFilter,
        startDate: startDate?.toISOString(),
        endDate: endDate?.toISOString(),
        filterApplied: filter !== 'all'
      },
      tasksDashboard: {
        kpiTasks: {
          count: kpiTasksCount,
          tasks: enhancedKpiTasks
        },
        adHocTasks: {
          count: adHocTasksCount,
          tasks: enhancedAdHocTasks
        },
        urgent: {
          count: urgentActiveTasksCount,
          tasks: enhancedUrgentTasks
        },
        total: {
          count: activeTasksCount,
          tasks: enhancedActiveTasks
        },
        recent: enhancedRecentTasks,
      },
      summary: {
        totalTasks: activeTasksCount,
        completedTasks: await Tasks2.countDocuments({
          ...buildTaskAssignFilter(subjectUserIds),
          status: "completed",
          mainTask: { $in: ["", null] },
          ...dateFilter
        }),
        pendingTasks: await Tasks2.countDocuments({
          ...buildTaskAssignFilter(subjectUserIds),
          status: "pending",
          mainTask: { $in: ["", null] },
          ...dateFilter
        }),
        inProgressTasks: await Tasks2.countDocuments({
          ...buildTaskAssignFilter(subjectUserIds),
          status: "in-progress",
          mainTask: { $in: ["", null] },
          ...dateFilter
        }),
        notStartedTasks: await Tasks2.countDocuments({
          ...buildTaskAssignFilter(subjectUserIds),
          status: "notstarted",
          mainTask: { $in: ["", null] },
          ...dateFilter
        })
      }
    };

    res.status(200).send(successResponse({ message: "Task dashboard data retrieved successfully", data: response }));
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Failed to load task dashboard data",
      })
    );
  }
};

module.exports = {
  getDashboardData,
  getTaskDashboardData,
};
