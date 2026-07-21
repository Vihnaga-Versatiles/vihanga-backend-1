const { totalRewardPoints, percentageCalculation, totalSum } = require("./percentageCalculation");

const getProgressPercent = (progressStatus = 0, weight = 0, OriginalObjWeight = 0) => {
  return OriginalObjWeight > 0 ? progressStatus * weight / OriginalObjWeight : 0;
}


let previousHue = null;
const getRandomBarColor = () => {
  const minHueDifference = 60;
  let newHue;

  do {
    newHue = Math.floor(Math.random() * 360); // Generate a random hue (0-359)
  } while (previousHue !== null && Math.abs(newHue - previousHue) < minHueDifference);

  previousHue = newHue;
  return `hsl(${newHue}, 70%, 50%)`; // Fixed saturation and lightness for vibrancy
}

function getObjectivePercentage(objectives, employees, tasks, rewards, krAchievementPercent, krAchievementPoints, keyResults, AllObjectives, privilegesManager, keyResultsFilter) {
  //check manager privilege enabled or not.
  const allPrivileges = privilegesManager.length > 0 ? privilegesManager.map(item => item.privileges) : [];
  const managerPrivilege = allPrivileges.length > 0 ? (allPrivileges[0].filter(item => item.category === "Goals" && item.page === "Update Manager Progress For Cascaded").length > 0 ? allPrivileges[0].filter(item => item.category === "Goals" && item.page === "Update Manager Progress For Cascaded")[0].edit : false) : false;
  let result = objectives.map((objective) => {
    let newObj = { ...objective._doc };
    newObj.employeeNumber = employees.find(employee => employee._id == newObj.employeeReferenceId) ?
      employees.find(employee => employee._id == newObj.employeeReferenceId).employmentInformation.employeeNumber : "";
    
    // Add ownerName based on owner ID - ensure it's always a proper name
    let ownerName = '';
    if (newObj.owner) {
      const ownerEmployee = employees.find(employee => employee._id == newObj.owner);
      if (ownerEmployee && ownerEmployee.personalInformation) {
        ownerName = `${ownerEmployee.personalInformation.firstName || ''} ${ownerEmployee.personalInformation.lastName || ''}`.trim();
      } else {
        // If owner employee not found, try to find by employeeReferenceId as fallback
        const fallbackEmployee = employees.find(employee => employee._id == newObj.employeeReferenceId);
        if (fallbackEmployee && fallbackEmployee.personalInformation) {
          ownerName = `${fallbackEmployee.personalInformation.firstName || ''} ${fallbackEmployee.personalInformation.lastName || ''}`.trim();
        } else {
          // Last fallback - use employeeName if available
          ownerName = newObj.employeeName || 'Unknown Owner';
        }
      }
    } else {
      // If no owner, use employeeName as fallback
      ownerName = newObj.employeeName || 'Unknown Owner';
    }
    newObj.ownerName = ownerName;
    
    newObj.children = keyResults
      .filter((item) => item.objectiveId == objective._id.toString())
      .map((item) => {
        let percent = percentageCalculation(item);
        let rewardPoints = item.approvalRequired ? 0 : totalRewardPoints(percent, krAchievementPercent, krAchievementPoints, newObj);
        return {
          ...item._doc,
          percent: (percent == "NaN" || percent == null) ? 0 : percent,
          owner: objective._doc.employeeName,
          // Add ownerName for children level
          ownerName: newObj.ownerName,
          profilePicture : employees.find(employee => objective._doc.employeeName.includes(employee?.personalInformation?.firstName)) ?
            employees.find(employee => objective._doc.employeeName.includes(employee?.personalInformation?.firstName))?.personalInformation?.profilePicture : "https://www.clipartmax.com/png/middle/103-1038880_user-rubber-stamp-female-user-icon.png",
          rewardPoints,
          objective: objective._doc.objective,
          objectiveId: item.objectiveId,
          children: tasks.filter(itemTask => itemTask._doc.krReferenceId == item._doc._id).map(itemTask => {
            // Add assignee based on assignTo field
            let assigneeNames = [];
            if (itemTask._doc.assignTo && Array.isArray(itemTask._doc.assignTo)) {
              assigneeNames = itemTask._doc.assignTo.map(assignToId => {
                const assigneeEmployee = employees.find(employee => employee._id == assignToId);
                if (assigneeEmployee && assigneeEmployee.personalInformation) {
                  return `${assigneeEmployee.personalInformation.firstName || ''} ${assigneeEmployee.personalInformation.lastName || ''}`.trim();
                }
                return assignToId; // Fallback to ID if employee not found
              });
            } else if (itemTask._doc.assignTo) {
              const assigneeEmployee = employees.find(employee => employee._id == itemTask._doc.assignTo);
              if (assigneeEmployee && assigneeEmployee.personalInformation) {
                assigneeNames = [`${assigneeEmployee.personalInformation.firstName || ''} ${assigneeEmployee.personalInformation.lastName || ''}`.trim()];
              } else {
                assigneeNames = [itemTask._doc.assignTo]; // Fallback to ID if employee not found
              }
            }
            
            return {
              ...itemTask._doc,
              assignee: assigneeNames,
              profilePicture : employees.find(employee => objective._doc.employeeName.includes(employee?.personalInformation?.firstName)) ?
              employees.find(employee => objective._doc.employeeName.includes(employee?.personalInformation?.firstName))?.personalInformation?.profilePicture : "https://www.clipartmax.com/png/middle/103-1038880_user-rubber-stamp-female-user-icon.png"
            };
          })
        };
      });
      newObj.profilePicture = employees.find(employee => newObj.owner.includes(employee?.personalInformation?.firstName)) ?
        employees.find(employee => newObj.owner.includes(employee?.personalInformation?.firstName))?.personalInformation?.profilePicture : "https://www.clipartmax.com/png/middle/103-1038880_user-rubber-stamp-female-user-icon.png";
    newObj.progressStatus =
      newObj.children.length > 0
        ? Math.min(100, Math.round(totalSum(newObj.children, "percent") / newObj.children.length))
        : (newObj.progressStatus > 0 ? Math.min(100, newObj.progressStatus) : "0");
    let objectivesAchievementPercent = rewards.length > 0 ? rewards[0].objectivesAchievementPercent : 0;
    let objectivesAchievementPoints = rewards.length > 0 ? rewards[0].objectivesAchievementPoints : 0;
    let rewardPoints = newObj.approvalRequired ? 0 : totalRewardPoints(newObj.progressStatus, objectivesAchievementPercent, objectivesAchievementPoints, newObj);
    newObj.rewardPoints = rewardPoints;
    return newObj;
  });
  if (managerPrivilege) {
    result = result.map(objective => {
      //if manager cascaded team enabled.
      let filterData = AllObjectives.filter(item => item.cascadedObjectiveId == objective._id.toString() && item.userType !== 'Testing');
      if (filterData.length > 0) {
        filterData = filterData.map(objective => {
          let newObj = { ...objective._doc };
          
          // Add ownerName based on owner ID for cascaded objectives - ensure it's always a proper name
          let ownerName = '';
          if (newObj.owner) {
            const ownerEmployee = employees.find(employee => employee._id == newObj.owner);
            if (ownerEmployee && ownerEmployee.personalInformation) {
              ownerName = `${ownerEmployee.personalInformation.firstName || ''} ${ownerEmployee.personalInformation.lastName || ''}`.trim();
            } else {
              // If owner employee not found, try to find by employeeReferenceId as fallback
              const fallbackEmployee = employees.find(employee => employee._id == newObj.employeeReferenceId);
              if (fallbackEmployee && fallbackEmployee.personalInformation) {
                ownerName = `${fallbackEmployee.personalInformation.firstName || ''} ${fallbackEmployee.personalInformation.lastName || ''}`.trim();
              } else {
                // Last fallback - use employeeName if available
                ownerName = newObj.employeeName || 'Unknown Owner';
              }
            }
          } else {
            // If no owner, use employeeName as fallback
            ownerName = newObj.employeeName || 'Unknown Owner';
          }
          newObj.ownerName = ownerName;
          
          newObj.children = keyResultsFilter
            .filter((item) => item.objectiveId == objective._id.toString())
            .map((item) => {
              let percent = percentageCalculation(item);
              let rewardPoints = item.approvalRequired ? 0 : totalRewardPoints(percent, krAchievementPercent, krAchievementPoints, newObj);
              return {
                ...item._doc,
                percent: (percent == "NaN" || percent == null) ? 0 : percent,
                owner: objective._doc.employeeName,
                // Add ownerName for children level in cascaded objectives
                ownerName: newObj.ownerName,
                profilePicture : employees.find(employee => objective._doc.employeeName.includes(employee?.personalInformation?.firstName)) ?
                employees.find(employee => objective._doc.employeeName.includes(employee?.personalInformation?.firstName))?.personalInformation?.profilePicture : "https://www.clipartmax.com/png/middle/103-1038880_user-rubber-stamp-female-user-icon.png",
                rewardPoints,
                objective: objective._doc.objective,
                objectiveId: item.objectiveId,
                children: tasks.filter(itemTask => itemTask._doc.krReferenceId == item._doc._id).map(itemTask => {
                  // Add assignee based on assignTo field for cascaded objectives
                  let assigneeNames = [];
                  if (itemTask._doc.assignTo && Array.isArray(itemTask._doc.assignTo)) {
                    assigneeNames = itemTask._doc.assignTo.map(assignToId => {
                      const assigneeEmployee = employees.find(employee => employee._id == assignToId);
                      if (assigneeEmployee && assigneeEmployee.personalInformation) {
                        return `${assigneeEmployee.personalInformation.firstName || ''} ${assigneeEmployee.personalInformation.lastName || ''}`.trim();
                      }
                      return assignToId; // Fallback to ID if employee not found
                    });
                  } else if (itemTask._doc.assignTo) {
                    const assigneeEmployee = employees.find(employee => employee._id == itemTask._doc.assignTo);
                    if (assigneeEmployee && assigneeEmployee.personalInformation) {
                      assigneeNames = [`${assigneeEmployee.personalInformation.firstName || ''} ${assigneeEmployee.personalInformation.lastName || ''}`.trim()];
                    } else {
                      assigneeNames = [itemTask._doc.assignTo]; // Fallback to ID if employee not found
                    }
                  }
                  
                  return {
                    ...itemTask._doc,
                    assignee: assigneeNames,
                    profilePicture : employees.find(employee => objective._doc.employeeName.includes(employee?.personalInformation?.firstName)) ?
                    employees.find(employee => objective._doc.employeeName.includes(employee?.personalInformation?.firstName))?.personalInformation?.profilePicture : "https://www.clipartmax.com/png/middle/103-1038880_user-rubber-stamp-female-user-icon.png",
                  };
                })
              };
            });
          newObj.progressStatus = newObj.children.length > 0
            ? Math.min(100, Math.round(totalSum(newObj.children, "percent") / newObj.children.length))
            : (newObj.progressStatus > 0 ? Math.min(100, newObj.progressStatus) : "0")
          return newObj;
        });
      }
      let IndividualProgress = [];
      let avgPercentage = 0;
      let eachPercentage = [];
      let IndividualNames = [];
      let randomColors = [];
      if (objective.weight === 1) {
        IndividualProgress = filterData.length > 0 ? filterData.map(item => item.progressStatus) : [];
        avgPercentage = IndividualProgress.length > 0 ? IndividualProgress.reduce((a, b) => a + b, 0) / IndividualProgress.length : 0;
        eachPercentage = filterData.length > 0 ? filterData.map(item => item.progressStatus / IndividualProgress.length) : [];
      } else {
        IndividualProgress = filterData.length > 0 ? filterData.map(item => getProgressPercent(item.progressStatus, item.weight, objective.weight)) : [];
        avgPercentage = IndividualProgress.length > 0 ? IndividualProgress.reduce((a, b) => a + b, 0) : 0;
        eachPercentage = filterData.length > 0 ? filterData.map(item => getProgressPercent(item.progressStatus, item.weight, objective.weight)) : [];
      }
      IndividualNames = filterData.length > 0 ? filterData.map(item => item.employeeName) : [];
      randomColors = eachPercentage.length > 0 ? eachPercentage.map(() => getRandomBarColor()) : [];
      //add previous percentage to next percentage
      for (let i = 0; i < eachPercentage.length; i++) {
        if (i > 0) {
          eachPercentage[i] = eachPercentage[i] + eachPercentage[i - 1];
        }
      }
      objective.progressStatus = avgPercentage > 0 ? Number.isInteger(avgPercentage) ? avgPercentage : parseFloat(avgPercentage).toFixed(2) : Number.isInteger(objective.progressStatus) ? objective.progressStatus : parseFloat(objective.progressStatus).toFixed(2);
      objective.IndividualProgress = IndividualProgress;
      objective.eachPercentage = eachPercentage;
      objective.IndividualNames = IndividualNames;
      objective.randomColors = randomColors;
      return objective;
    })
  }
  return result;
}

module.exports = {
  getObjectivePercentage
}