const DesignationModel = require('../models/designation.model');

const successResponse = ({ message, data }) => ({ success: true, data: data ? data : null, message });
const failResponse = ({ message, data }) => ({ success: false, data: data ? data : null, message });

const createDesignation = async (req, res) => {
  // #swagger.tags = ['Designation']
  try {
    let requestBody = {
      designationName: req.body.designationName,
      departmentName: req.body.departmentName,
      gradeName: req.body.gradeName,
      legalEntityName: req.body.legalEntityName,
      status: req.body.status,
      companyId: req.body.companyId
      //designationComposite: {
      //  designationName: req.body.designationName,
      //  gradeName: req.body.gradeName,
      //  departmentName: req.body.departmentName
      //}
    }
    const newCompany = new DesignationModel(requestBody);
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

const getDesignations = async (req, res) => {
  // #swagger.tags = ['Designation']
  try {
    const designations = await DesignationModel.find({ companyId: req.params.companyId }).sort({ _id: -1 });
    res.status(200).send(
      successResponse({
        message: 'Designations Retrieved Successfully!',
        data: designations
      })
    )
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Designations Not Fetched!"
      })
    );
  }
};

const createOrUpdateMultipleDesignations = async (req, res) => {
  // #swagger.tags = ['Designation']
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
    await DesignationModel.bulkWrite(ops, { ordered: false });
    res.status(200).send(
      successResponse({
        message: 'Designation Created Successfully!',
      })
    );
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Designation Not Created!"
      })
    );
  }
};

const updateDesignation = async (req, res) => {
  // #swagger.tags = ['Designation']
  try {
    const designation = await DesignationModel.findById(req.params.id);
    if (designation) {
      let data = {
        designationName: req.body.designationName,
        departmentName: req.body.departmentName,
        gradeName: req.body.gradeName,
        legalEntityName: req.body.legalEntityName,
        status: req.body.status,
        companyId: req.body.companyId
        //designationComposite: {
        //  designationName: req.body.designationName,
        //  gradeName: req.body.gradeName,
        //  departmentName: req.body.departmentName
        //}
      }
      DesignationModel.findByIdAndUpdate(req.params.id, data, (err) => {
        if (!err) {
          res.status(200).send(
            successResponse({
              message: 'Designation Updated Successfully!',
            })
          );
        } else {
          res.status(500).send(
            failResponse({
              message: err ? err.message : "Designation Not Deleted!"
            })
          );
        }
      });
    }
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Designation Not Updated!"
      })
    );
  }
};

const deleteDesignation = (req, res) => {
  // #swagger.tags = ['Designation']
  DesignationModel.findByIdAndRemove({ _id: req.params.id }, (err) => {
    if (!err) {
      res.status(200).send(
        successResponse({
          message: 'Designation Deleted Successfully!',
        })
      );
    } else {
      res.status(500).send(
        failResponse({
          message: err ? err.message : "Designation Not Deleted!"
        })
      );
    }
  });
};


const deleteDesignations = (req, res) => {
  // #swagger.tags = ['Designation']
  let ids = req.body.data.map(data => data._id);
  DesignationModel.deleteMany({ _id: { $in: ids } }, (err) => {
    if (!err) {
      res.status(200).send(
        successResponse({
          message: 'Designation Deleted Successfully!',
        })
      );
    } else {
      res.status(500).send(
        failResponse({
          message: err ? err.message : "Designation Not Deleted!"
        })
      );
    }
  });
};




const getDesignationById = async (req, res) => {
  // #swagger.tags = ['Designation']
  try {
    const designation = await DesignationModel.findById(req.params.id);
    res.status(200).send(
      successResponse({
        message: 'Designation Retrieved Successfully!',
        data: designation
      })
    )
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Designation Not Fetched!"
      })
    );
  }
};

module.exports = {
  createDesignation,
  createOrUpdateMultipleDesignations,
  updateDesignation,
  deleteDesignations,
  deleteDesignation,
  getDesignations,
  getDesignationById
};
