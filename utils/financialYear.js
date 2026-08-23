/**
 * Financial year helpers — aligned with leave type carryOver.carryOverDate.
 * Default FY start: 1 April (same as accrual/carry-forward jobs).
 */

const parseFinancialYearStart = (leaveType) => {
  let month = 3; // April (0-indexed)
  let day = 1;

  const raw = leaveType?.carryOver?.carryOverDate;
  const rawStr = raw != null ? String(raw).trim() : "";

  if (/^\d{4}-\d{2}-\d{2}$/.test(rawStr)) {
    const dt = new Date(`${rawStr}T00:00:00`);
    if (!Number.isNaN(dt.getTime())) {
      month = dt.getMonth();
      day = dt.getDate();
    }
  } else if (rawStr && /^\d{1,2}$/.test(rawStr)) {
    const parsedDay = parseInt(rawStr, 10);
    if (parsedDay >= 1 && parsedDay <= 31) {
      day = parsedDay;
    }
  }

  return { month, day };
};

/**
 * Returns the financial year window that contains referenceDate.
 */
const getFinancialYearBounds = (referenceDate, leaveType) => {
  const ref = referenceDate ? new Date(referenceDate) : new Date();
  if (Number.isNaN(ref.getTime())) {
    ref.setTime(Date.now());
  }
  ref.setHours(0, 0, 0, 0);

  const { month, day } = parseFinancialYearStart(leaveType);

  let startYear = ref.getFullYear();
  const fyStartThisYear = new Date(startYear, month, day, 0, 0, 0, 0);
  if (ref < fyStartThisYear) {
    startYear -= 1;
  }

  const start = new Date(startYear, month, day, 0, 0, 0, 0);
  const nextFyStart = new Date(startYear + 1, month, day, 0, 0, 0, 0);
  const end = new Date(nextFyStart.getTime() - 1);

  return {
    start,
    end,
    label: `${startYear}-${startYear + 1}`,
    startYear,
  };
};

const isFinancialYearStartForType = (now, leaveType) => {
  const { month, day } = parseFinancialYearStart(leaveType);
  return now.getMonth() === month && now.getDate() === day;
};

module.exports = {
  parseFinancialYearStart,
  getFinancialYearBounds,
  isFinancialYearStartForType,
};
