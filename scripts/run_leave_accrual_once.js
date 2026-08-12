/**
 * Manual Leave Accrual Script
 * Run this script once to manually trigger leave accrual for all companies
 * 
 * Usage: node scripts/run_leave_accrual_once.js
 */

const mongoose = require('mongoose');
const LeaveTypeModel = require("../models/recruitment/LeaveType/LeaveType");
const EmployeeModel = require("../models/employee.model");
const EmployeeLeaveBalance = require("../models/recruitment/EmployeeLeaveBalance");
const EligibilityCriteriaModel = require("../models/recruitment/EligibilityCriteria/EligibilityCriteria");
const CompanyModel = require("../models/company.model");
const LeavesModel = require("../models/recruitment/Leaves/Leaves.model");
const HolidaysCalendar = require("../models/holidaysCalendar/holidaysCalendar");

// Import environment configuration
const environment = require('../config/environment');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
const isMonthStart = (d) => d.getDate() === 1;
const isHourStart = (d) => d.getMinutes() === 0 && d.getSeconds() === 0;

const isFinancialYearStartForType = (now, leaveType) => {
  try {
    const co = leaveType?.carryOver || {};
    const raw = co.carryOverDate;
    if (raw && /^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      const dt = new Date(raw);
      return now.getMonth() === dt.getMonth() && now.getDate() === dt.getDate();
    }
    return now.getMonth() === 3 && now.getDate() === 1; // default: 1 Apr
  } catch (e) {
    return now.getMonth() === 3 && now.getDate() === 1;
  }
};

// Parse an optional date/month from CLI args:
//   --month=YYYY-MM   e.g. --month=2025-11 (treated as YYYY-MM-01T00:10:00)
//   --date=ISO_DATE   e.g. --date=2025-12-01T00:10:00
const parseRequestedDateFromArgs = () => {
  const args = process.argv.slice(2);
  const arg = args.find(
    (a) => a.startsWith('--month=') || a.startsWith('--date=')
  );
  if (!arg) return null;
  const value = arg.split('=')[1];
  if (!value) return null;
  // YYYY-MM pattern
  if (/^\d{4}-\d{2}$/.test(value)) {
    return new Date(`${value}-01T00:10:00`);
  }
  // Fallback to Date parsing for full ISO or other valid formats
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) {
    console.error('❌ Invalid --month/--date value. Use YYYY-MM or a valid ISO date.');
    process.exit(1);
  }
  return dt;
};

