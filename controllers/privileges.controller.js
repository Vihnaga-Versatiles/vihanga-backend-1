const PrivilegesModel = require("../models/privileges.model");
const PrivilegesGroupModel = require("../models/privilegesGroup.model");
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
  // #swagger.tags = ['Privileges']
  try {
    const { role, description, active, privileges, companyId } = req.body;
    
    // Check if role name already exists (case-insensitive) for this company
    const existingRole = await PrivilegesModel.findOne({
      role: { $regex: new RegExp(`^${role}$`, 'i') },
      companyId: companyId
    });
    
    if (existingRole) {
      return res.status(400).send(
        failResponse({
          message: "Role name already exists. Please choose a different role name.",
        })
      );
    }
    
    let requestBody = {
      role: role,
      description: description,
      active: active,
      privileges: privileges,
      companyId: companyId
    };
    
    const newKeyResult = new PrivilegesModel(requestBody);
    await newKeyResult.save();
    
    res.status(200).send(
      successResponse({
        message: "Privilege created successfully!",
      })
    );
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Privilege not created!",
      })
    );
  }
};

const getAllPrivileges = async (req, res) => {
  // #swagger.tags = ['Privileges']
  try {
    const Privileges = await PrivilegesModel.find({ companyId: req.params.companyId }).sort({ _id: -1 });
    const PrivilegesGroups = await PrivilegesGroupModel.find({ companyId: req.params.companyId }).sort({ _id: -1 });
    let finalData = Privileges.map((item) => {
      let privilegeGroup = PrivilegesGroups.filter(privilege => privilege._id == item._doc.privilegeGroup);
      if (privilegeGroup.length > 0) {
        return { ...item._doc, privilegeGroup: privilegeGroup[0].groupName }
      } else {
        return { ...item._doc, privilegeGroup: "" }
      }
    })
    res.status(200).send(
      successResponse({
        message: "Privileges retrieved successfully",
        data: finalData,
      })
    );
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Privilege Not Fetched!",
      })
    );
  }
};

const getPrivilege = async (req, res) => {
  // #swagger.tags = ['Privileges']
  try {
    const Privileges = await PrivilegesModel.findOne({ role: req.params.role, companyId: req.params.companyId })
    res.status(200).send(
      successResponse({
        message: "Privilege data retrieved successfully",
        data: [Privileges],
      })
    );
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Category Not Fetched!",
      })
    );
  }
};

const deletePrivilege = (req, res) => {
  // #swagger.tags = ['Privileges']
  PrivilegesModel.findByIdAndRemove({ _id: req.params.id }, (err) => {
    if (!err) {
        res.status(200).send(
          successResponse({
            message: "Privilege deleted successfully",
          })
        );
    } else {
      res.status(500).send(
        failResponse({
          message: err ? err.message : "Privilege Not Deleted!",
        })
      );
    }
  });
};

const deletePrivilegeMultiple = (req, res) => {
  // #swagger.tags = ['Privileges']
  PrivilegesModel.deleteMany({ _id: { $in: req.body.data } }, (err) => {
    if (!err) {
        res.status(200).send(
          successResponse({
            message: "Privileges deleted successfully",
          })
        );
    } else {
      res.status(500).send(
        failResponse({
          message: err ? err.message : "Privileges Not Deleted!",
        })
      );
    }
  });
};

const updatePrivilege = async (req, res) => {
  // #swagger.tags = ['Privileges']
  try {
    const privileges = await PrivilegesModel.findById(req.params.id);
    if (!privileges) {
      return res.status(404).send(
        failResponse({
          message: "Privilege not found!",
        })
      );
    }

    // If role name is being updated, check for uniqueness (case-insensitive)
    if (req.body.role && req.body.role !== privileges.role) {
      const existingRole = await PrivilegesModel.findOne({
        role: { $regex: new RegExp(`^${req.body.role}$`, 'i') },
        companyId: privileges.companyId,
        _id: { $ne: req.params.id } // Exclude current record
      });
      
      if (existingRole) {
        return res.status(400).send(
          failResponse({
            message: "Role name already exists. Please choose a different role name.",
          })
        );
      }
    }

    await PrivilegesModel.findByIdAndUpdate(req.params.id, req.body);
    res.status(200).send(
      successResponse({
        message: "Privilege updated successfully!",
      })
    );
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Privilege not updated!",
      })
    );
  }
};

const updatePrivilegePermissionGroup = async (req, res) => {
  // #swagger.tags = ['Privileges']
  try {
    const privileges = await PrivilegesModel.findById(req.params.id);
    if (privileges) {
      let updatedData = { privilegeGroup: req.body.privilegeGroup };
      PrivilegesModel.findByIdAndUpdate(req.params.id, updatedData, (err) => {
        if (!err) {
          res.status(200).send(
            successResponse({
              message: "Privilege group updated successfully",
            })
          );
        }
      });
    }
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Privilege Not Updated!",
      })
    );
  }
};

const updatePrivilegesActive = async (req, res) => {
  // #swagger.tags = ['Privileges']
  try {
    PrivilegesModel.updateMany({ _id: { $in: req.body.data } }, { $set: { active: true } }, (err) => {
      if (!err) {
        res.status(200).send(
          successResponse({
            message: "Privileges updated successfully",
          })
        );
      }
    });
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Privilege Not Updated!",
      })
    );
  }
};

const updatePrivilegesInActive = async (req, res) => {
  // #swagger.tags = ['Privileges']
  try {
    PrivilegesModel.updateMany({ _id: { $in: req.body.data } }, { $set: { active: false } }, (err) => {
      if (!err) {
        res.status(200).send(
          successResponse({
            message: "Privileges updated successfully",
          })
        );
      }
    });
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Privilege Not Updated!",
      })
    );
  }
};
module.exports = {
  deletePrivilegeMultiple,
  deletePrivilege,
  createPrivilege,
  updatePrivilegePermissionGroup,
  updatePrivilegesInActive,
  updatePrivilegesActive,
  updatePrivilege,
  getPrivilege,
  getAllPrivileges,
};
