const moment = require("moment");
function percentageCalculation(current) {
  let targetProgress = current.target;
  let actualProgress = current.actual;
  
  // Default to positive polarity if not specified
  // Positive polarity: higher actual is better (actual/target * 100)
  // Negative polarity: lower actual is better (target/actual * 100)
  const isNegativePolarity = (current?.polarity)?.toLowerCase() === "negative";
  
  let result;
  if (isNegativePolarity) {
    // Negative polarity: lower actual is better (target/actual * 100)
    // Examples: reduce defects from 10 to 5, reduce costs from 100 to 50
    // target=5, actual=10 → 50% | target=5, actual=5 → 100% | target=5, actual=2 → 100%(capped)
    if (actualProgress <= targetProgress) {
      result = 100;
    } else if (actualProgress === 0) {
      // If actual is 0, we've reduced to zero
      // For negative polarity: if target > 0, actual=0 means we exceeded (100%)
      //                        if target = 0, actual=0 means we met target (100%)
      //                        if target < 0, actual=0 means we exceeded (100%)
      result = 100;
    } else if (targetProgress === 0) {
      // If target is 0 but actual is not 0, we haven't reached target yet
      result = 0;
    } else {
      result = (targetProgress / actualProgress) * 100;
      // For negative polarity, if result is negative (target and actual have different signs)
      // it means we're going in the wrong direction
      result = result < 0 ? 0 : result;
    }
  } else {
    // Positive polarity (default): higher actual is better (actual/target * 100)
    // Examples: increase sales from 0 to 100, increase customers from 50 to 200
    // target=100, actual=50 → 50% | target=100, actual=100 → 100%
    if (targetProgress === 0) {
      // If target is 0, check if actual is also 0 (100% complete) or not (incomplete)
      result = actualProgress === 0 ? 100 : 0;
    } else {
      result = (actualProgress / targetProgress) * 100;
      // For positive polarity, if result is negative, it means we're going in wrong direction
      result = result < 0 ? 0 : result;
    }
  }
  
  // Cap at 100% (can't be more than 100% complete)
  result = Math.min(100, result);
  return Number.isInteger(result) ? result : Number(result).toFixed(2);
}
function totalSum(result, key) {
  return result.length > 0 ? result.reduce((prev, current) => {
    return Number(prev) + Number(current[key])
  }, 0) : 0;
}
function totalRewardPoints(percent = 0, krAchievementPercent = 0, krAchievementPoints = 0, newObj) {
  let rewardPoints = 0;
  if (percent > 0 && krAchievementPercent > 0 && Number(percent) >= Number(krAchievementPercent)) {
    let extraPoints = 0;
    if (Number(percent) > 100) {
      extraPoints = Number(krAchievementPoints) * Number(newObj.weight) / Number(percent);
    }
    totalPercentNormal = Number(krAchievementPoints) * Number(newObj.weight) / Number(krAchievementPercent);
    //extra points
    rewardPoints = Number(totalPercentNormal) + Number(totalPercentNormal - extraPoints);
  }
  return rewardPoints > 0 ? parseFloat(rewardPoints.toFixed(2)) : rewardPoints;
}

function totalRewardPointsTask(percent = 0, krAchievementPercent = 0, krAchievementPoints = 0) {
  let rewardPoints = 0;
  if (percent > 0 && krAchievementPercent > 0 && Number(percent) >= Number(krAchievementPercent)) {
    //if (Number(percent) > 100) {
    //  extraPoints = Number(krAchievementPoints) / Number(percent);
    //}
    totalPercentNormal = Number(krAchievementPoints) * 100 / Number(krAchievementPercent);
    //extra points
    rewardPoints = Number(totalPercentNormal);
  }
  return rewardPoints > 0 ? parseFloat(rewardPoints.toFixed(2)) : rewardPoints;
}

function isValidDate(d) {
  if (d === null || d === undefined || d === "" || d === 0 || d === "0") {
    return false;
  }
  if (d instanceof Date) {
    const time = d.getTime();
    return !isNaN(time) && time !== 0;
  }
  if (typeof d === "number") {
    if (!Number.isFinite(d) || d === 0) return false;
    const time = new Date(d).getTime();
    return !isNaN(time) && time !== 0;
  }
  // Strings / ISO dates
  const parsed = Date.parse(d);
  return !isNaN(parsed) && parsed !== 0;
}

function getDueMessage(task) {
  let dueDateDiff = moment(moment(task.dueDate).format("YYYY-MM-DD")).diff(moment(new Date()).format("YYYY-MM-DD"));
  let duration = moment.duration(dueDateDiff);
  let dueDays = duration.asDays();
  let dueMessage = "";
  if (dueDays > 0) {
    dueMessage = dueDays + " Days Under Due";
  } else if (dueDays < 0) {
    dueMessage = dueDays + " Days Over Due";
  };
  return dueMessage;
}

function removeDuplicates(array) {
  return array.filter((item, index) => array.indexOf(item) === index);
}
module.exports = {
  percentageCalculation,
  totalSum,
  totalRewardPoints,
  isValidDate,
  totalRewardPointsTask,
  getDueMessage,
  removeDuplicates
}