const isEmployeeEligibleForLeaveType = async (employee, leaveType) => {
  const eligibilityId = (leaveType?.eligibilityId || '').toString();
  if (!eligibilityId || eligibilityId === 'undefined') return true;
  try {
    const eligibility = await EligibilityCriteriaModel.findById(eligibilityId);
    if (!eligibility) return true;
    
    const evaluateComparison = (leftValue, comparisonString) => {
      if (!comparisonString || typeof comparisonString !== 'string') return true;
      const expr = comparisonString.replace(/\s+/g, '');
      const match = expr.match(/^(>=|<=|>|<|==|=)?(\d+)$/);
      if (!match) return true;
      const op = match[1] || '>=';
      const right = parseInt(match[2], 10);
      switch (op) {
        case '>': return leftValue > right;
        case '>=': return leftValue >= right;
        case '<': return leftValue < right;
        case '<=': return leftValue <= right;
        case '==':
        case '=': return leftValue === right;
        default: return true;
      }
    };
    
    if (eligibility.gender && eligibility.gender.toLowerCase() !== 'all') {
      const empGender = employee.personalInformation?.gender;
      if (empGender && empGender.toLowerCase() !== eligibility.gender.toLowerCase()) return false;
    }
    if (eligibility.department && eligibility.department.toLowerCase() !== 'all') {
      const empDept = employee.employmentInformation?.department;
      if (empDept && empDept.toLowerCase() !== eligibility.department.toLowerCase()) return false;
    }
    if (eligibility.personType && eligibility.personType.toLowerCase() !== 'all') {
      const role = employee.employmentInformation?.role;
      if (role && role.toLowerCase() !== eligibility.personType.toLowerCase()) return false;
    }
    
    if (eligibility.lengthOfService) {
      const hireDateRaw = employee.employmentInformation?.hireDate;
      if (!hireDateRaw) return false;
      const hireDate = startOfDay(new Date(hireDateRaw));
      const today = startOfDay(new Date());
      const msInDay = 24 * 60 * 60 * 1000;
      const totalDays = Math.floor((today.getTime() - hireDate.getTime()) / msInDay);
      
      const exclusions = eligibility.lengthOfServiceExclusions || {};
      let daysToExclude = 0;
      
      if (exclusions.excludeWeekends) {
        let weekendCount = 0;
        let cursor = new Date(hireDate.getTime());
        while (cursor <= today) {
          const dow = cursor.getDay();
          if (dow === 0 || dow === 6) weekendCount++;
          cursor.setDate(cursor.getDate() + 1);
        }
        daysToExclude += weekendCount;
      }
      
      if (exclusions.excludeLeaves) {
        try {
          const empId = String(employee._id || employee.id || employee.empId || '');
          const companyId = String(leaveType?.companyId || employee.companyId || '');
          const approvedLeaves = await LeavesModel.find({
            ...(companyId ? { companyId } : {}),
            empId,
            status: 'approved',
            from: { $gte: hireDate, $lte: today }
          }).select('durationOfAbsence halfDay from to');
          
          const leaveDays = approvedLeaves.reduce((sum, leave) => {
            const dur = parseFloat(leave?.durationOfAbsence);
            if (Number.isFinite(dur)) return sum + dur;
            const f = leave?.from ? startOfDay(new Date(leave.from)) : null;
            const t = leave?.to ? startOfDay(new Date(leave.to)) : null;
            if (f && t) {
              return sum + (Math.floor((t - f) / msInDay) + 1);
            }
            return sum;
          }, 0);
          
          daysToExclude += leaveDays;
        } catch (err) {
          // Silent catch
        }
      }
      
      if (exclusions.excludePublicHolidays) {
        try {
          const companyId = String(leaveType?.companyId || employee.companyId || '');
          if (companyId) {
            const holidays = await HolidaysCalendar.find({
              companyId,
              date: { $gte: hireDate, $lte: today }
            }).select('date');
            const holidayCount = holidays.reduce((acc, h) => {
              const d = new Date(h.date);
              const dow = d.getDay();
              if (exclusions.excludeWeekends && (dow === 0 || dow === 6)) return acc;
              return acc + 1;
            }, 0);
            daysToExclude += holidayCount;
          }
        } catch (err) {
          // Silent catch
        }
      }
      
      const effectiveDaysOfService = Math.max(0, totalDays - daysToExclude);
      if (!evaluateComparison(effectiveDaysOfService, String(eligibility.lengthOfService))) {
        return false;
      }
    }
    
    if (employee.employmentInformation?.status && employee.employmentInformation.status.toLowerCase() !== 'active') return false;
    return true;
  } catch (e) {
    return true;
  }
};

