require('dotenv').config();
const connectDB = require('./config/db');

const EmployeeModel = require('./models/employee.model');
const managersData = require('./utils/managers');
const employeesData = require('./utils/employees');
const PrivilegeGroupModel = require('./models/privilegesGroup.model');
const privilegesGroupsData = require('./utils/privilegesGroups');
const PrivilegesModel = require('./models/privileges.model');
const privilegesData = require('./utils/privileges');
const RewardsModel = require('./models/rewards.model');
const rewardsData = require('./utils/rewards');
//const DepartmentModel = require('./models/department.model');
//const departmentsData = require('./utils/departments');
//const DesignationsModels = require('./models/designation.model');
//const designationsData = require('./utils/designations');

connectDB();
const importData = async () => {
  try {
    //await EmployeeModel.deleteMany();
    //await EmployeeModel.insertMany(managersData);
    //await EmployeeModel.insertMany(employeesData);
    //await PrivilegeGroupModel.deleteMany();
    //await PrivilegeGroupModel.insertMany(privilegesGroupsData);
    //await PrivilegesModel.deleteMany();
    //await PrivilegesModel.insertMany(privilegesData);
    //await RewardsModel.deleteMany();
    //await RewardsModel.insertMany(rewardsData);
    console.log('data inserted successfully!');
    process.exit();
  } catch (error) {
    console.log('error', error);
    process.exit(1);
  }
};

importData();
