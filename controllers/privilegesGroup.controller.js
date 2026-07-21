const PrivilegesModel = require("../models/privilegesGroup.model");
const EmployeeModel = require("../models/employee.model");

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

const createPrivilege = async (req, res) => {
  // #swagger.tags = ['Privileges Group']
  try {
    const newKeyResult = new PrivilegesModel(req.body);
    await newKeyResult.save();
    res.status(200).send(
      successResponse({
        message: "Privilege Group Created Successfully!",
      })
    );
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Privilege Group Not Created!",
      })
    );
  }
};

const getAllPrivileges = async (req, res) => {
  // #swagger.tags = ['Privileges Group']
  try {
    const privilegeGroups = await PrivilegesModel.find({ companyId: req.params.companyId }).sort({ _id: -1 });
    const employees = await EmployeeModel.find({ companyId: req.params.companyId, "employmentInformation.status": "Active" }).sort({ _id: -1 });
    res.status(200).send(
      successResponse({
        message: "Privilege Group Retrieved Successfully!",
        data: { privilegeGroups, employees }
      })
    );
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Privilege Group Not Fetched!",
      })
    );
  }
};

const getPrivilege = async (req, res) => {
  // #swagger.tags = ['Privileges Group']
  try {
    const Privileges = await PrivilegesModel.find({ role: req.params.role, companyId: req.params.companyId }).sort({ _id: -1 });
    res.status(200).send(
      successResponse({
        message: "Privilege Group Retrieved Successfully!",
        data: Privileges,
      })
    );
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Privilege Group Not Fetched!",
      })
    );
  }
};

const deletePrivilege = (req, res) => {
  // #swagger.tags = ['Privileges Group']
  PrivilegesModel.findByIdAndRemove({ _id: req.params.id }, (err) => {
    if (!err) {
      res.status(200).send(
        successResponse({
          message: "Privilege Group Deleted Successfully!",
        })
      );
    } else {
      res.status(500).send(
        failResponse({
          message: err ? err.message : "Privilege Group Not Deleted!",
        })
      );
    }
  });
};

const deletePrivilegeMultiple = (req, res) => {
  // #swagger.tags = ['Privileges Group']
  PrivilegesModel.deleteMany({ _id: { $in: req.body.data } }, (err) => {
    if (!err) {
      res.status(200).send(
        successResponse({
          message: "Privilege Group Deleted Successfully!",
        })
      );
    } else {
      res.status(500).send(
        failResponse({
          message: err ? err.message : "Privilege Group Not Deleted!",
        })
      );
    }
  });
};

const updatePrivilege = async (req, res) => {
  // #swagger.tags = ['Privileges Group']
  try {
    const privileges = await PrivilegesModel.findById(req.params.id);
    if (privileges) {
      PrivilegesModel.findByIdAndUpdate(req.params.id, req.body, (err) => {
        if (!err) {
          res.status(200).send(
            successResponse({
              message: "Privilege Group Updated Successfully!",
            })
          );
        }
      });
    }
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Privilege Group Not Updated!",
      })
    );
  }
};

const updatePrivilegesActive = async (req, res) => {
  // #swagger.tags = ['Privileges Group']
  try {
    PrivilegesModel.updateMany({ _id: { $in: req.body.data } }, { $set: { active: true } }, (err) => {
      if (!err) {
        res.status(200).send(
          successResponse({
            message: "Privilege Group Updated Successfully!",
          })
        );
      }
    });
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Privilege Group Not Updated!",
      })
    );
  }
};

const updatePrivilegesInActive = async (req, res) => {
  // #swagger.tags = ['Privileges Group']
  try {
    PrivilegesModel.updateMany({ _id: { $in: req.body.data } }, { $set: { active: false } }, (err) => {
      if (!err) {
        res.status(200).send(
          successResponse({
            message: "Privilege Group Updated Successfully!",
          })
        );
      }
    });
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Privilege Group Not Updated!",
      })
    );
  }
};
module.exports = {
  deletePrivilegeMultiple,
  deletePrivilege,
  createPrivilege,
  updatePrivilegesInActive,
  updatePrivilegesActive,
  updatePrivilege,
  getPrivilege,
  getAllPrivileges,
};