const addToEmployeeBalance = async ({ companyId, empId, leaveType, daysToAdd, periodScope, periodKey }) => {
  if (!daysToAdd || daysToAdd <= 0) return;

  const maxElapsedDays = leaveType.autoAddLeaves?.maxElapsedDays;
  const leaveTypeId = String(leaveType._id);
  const leaveTypeName = leaveType.name;
  const unit = leaveType.unit || 'days';

  let balanceDoc = await EmployeeLeaveBalance.findOne({ companyId, empId });
  
  if (!balanceDoc) {
    const initialBalance = maxElapsedDays ? Math.min(daysToAdd, maxElapsedDays) : daysToAdd;
    const lastAccrual = (periodScope && periodKey) ? { [periodScope]: periodKey } : undefined;
    await EmployeeLeaveBalance.create({
      companyId,
      empId,
      leaveTypes: [{
        leaveTypeId,
        name: leaveTypeName,
        unit,
        balance: initialBalance,
        ...(lastAccrual ? { lastAccrual } : {})
      }]
    });
    console.log(`   💾 Created NEW balance record for employee ${empId}: ${leaveTypeName} = ${initialBalance} ${unit}`);
    return;
  }

  const types = Array.isArray(balanceDoc.leaveTypes) ? balanceDoc.leaveTypes : [];
  const idx = types.findIndex(t => String(t.leaveTypeId) === leaveTypeId);
  
  if (idx >= 0) {
    const lastAccrual = types[idx].lastAccrual || {};
    // Idempotency: if we've already accrued this scope for this period, skip
    if (periodScope && periodKey && lastAccrual[periodScope] === periodKey) {
      console.log(`   ⏭️  Skipping accrual for ${leaveTypeName} (${periodScope}:${periodKey}) - already applied for employee ${empId}`);
      return;
    }
    
    const currentBalance = parseFloat(types[idx].balance) || 0;
    let newBalance = currentBalance + daysToAdd;
    
    if (maxElapsedDays && newBalance > maxElapsedDays) {
      newBalance = maxElapsedDays;
      console.log(`   ⚠️  Capped balance for ${leaveTypeName} at maxElapsedDays: ${maxElapsedDays}`);
    }
    
    types[idx].balance = newBalance;
    if (periodScope && periodKey) {
      types[idx].lastAccrual = { ...lastAccrual, [periodScope]: periodKey };
    }
    console.log(`   💰 Updated balance for employee ${empId}: ${leaveTypeName} ${currentBalance} → ${newBalance} ${unit}`);
  } else {
    const initialBalance = maxElapsedDays ? Math.min(daysToAdd, maxElapsedDays) : daysToAdd;
    const lastAccrual = (periodScope && periodKey) ? { [periodScope]: periodKey } : undefined;
    types.push({
      leaveTypeId,
      name: leaveTypeName,
      unit,
      balance: initialBalance,
      ...(lastAccrual ? { lastAccrual } : {})
    });
    console.log(`   ➕ Added new leave type for employee ${empId}: ${leaveTypeName} = ${initialBalance} ${unit}`);
  }

  await EmployeeLeaveBalance.findByIdAndUpdate(
    balanceDoc._id,
    { $set: { leaveTypes: types } },
    { new: true }
  );
};

const resetEmployeeBalance = async ({ companyId, empId, leaveType }) => {
  const leaveTypeId = String(leaveType._id);
  const carryOverExpiry = leaveType.carryOver?.carryOverExpiry || false;
  const maxCarryDays = parseInt(leaveType.carryOver?.maxDays) || 0;
  const baseBalance = parseFloat(leaveType.balanceBasedOn) || 0;

  const balanceDoc = await EmployeeLeaveBalance.findOne({ companyId, empId });
  if (!balanceDoc) return;

  const types = Array.isArray(balanceDoc.leaveTypes) ? balanceDoc.leaveTypes : [];
  const idx = types.findIndex(t => String(t.leaveTypeId) === leaveTypeId);
  
  if (idx >= 0) {
    const currentBalance = parseFloat(types[idx].balance) || 0;
    
    if (carryOverExpiry && maxCarryDays > 0) {
      const carriedBalance = Math.min(currentBalance, maxCarryDays);
      types[idx].balance = carriedBalance;
      console.log(`   🔄 Carried forward ${leaveType.name} for ${empId}: ${currentBalance} → ${carriedBalance} (max: ${maxCarryDays})`);
    } else {
      types[idx].balance = baseBalance;
      console.log(`   🔄 Reset ${leaveType.name} for ${empId}: ${currentBalance} → ${baseBalance}`);
    }

    await EmployeeLeaveBalance.findByIdAndUpdate(
      balanceDoc._id,
      { $set: { leaveTypes: types } },
      { new: true }
    );
  }
};

