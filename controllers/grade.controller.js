const GradeModel = require('../models/grade.model');

const successResponse = ({ message, data }) => ({ success: true, data: data ? data : null, message });
const failResponse = ({ message, data }) => ({ success: false, data: data ? data : null, message });

const createGrade = async (req, res) => {
  // #swagger.tags = ['Grade']
  try {
    let requestBody = {
      gradeName: req.body.gradeName,
      departmentName: req.body.departmentName,
      departmentId: req.body.departmentId,
      designationName: req.body.designationName,
      designationId: req.body.designationId,
      status: req.body.status,
      companyId: req.body.companyId
      //gradeComposite: {
      //  departmentName: req.body.departmentName,
      //  gradeName: req.body.gradeName,
      //}
    }
    const newCompany = new GradeModel(requestBody);
    await newCompany.save();
    res.status(200).send(
      successResponse({
        message: 'Grade Created Successfully!',
      })
    );
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Grade Not Created!"
      })
    );
  }
};

const createOrUpdateMultipleGrades = async (req, res) => {
  // #swagger.tags = ['Grade']
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
    await GradeModel.bulkWrite(ops, { ordered: false }, (err) => {
      if (err) {
        res.status(500).send(
          failResponse({
            message: err ? err.message : "Grade Not Created!"
          })
        );
      } else {
        res.status(200).send(
          successResponse({
            message: 'Grades Created Successfully!',
          })
        );
      }
    });
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "GradesNot Created!"
      })
    );
  }
};

const updateGrade = async (req, res) => {
  // #swagger.tags = ['Grade']
  try {
    const grade = await GradeModel.findById(req.params.id);
    if (grade) {
      let data = {
        gradeName: req.body.gradeName,
        departmentName: req.body.departmentName,
        status: req.body.status,
        companyId: req.body.companyId
        //departmentId: req.body.departmentId,
        //designationName: req.body.designationName,
        //designationId: req.body.designationId,
        //gradeComposite: {
        //  departmentName: req.body.departmentName,
        //  gradeName: req.body.gradeName,
        //}
      }
      GradeModel.findByIdAndUpdate(req.params.id, data, (err) => {
        if (!err) {
          res.status(200).send(
            successResponse({
              message: 'Grade Updated Successfully!',
            })
          );
        } else {
          res.status(500).send(
            failResponse({
              message: err ? err.message : "Grade Not Updated!"
            })
          );
        }
      });
    }
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Grade Not Updated!"
      })
    );
  }
};

const deleteGrade = (req, res) => {
  // #swagger.tags = ['Grade']
  GradeModel.findByIdAndRemove({ _id: req.params.id }, (err) => {
    if (!err) {
      res.status(200).send(
        successResponse({
          message: 'Grade Deleted Successfully!',
        })
      );
    } else {
      res.status(500).send(
        failResponse({
          message: err ? err.message : "Grade Not Deleted!"
        })
      );
    }
  });
};


const deleteGrades = (req, res) => {
  // #swagger.tags = ['Grade']
  let ids = req.body.data.map(data => data._id);
  GradeModel.deleteMany({ _id: { $in: ids } }, (err) => {
    if (!err) {
      res.status(200).send(
        successResponse({
          message: 'Grades Deleted Successfully!',
        })
      );
    } else {
      res.status(500).send(
        failResponse({
          message: err ? err.message : "Grades Not Deleted!"
        })
      );
    }
  });
};


const getGrades = async (req, res) => {
  // #swagger.tags = ['Grade']
  try {
    const grades = await GradeModel.find({ companyId: req.params.companyId }).sort({ _id: -1 });
    res.status(200).send(
      successResponse({
        message: 'Grades Retrieved Successfully!',
        data: grades
      })
    )
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Grades Not Fetched!"
      })
    );
  }
};

const getGradeById = async (req, res) => {
  // #swagger.tags = ['Grade']
  try {
    const grade = await GradeModel.findById(req.params.id);
    res.status(200).send(
      successResponse({
        message: 'Grade Retrieved Successfully!',
        data: grade
      })
    )
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Grade Not Fetched!"
      })
    );
  }
};

module.exports = {
  createOrUpdateMultipleGrades,
  createGrade,
  updateGrade,
  deleteGrades,
  deleteGrade,
  getGrades,
  getGradeById
};
