const CategoriesModel = require('../models/uploads.model');

const successResponse = ({ message, data, ...rest }) => ({ success: true, data: data ? data : null, message, ...rest });
const failResponse = ({ message, data, ...rest }) => ({ success: false, data: data ? data : null, message, ...rest });

const createUpload = async (req, res) => {
  // #swagger.tags = ['Uploads']
  try {
    let requestBody = {
      category: req.body.category,
      filename: req.body.filename,
      loadedData: req.body.loadedData,
      totalData: req.body.totalData,
      fileSize: req.body.fileSize,
      fileUrl: req.body.fileUrl,
      status: req.body.status,
      companyId: req.body.companyId
    }
    const newUpload = new CategoriesModel(requestBody);
    await newUpload.save();
    console.log(newUpload)
    res.status(200).send(
      successResponse({
        fileUrl:newUpload._doc.fileUrl,
        message: 'Data Upload Successfully!',
        id: newUpload._id
      })
    );
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Data Not Upload!"
      })
    );
  }
};

const updateUpload = async (req, res) => {
  // #swagger.tags = ['Uploads']
  try {
    const grade = await CategoriesModel.findById(req.params.id);
    if (grade) {
      CategoriesModel.findByIdAndUpdate(req.params.id, req.body, (err) => {
        if (!err) {
          res.status(200).send(
            successResponse({
              message: 'Data Updated Successfully!',
            })
          );
        }
      });
    }
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Data Not Updated!"
      })
    );
  }
};

const getUploads = async (req, res) => {
  // #swagger.tags = ['Uploads']
  try {
    const companies = await CategoriesModel.find({}).sort({ _id: -1 });
    res.status(200).send(
      successResponse({
        message: 'Category Retrieved Successfully!',
        data: companies
      })
    )
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Companies Not Fetched!"
      })
    );
  }
};



const deleteUpload = (req, res) => {
  // #swagger.tags = ['Uploads']
  CategoriesModel.findByIdAndRemove({ _id: req.params.id }, (err) => {
    if (!err) {
      res.status(200).send(
        successResponse({
          message: 'Data Deleted Successfully!',
        })
      );
    } else {
      res.status(500).send(
        failResponse({
          message: err ? err.message : "Data Not Deleted!"
        })
      );
    }
  });
};





const getUploadsByCategory = async (req, res) => {
  // #swagger.tags = ['Uploads']
  try {
    const data = await CategoriesModel.find({ category: req.params.category, companyId: req.params.companyId }).sort({ _id: -1 }).limit(5);
    res.status(200).send(
      successResponse({
        message: 'Data Retrieved Successfully!',
        data
      })
    )
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Data Not Fetched!"
      })
    );
  }
};

module.exports = {
  getUploadsByCategory,
  getUploads,
  createUpload,
  deleteUpload,
  updateUpload
};
