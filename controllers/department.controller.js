const DepartmentModel = require('../models/department.model');
const EntityModel = require('../models/entity.model');
const GradeModel = require('../models/grade.model');
const mongoose = require('mongoose')
const successResponse = ({ message, data }) => ({ success: true, data: data ? data : null, message });
const failResponse = ({ message, data }) => ({ success: false, data: data ? data : null, message });
mongoose.set('useFindAndModify', false);

const createDepartment = async (req, res) => {
  // #swagger.tags = ['Department']
  try {
    // Enforce uniqueness at legal entity level (case-insensitive by departmentName)
    const existing = await DepartmentModel.findOne({
      companyId: req.body.companyId,
      legalEntityName: req.body.legalEntityName,
      departmentName: { $regex: new RegExp(`^${req.body.departmentName}$`, 'i') },
    });
    if (existing) {
      return res.status(500).send(
        failResponse({
          message: "Duplicate department name exists for this Legal Entity.",
        })
      );
    }
    let requestBody = {
      departmentName: req.body.departmentName,
      status: req.body.status,
      legalEntityName: req.body.legalEntityName,
      legalEntityId: req.body.legalEntityId,
      parentDepartment: req.body.parentDepartment,
      parentDepartmentId: req.body.parentDepartmentId,
      location: req.body.location,
      companyId: req.body.companyId
      //departmentComposite: {
      //  departmentName: req.body.departmentName,
      //  legalEntityName: req.body.legalEntityName,
      //  location: req.body.location
      //}
    }
    const newCompany = new DepartmentModel(requestBody);
    await newCompany.save();
    res.status(200).send(
      successResponse({
        message: ' Created Successfully!',
      })
    );
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Company Not Created!"
      })
    );
  }
};

const getDepartments = async (req, res) => {
  // #swagger.tags = ['Department']
  try {
    const departments = await DepartmentModel.find({}).sort({ _id: -1 });
    res.status(200).send(
      successResponse({
        message: 'Departments Retrieved Successfully!',
        data: departments
      })
    )
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Departments Not Fetched!"
      })
    );
  }
};

const createOrUpdateMultipleDepartments = async (req, res) => {
  // #swagger.tags = ['Department']
  try {
    const items = req.body.data;
    var ops = [];
    items.forEach(item => {
      if (item._id) {
        ops.push(
          {
            updateOne: {
              filter: { _id: item._id },
              update: {
                $set: item,
              },
              upsert: true
            }
          }
        );
      } else {
        ops.push(
          {
            insertOne: {
              document: item
            }
          }
        )
      }
    })
    await DepartmentModel.bulkWrite(ops, { ordered: false });
    res.status(200).send(
      successResponse({
        message: 'Departments Created Successfully!',
      })
    );
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Departments Not Created!"
      })
    );
  }
};

const updateDepartment = async (req, res) => {
  // #swagger.tags = ['Department']
  try {
    const department = await DepartmentModel.findById(req.params.id);
    if (department) {
      // Enforce uniqueness at legal entity level for updates as well (exclude current id)
      const conflict = await DepartmentModel.findOne({
        companyId: req.body.companyId,
        legalEntityName: req.body.legalEntityName,
        departmentName: { $regex: new RegExp(`^${req.body.departmentName}$`, 'i') },
        _id: { $ne: req.params.id },
      });
      if (conflict) {
        return res.status(500).send(
          failResponse({
            message: "Duplicate department name exists for this Legal Entity.",
          })
        );
      }
      let data = {
        departmentName: req.body.departmentName,
        status: req.body.status,
        legalEntityName: req.body.legalEntityName,
        legalEntityId: req.body.legalEntityId,
        parentDepartment: req.body.parentDepartment,
        parentDepartmentId: req.body.parentDepartmentId,
        location: req.body.location,
        companyId: req.body.companyId
        //departmentComposite: {
        //  departmentName: req.body.departmentName,
        //  legalEntityName: req.body.legalEntityName,
        //  location: req.body.location
        //}
      }
      DepartmentModel.findByIdAndUpdate(req.params.id, data, (err) => {
        if (!err) {
          res.status(200).send(
            successResponse({
              message: 'Department Updated Successfully!',
            })
          );
        }
      });
    }
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Department Not Updated!"
      })
    );
  }
};

const deleteDepartment = (req, res) => {
  // #swagger.tags = ['Department']
  try {
    DepartmentModel.find({}, (error, departs) => {
      if (!error) {
        let inputDepartment = departs.filter(depart => depart._id == req.params.id);
        if (inputDepartment.length > 0) {
          if (departs.length > 0 && departs.map(dep => dep.departmentName).includes(inputDepartment[0].parentDepartment)) {
            res.status(500).send(
              failResponse({
                message: "Parent Department Exists!"
              })
            );
          } else {
            DepartmentModel.findByIdAndRemove({ _id: req.params.id, parentDepartment: null }, (err) => {
              if (!err) {
                res.status(200).send(
                  successResponse({
                    message: 'Department Deleted Successfully!',
                  })
                );
              } else {
                res.status(500).send(
                  failResponse({
                    message: err ? err.message : "Department Not Deleted!"
                  })
                );
              }
            });
          }
        } else {
          res.status(500).send(
            failResponse({
              message: err ? err.message : "Department Not Found!"
            })
          );
        }
      } else {
        res.status(500).send(
          failResponse({
            message: error ? error.message : "Department Not Deleted!"
          })
        );
      }
    })
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Department Not Deleted!"
      })
    );
  }
};


const deleteDepartments = (req, res) => {
  // #swagger.tags = ['Department']
  let ids = req.body.data.map(data => data._id);
  DepartmentModel.deleteMany({ _id: { $in: ids } }, (err) => {
    if (!err) {
      res.status(200).send(
        successResponse({
          message: 'Departments Deleted Successfully!',
        })
      );
    } else {
      res.status(500).send(
        failResponse({
          message: err ? err.message : "Departments Not Deleted!"
        })
      );
    }
  });
};




const getDepartmentById = async (req, res) => {
  // #swagger.tags = ['Department']
  try {
    const department = await DepartmentModel.findById(req.params.id);
    res.status(200).send(
      successResponse({
        message: 'Department Retrieved Successfully!',
        data: department
      })
    )
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Department Not Fetched!"
      })
    );
  }
};

const getDepartmentsData = async (req, res) => {
  // #swagger.tags = ['Department']
  try {
    let result = [];
    const departments = await DepartmentModel.find({ companyId: req.params.companyId }).sort({ _id: -1 });
    const entities = await EntityModel.find({ companyId: req.params.companyId }).sort({ _id: -1 });
    const grades = await GradeModel.find({ companyId: req.params.companyId }).sort({ _id: -1 });
    result.push({ departments, entities, grades })
    res.status(200).send(
      successResponse({
        message: 'Departments Retrieved Successfully!',
        data: result
      })
    )
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Departments Not Fetched!"
      })
    );
  }
};

module.exports = {
  createDepartment,
  createOrUpdateMultipleDepartments,
  updateDepartment,
  deleteDepartment,
  deleteDepartments,
  getDepartments,
  getDepartmentById,
  getDepartmentsData
};