const accrueForCompany = async (now, companyId) => {
  console.log(`\n🏢 Starting leave accrual for Company ID: ${companyId}`);
  
  const employees = await EmployeeModel.find({ 
    companyId, 
    'employmentInformation.status': 'Active' 
  }).select('_id personalInformation employmentInformation').lean();
  
  if (!employees.length) {
    console.log(`❌ No active employees found for company ${companyId}`);
    return;
  }

  console.log(`👥 Found ${employees.length} active employees in company ${companyId}`);

  const leaveTypes = await LeaveTypeModel.find({ companyId, status: 'active' }).lean();
  if (!leaveTypes.length) {
    console.log(`❌ No active leave types found for company ${companyId}`);
    return;
  }

  console.log(`📋 Found ${leaveTypes.length} active leave types for company ${companyId}`);

  let totalEmployeesProcessed = 0;
  let totalLeavesAdded = 0;
  let totalCarryForwards = 0;

  for (const leaveType of leaveTypes) {
    const auto = leaveType.autoAddLeaves || {};
    const enabled = !!auto.enabled;
    const addDays = parseFloat(auto.days) || 0;
    const isHourly = auto.type === 'hourly';
    const isMonthly = auto.type === 'monthly';
    const isYearly = auto.type === 'yearly';

    const shouldDoHourly = enabled && isHourly && isHourStart(now);
    const shouldDoMonthly = enabled && isMonthly && isMonthStart(now);
    const shouldDoYearly = enabled && isYearly && isFinancialYearStartForType(now, leaveType);
    const shouldDoCarryReset = isFinancialYearStartForType(now, leaveType);

    if (!shouldDoHourly && !shouldDoMonthly && !shouldDoYearly && !shouldDoCarryReset) {
      console.log(`⏭️  Skipping ${leaveType.name} - no scheduled operations`);
      continue;
    }

    console.log(`\n🔄 Processing Leave Type: "${leaveType.name}" (ID: ${leaveType._id})`);
    console.log(`   📊 Auto-add enabled: ${enabled}`);
    console.log(`   📅 Type: ${auto.type || 'none'}`);
    console.log(`   📈 Days to add: ${addDays}`);
    console.log(`   ⏰ Operations: ${shouldDoHourly ? 'HOURLY ' : ''}${shouldDoMonthly ? 'MONTHLY ' : ''}${shouldDoYearly ? 'YEARLY ' : ''}${shouldDoCarryReset ? 'CARRY-FORWARD' : ''}`);

    let employeesProcessedForType = 0;
    let leavesAddedForType = 0;
    let carryForwardsForType = 0;

    for (const emp of employees) {
      const empId = String(emp._id);
      const empName = emp.personalInformation?.firstName && emp.personalInformation?.lastName 
        ? `${emp.personalInformation.firstName} ${emp.personalInformation.lastName}`
        : `Employee ${empId}`;
      
      const ok = await isEmployeeEligibleForLeaveType(emp, leaveType);
      if (!ok) {
        console.log(`   ⚠️  ${empName} (${empId}) - Not eligible for ${leaveType.name}`);
        continue;
      }

      employeesProcessedForType++;

      if (shouldDoCarryReset) {
        await resetEmployeeBalance({ companyId, empId, leaveType });
        carryForwardsForType++;
        console.log(`   🔄 ${empName} (${empId}) - Carry-forward/reset processed`);
      }

      if (shouldDoHourly && addDays > 0) {
        const periodScope = 'hourly';
        const periodKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}`;
        await addToEmployeeBalance({ companyId, empId, leaveType, daysToAdd: addDays, periodScope, periodKey });
        leavesAddedForType++;
        console.log(`   ✅ ${empName} (${empId}) - Added ${addDays} ${leaveType.name} (HOURLY)`);
      }

      if (shouldDoMonthly && addDays > 0) {
        const periodScope = 'monthly';
        const periodKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        await addToEmployeeBalance({ companyId, empId, leaveType, daysToAdd: addDays, periodScope, periodKey });
        leavesAddedForType++;
        console.log(`   ✅ ${empName} (${empId}) - Added ${addDays} ${leaveType.name} (MONTHLY)`);
      }

      if (shouldDoYearly && addDays > 0) {
        const periodScope = 'yearly';
        const periodKey = `${now.getFullYear()}`;
        await addToEmployeeBalance({ companyId, empId, leaveType, daysToAdd: addDays, periodScope, periodKey });
        leavesAddedForType++;
        console.log(`   ✅ ${empName} (${empId}) - Added ${addDays} ${leaveType.name} (YEARLY)`);
      }
    }

    console.log(`   📊 Summary for ${leaveType.name}:`);
    console.log(`      👥 Employees processed: ${employeesProcessedForType}`);
    console.log(`      ✅ Leaves added: ${leavesAddedForType}`);
    console.log(`      🔄 Carry-forwards: ${carryForwardsForType}`);

    totalEmployeesProcessed += employeesProcessedForType;
    totalLeavesAdded += leavesAddedForType;
    totalCarryForwards += carryForwardsForType;

    await sleep(25);
  }

  console.log(`\n🏁 Company ${companyId} Processing Complete:`);
  console.log(`   👥 Total employees processed: ${totalEmployeesProcessed}`);
  console.log(`   ✅ Total leaves added: ${totalLeavesAdded}`);
  console.log(`   🔄 Total carry-forwards: ${totalCarryForwards}`);
};

const runAccrualCycle = async (overrideNow) => {
  try {
    console.log(`\n🚀 ===== LEAVE ACCRUAL CYCLE STARTED =====`);
    console.log(`⏰ Timestamp: ${new Date().toISOString()}`);
    console.log(`📅 Date: ${new Date().toLocaleDateString()}`);
    console.log(`🕐 Time: ${new Date().toLocaleTimeString()}`);
    
    const now = overrideNow || new Date();
    if (overrideNow) {
      console.log(`\n⚠️  USING REQUESTED DATE: ${now.toISOString()}`);
      console.log(`📅 Processing as: ${now.toLocaleDateString()}`);
    } else {
      console.log(`\n📅 No date provided, using current date/time`);
      console.log(`📅 Processing as: ${now.toLocaleDateString()}`);
    }
    
    const companies = await CompanyModel.find({ status: 'Active' }).select('_id companyEntityName').lean();
    
    console.log(`\n🏢 Found ${companies.length} active companies to process`);
    
    let totalCompaniesProcessed = 0;
    
    for (const company of companies) {
      if (!company._id) continue;
      totalCompaniesProcessed++;
      console.log(`\n📋 Processing Company: ${company.companyEntityName} (ID: ${company._id})`);
      await accrueForCompany(now, company._id);
    }
    
    console.log(`\n🎉 ===== LEAVE ACCRUAL CYCLE COMPLETED =====`);
    console.log(`⏰ Completed at: ${new Date().toISOString()}`);
    console.log(`📊 Final Summary:`);
    console.log(`   🏢 Companies processed: ${totalCompaniesProcessed}`);
    console.log(`==========================================\n`);
  } catch (e) {
    console.error('❌ Leave accrual cycle failed:', e);
    console.error('Stack trace:', e.stack);
  }
};

// Main execution
async function main() {
  try {
    console.log('🔌 Connecting to database...');
    
    // Connect to MongoDB
    await mongoose.connect(environment.DATABASE_URL, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      tls: true,
    });
    
    console.log('✅ Database connected successfully!');
    console.log('🎯 Starting manual leave accrual...\n');
    
    const requestedDate = parseRequestedDateFromArgs();
    if (requestedDate) {
      console.log(`🗓️ Requested run date: ${requestedDate.toISOString()}`);
    } else {
      console.log('🗓️ No --month/--date provided; defaulting to current date/time');
    }
    
    // Run the accrual cycle
    await runAccrualCycle(requestedDate);
    
    console.log('\n✅ Manual leave accrual completed successfully!');
    console.log('🔌 Closing database connection...');
    
    await mongoose.connection.close();
    console.log('✅ Database connection closed.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error running manual leave accrual:', error);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

// Run the script
main();

