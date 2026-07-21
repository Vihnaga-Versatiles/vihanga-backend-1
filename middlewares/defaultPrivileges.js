function getDefaultPrivileges(companyId) {
  const employeePrivileges = {
    "active": true,
    "role": "Employee",
    "description": "Employee Privileges",
    "privileges": [
      {
        "view": true,
        "edit": false,
        "delete": false,
        "page": "Birthday Widget",
        "category": "Employees"
      },
      {
        "view": true,
        "edit": false,
        "delete": false,
        "page": "Anniversary Widget",
        "category": "Employees"
      },
      {
        "view": true,
        "edit": false,
        "delete": false,
        "page": "Dashboards",
        "category": "Employees"
      },
      {
        "view": true,
        "edit": false,
        "delete": false,
        "page": "Rewards",
        "category": "Employees"
      },
      {
        "view": true,
        "edit": false,
        "delete": false,
        "page": "Org Chart",
        "category": "Employees"
      },
      {
        "view": true,
        "edit": false,
        "delete": true,
        "page": "Objectives",
        "category": "Employees"
      },
      {
        "view": true,
        "edit": false,
        "delete": false,
        "page": "Key Results",
        "category": "Employees"
      },
      {
        "view": false,
        "edit": false,
        "delete": false,
        "page": "Roles and Privileges",
        "category": "Employees"
      },
      {
        "view": true,
        "edit": false,
        "delete": false,
        "page": "Dashboard - Leaderboard",
        "category": "Employees"
      },
      {
        "view": true,
        "edit": false,
        "delete": false,
        "page": "Dashboard - Tasks",
        "category": "Employees"
      },
      {
        "view": true,
        "edit": false,
        "delete": false,
        "page": "Dashboard - Reward Points",
        "category": "Employees"
      },
      {
        "view": true,
        "edit": false,
        "delete": false,
        "page": "Dashboard - Achievement",
        "category": "Employees"
      },
      {
        "view": true,
        "edit": false,
        "delete": false,
        "page": "Dashboard - OKR Progress",
        "category": "Employees"
      },
      {
        "view": true,
        "edit": false,
        "delete": false,
        "page": "Dashboard - Remaining vs Achieved",
        "category": "Employees"
      },
      {
        "view": true,
        "edit": false,
        "delete": false,
        "page": "Dashboard - Estimated vs Actual",
        "category": "Employees"
      },
      {
        "view": true,
        "edit": true,
        "delete": true,
        "page": "Tasks",
        "category": "Goals"
      },
      {
        "view": false,
        "edit": false,
        "delete": false,
        "page": "Cascade Objectives",
        "category": "Goals"
      },
      {
        "view": false,
        "edit": false,
        "delete": false,
        "page": "Reviews",
        "category": "Goals"
      },
      {
        "view": true,
        "edit": false,
        "delete": false,
        "page": "Lock Objectives",
        "category": "Goals"
      },
      {
        "view": true,
        "edit": false,
        "delete": false,
        "page": "Approve Objectives",
        "category": "Goals"
      },
      {
        "view": false,
        "edit": false,
        "delete": false,
        "page": "Reject Objectives",
        "category": "Goals"
      },
      {
        "view": false,
        "edit": false,
        "delete": false,
        "page": "Unlock Objectives",
        "category": "Goals"
      },
      {
        "view": true,
        "edit": true,
        "delete": true,
        "page": "Tasks Drag and Drop",
        "category": "Goals"
      },
      {
        "view": true,
        "edit": true,
        "delete": true,
        "page": "Key Results - Target update once locked",
        "category": "Goals"
      },
      {
        "view": true,
        "edit": true,
        "delete": true,
        "page": "Key Results - Actual, comments update once locked",
        "category": "Goals"
      },
      {
        "view": true,
        "edit": true,
        "delete": true,
        "page": "Update progress on Objectives",
        "category": "Goals"
      },
      {
        "view": false,
        "edit": false,
        "delete": false,
        "page": "Goals",
        "category": "Goals"
      },
      {
        "view": false,
        "edit": false,
        "delete": false,
        "page": "Sessions",
        "category": "Goals"
      }
    ],
    "companyId": companyId,
  }
  const managerPrivileges = {
    "active": true,
    "role": "Manager",
    "description": "Manager Privileges",
    "privileges": [
      {
        "view": true,
        "edit": true,
        "delete": false,
        "page": "Birthday Widget",
        "category": "Employees"
      },
      {
        "view": true,
        "edit": true,
        "delete": false,
        "page": "Anniversary Widget",
        "category": "Employees"
      },
      {
        "view": true,
        "edit": true,
        "delete": false,
        "page": "Dashboards",
        "category": "Employees"
      },
      {
        "view": true,
        "edit": true,
        "delete": false,
        "page": "Rewards",
        "category": "Employees"
      },
      {
        "view": true,
        "edit": true,
        "delete": false,
        "page": "Org Chart",
        "category": "Employees"
      },
      {
        "view": true,
        "edit": true,
        "delete": false,
        "page": "Objectives",
        "category": "Employees"
      },
      {
        "view": true,
        "edit": true,
        "delete": false,
        "page": "Key Results",
        "category": "Employees"
      },
      {
        "view": false,
        "edit": false,
        "delete": false,
        "page": "Roles and Privileges",
        "category": "Employees"
      },
      {
        "view": true,
        "edit": true,
        "delete": false,
        "page": "Dashboard - Leaderboard",
        "category": "Employees"
      },
      {
        "view": true,
        "edit": true,
        "delete": false,
        "page": "Dashboard - Tasks",
        "category": "Employees"
      },
      {
        "view": true,
        "edit": true,
        "delete": false,
        "page": "Dashboard - Reward Points",
        "category": "Employees"
      },
      {
        "view": true,
        "edit": true,
        "delete": false,
        "page": "Dashboard - Achievement",
        "category": "Employees"
      },
      {
        "view": true,
        "edit": true,
        "delete": false,
        "page": "Dashboard - OKR Progress",
        "category": "Employees"
      },
      {
        "view": true,
        "edit": true,
        "delete": false,
        "page": "Dashboard - Remaining vs Achieved",
        "category": "Employees"
      },
      {
        "view": true,
        "edit": true,
        "delete": false,
        "page": "Dashboard - Estimated vs Actual",
        "category": "Employees"
      },
      {
        "view": true,
        "edit": true,
        "delete": true,
        "page": "Tasks",
        "category": "Goals"
      },
      {
        "view": true,
        "edit": true,
        "delete": true,
        "page": "Cascade Objectives",
        "category": "Goals"
      },
      {
        "view": false,
        "edit": false,
        "delete": false,
        "page": "Reviews",
        "category": "Goals"
      },
      {
        "view": true,
        "edit": true,
        "delete": true,
        "page": "Lock Objectives",
        "category": "Goals"
      },
      {
        "view": true,
        "edit": true,
        "delete": true,
        "page": "Approve Objectives",
        "category": "Goals"
      },
      {
        "view": true,
        "edit": true,
        "delete": true,
        "page": "Reject Objectives",
        "category": "Goals"
      },
      {
        "view": true,
        "edit": true,
        "delete": true,
        "page": "Unlock Objectives",
        "category": "Goals"
      },
      {
        "view": true,
        "edit": true,
        "delete": true,
        "page": "Tasks Drag and Drop",
        "category": "Goals"
      },
      {
        "view": true,
        "edit": true,
        "delete": true,
        "page": "Key Results - Target update once locked",
        "category": "Goals"
      },
      {
        "view": true,
        "edit": true,
        "delete": true,
        "page": "Key Results - Actual, comments update once locked",
        "category": "Goals"
      },
      {
        "view": true,
        "edit": true,
        "delete": true,
        "page": "Update progress on Objectives",
        "category": "Goals"
      },
      {
        "view": false,
        "edit": false,
        "delete": false,
        "page": "Goals",
        "category": "Goals"
      },
      {
        "view": false,
        "edit": false,
        "delete": false,
        "page": "Sessions",
        "category": "Goals"
      }
    ],
    "companyId": companyId,
  }
  const hrPrivileges = {
    "active": true,
    "role": "HR Admin",
    "description": "HR Admin Privileges",
    "privileges": [
      {
        "view": true,
        "edit": false,
        "delete": false,
        "page": "Birthday Widget",
        "category": "Employees"
      },
      {
        "view": true,
        "edit": false,
        "delete": false,
        "page": "Anniversary Widget",
        "category": "Employees"
      },
      {
        "view": true,
        "edit": false,
        "delete": false,
        "page": "Dashboards",
        "category": "Employees"
      },
      {
        "view": true,
        "edit": false,
        "delete": false,
        "page": "Rewards",
        "category": "Employees"
      },
      {
        "view": true,
        "edit": false,
        "delete": false,
        "page": "Org Chart",
        "category": "Employees"
      },
      {
        "view": true,
        "edit": true,
        "delete": true,
        "page": "Objectives",
        "category": "Employees"
      },
      {
        "view": true,
        "edit": true,
        "delete": true,
        "page": "Key Results",
        "category": "Employees"
      },
      {
        "view": false,
        "edit": false,
        "delete": false,
        "page": "Roles and Privileges",
        "category": "Employees"
      },
      {
        "view": true,
        "edit": false,
        "delete": false,
        "page": "Dashboard - Leaderboard",
        "category": "Employees"
      },
      {
        "view": true,
        "edit": false,
        "delete": false,
        "page": "Dashboard - Tasks",
        "category": "Employees"
      },
      {
        "view": true,
        "edit": false,
        "delete": false,
        "page": "Dashboard - Reward Points",
        "category": "Employees"
      },
      {
        "view": true,
        "edit": false,
        "delete": false,
        "page": "Dashboard - Achievement",
        "category": "Employees"
      },
      {
        "view": true,
        "edit": false,
        "delete": false,
        "page": "Dashboard - OKR Progress",
        "category": "Employees"
      },
      {
        "view": true,
        "edit": false,
        "delete": false,
        "page": "Dashboard - Remaining vs Achieved",
        "category": "Employees"
      },
      {
        "view": true,
        "edit": false,
        "delete": false,
        "page": "Dashboard - Estimated vs Actual",
        "category": "Employees"
      },
      {
        "view": true,
        "edit": true,
        "delete": true,
        "page": "Tasks",
        "category": "Goals"
      },
      {
        "view": true,
        "edit": true,
        "delete": true,
        "page": "Cascade Objectives",
        "category": "Goals"
      },
      {
        "view": true,
        "edit": true,
        "delete": true,
        "page": "Reviews",
        "category": "Goals"
      },
      {
        "view": true,
        "edit": true,
        "delete": true,
        "page": "Lock Objectives",
        "category": "Goals"
      },
      {
        "view": true,
        "edit": true,
        "delete": true,
        "page": "Approve Objectives",
        "category": "Goals"
      },
      {
        "view": true,
        "edit": true,
        "delete": true,
        "page": "Reject Objectives",
        "category": "Goals"
      },
      {
        "view": true,
        "edit": true,
        "delete": true,
        "page": "Unlock Objectives",
        "category": "Goals"
      },
      {
        "view": true,
        "edit": true,
        "delete": true,
        "page": "Tasks Drag and Drop",
        "category": "Goals"
      },
      {
        "view": true,
        "edit": true,
        "delete": true,
        "page": "Key Results - Target update once locked",
        "category": "Goals"
      },
      {
        "view": true,
        "edit": true,
        "delete": true,
        "page": "Key Results - Actual, comments update once locked",
        "category": "Goals"
      },
      {
        "view": true,
        "edit": true,
        "delete": true,
        "page": "Update progress on Objectives",
        "category": "Goals"
      },
      {
        "view": true,
        "edit": true,
        "delete": true,
        "page": "Goals",
        "category": "Goals"
      },
      {
        "view": true,
        "edit": true,
        "delete": true,
        "page": "Sessions",
        "category": "Goals"
      },
      {
        "view": true,
        "edit": false,
        "delete": false,
        "page": "Error Logs",
        "category": "Previleges"
      }
    ],
    "companyId": companyId
  }
  const superAdminPrivileges = {
    "active": true,
    "role": "Super Admin",
    "description": "Super Admin Privileges",
    "privileges": [
      {
        "view": true,
        "edit": true,
        "delete": true,
        "page": "Birthday Widget",
        "category": "Employees"
      },
      {
        "view": true,
        "edit": true,
        "delete": true,
        "page": "Anniversary Widget",
        "category": "Employees"
      },
      {
        "view": true,
        "edit": true,
        "delete": true,
        "page": "Dashboards",
        "category": "Employees"
      },
      {
        "view": true,
        "edit": true,
        "delete": true,
        "page": "Rewards",
        "category": "Employees"
      },
      {
        "view": true,
        "edit": true,
        "delete": true,
        "page": "Org Chart",
        "category": "Employees"
      },
      {
        "view": true,
        "edit": true,
        "delete": true,
        "page": "Objectives",
        "category": "Employees"
      },
      {
        "view": true,
        "edit": true,
        "delete": true,
        "page": "Key Results",
        "category": "Employees"
      },
      {
        "view": true,
        "edit": true,
        "delete": true,
        "page": "Roles and Privileges",
        "category": "Employees"
      },
      {
        "view": true,
        "edit": true,
        "delete": true,
        "page": "Dashboard - Leaderboard",
        "category": "Employees"
      },
      {
        "view": true,
        "edit": true,
        "delete": true,
        "page": "Dashboard - Tasks",
        "category": "Employees"
      },
      {
        "view": true,
        "edit": true,
        "delete": true,
        "page": "Dashboard - Reward Points",
        "category": "Employees"
      },
      {
        "view": true,
        "edit": true,
        "delete": true,
        "page": "Dashboard - Achievement",
        "category": "Employees"
      },
      {
        "view": true,
        "edit": true,
        "delete": true,
        "page": "Dashboard - OKR Progress",
        "category": "Employees"
      },
      {
        "view": true,
        "edit": true,
        "delete": true,
        "page": "Dashboard - Remaining vs Achieved",
        "category": "Employees"
      },
      {
        "view": true,
        "edit": true,
        "delete": true,
        "page": "Dashboard - Estimated vs Actual",
        "category": "Employees"
      },
      {
        "view": true,
        "edit": true,
        "delete": true,
        "page": "Tasks",
        "category": "Goals"
      },
      {
        "view": true,
        "edit": true,
        "delete": true,
        "page": "Cascade Objectives",
        "category": "Goals"
      },
      {
        "view": true,
        "edit": true,
        "delete": true,
        "page": "Reviews",
        "category": "Goals"
      },
      {
        "view": true,
        "edit": true,
        "delete": true,
        "page": "Lock Objectives",
        "category": "Goals"
      },
      {
        "view": true,
        "edit": true,
        "delete": true,
        "page": "Approve Objectives",
        "category": "Goals"
      },
      {
        "view": true,
        "edit": true,
        "delete": true,
        "page": "Reject Objectives",
        "category": "Goals"
      },
      {
        "view": true,
        "edit": true,
        "delete": true,
        "page": "Unlock Objectives",
        "category": "Goals"
      },
      {
        "view": true,
        "edit": true,
        "delete": true,
        "page": "Tasks Drag and Drop",
        "category": "Goals"
      },
      {
        "view": true,
        "edit": true,
        "delete": true,
        "page": "Key Results - Target update once locked",
        "category": "Goals"
      },
      {
        "view": true,
        "edit": true,
        "delete": true,
        "page": "Key Results - Actual, comments update once locked",
        "category": "Goals"
      },
      {
        "view": true,
        "edit": true,
        "delete": true,
        "page": "Update progress on Objectives",
        "category": "Goals"
      },
      {
        "view": true,
        "edit": true,
        "delete": true,
        "page": "Goals",
        "category": "Goals"
      },
      {
        "view": true,
        "edit": true,
        "delete": true,
        "page": "Sessions",
        "category": "Goals"
      },
      {
        "view": true,
        "edit": true,
        "delete": true,
        "page": "Error Logs",
        "category": "Previleges"
      }
    ],
    "companyId": companyId
  };

  const defaultPrivileges = [employeePrivileges, managerPrivileges, hrPrivileges, superAdminPrivileges];
  return defaultPrivileges;
}
module.exports = {
  getDefaultPrivileges
}