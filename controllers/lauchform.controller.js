const ReviewFormModel = require("../models/launchForms.model");
const TraditionalReviewModel = require("../models/reviewForm.model");
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


const createLaunchForm = async (req, res) => {
  // #swagger.tags = ['Launch Form']
  try {
    let requestBody = req.body;
    
    // Validate required fields
    if (!requestBody.companyId) {
      return res.status(400).send(
        failResponse({
          message: "companyId is required",
        })
      );
    }
    
    const newdLaunchForm = new ReviewFormModel(requestBody);
    await newdLaunchForm.save();
    
    // Return immediate response without email notifications
    res.status(200).send(
      successResponse({
        message: "LaunchForm Saved Successfully!",
        data: {
          launchForm: newdLaunchForm
        }
      })
    );
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "LaunchForm Not Saved!",
      })
    );
  }
};

const getAllLaunchForms = async (req, res) => {
  // #swagger.tags = ['Launch Form']
  try {
    const { companyId } = req.query;
    
    if (!companyId) {
      return res.status(400).send(
        failResponse({
          message: "companyId is required in query parameters",
        })
      );
    }
    
    const Reviews = await ReviewFormModel.find({ companyId }).sort({ _id: -1 });
    res.status(200).send(
      successResponse({
        message: "LaunchForm Retrieved Successfully!",
        data: Reviews,
      })
    );
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "LaunchForm Not Fetched!",
      })
    );
  }
};

const getAllLaunchFormsById = async (req, res) => {
  // #swagger.tags = ['Launch Form']
  try {
    const { companyId } = req.query;
    
    if (!companyId) {
      return res.status(400).send(
        failResponse({
          message: "companyId is required in query parameters",
        })
      );
    }
    
    const Reviews = await ReviewFormModel.findOne({ 
      _id: req.params.formId,
      companyId: companyId
    }).sort({ _id: -1 });
    
    if (!Reviews) {
      return res.status(404).send(
        failResponse({
          message: "Launch Form not found",
        })
      );
    }
    
    res.status(200).send(
      successResponse({
        message: "LaunchForm Retrieved Successfully!",
        data: Reviews,
      })
    );
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "LaunchForm Not Fetched!",
      })
    );
  }
};

const getAllLaunchFormsByEmployeeId = async (req, res) => {
  // #swagger.tags = ['Launch Form']
  try {
    const { companyId } = req.query;
    
    if (!companyId) {
      return res.status(400).send(
        failResponse({
          message: "companyId is required in query parameters",
        })
      );
    }
    
    const Reviews = await ReviewFormModel.find({ companyId }).sort({ _id: -1 });
    let result = Reviews.filter((item) => item.employees.includes(req.params.employeeId))
    res.status(200).send(
      successResponse({
        message: "LaunchForm Retrieved Successfully!",
        data: result,
      })
    );
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "LaunchForm Not Fetched!",
      })
    );
  }
};

const deleteLaunchForm = async (req, res) => {
  // #swagger.tags = ['Launch Form']
  try {
    const { companyId } = req.query;
    
    if (!companyId) {
      return res.status(400).send(
        failResponse({
          message: "companyId is required in query parameters",
        })
      );
    }
    
    const LaunchForm = await ReviewFormModel.findOne({ 
      _id: req.params.id,
      companyId: companyId
    });
    
    if (!LaunchForm) {
      return res.status(404).send(
        failResponse({
          message: "Launch Form not found",
        })
      );
    }
    
    console.log(LaunchForm)
    const templateId = LaunchForm?.formTemplate
    const res2 = await TraditionalReviewModel.deleteMany({ templateId: templateId });
    
    if (res2) {
      await ReviewFormModel.findOneAndDelete({ 
        _id: req.params.id,
        companyId: companyId
      });
      
      res.status(200).send(
        successResponse({
          message: "LaunchForm Deleted Successfully!",
        })
      );
    }
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "LaunchForm Not Deleted!",
      })
    );
  }
};

const updateLaunchForm = async (req, res) => {
  // #swagger.tags = ['Launch Form']
  try {
    const { companyId } = req.query;
    
    if (!companyId) {
      return res.status(400).send(
        failResponse({
          message: "companyId is required in query parameters",
        })
      );
    }
    
    const reviews = await ReviewFormModel.findOne({ 
      _id: req.params.id,
      companyId: companyId
    });
    
    if (!reviews) {
      return res.status(404).send(
        failResponse({
          message: "Launch Form not found",
        })
      );
    }
    
    const updatedLaunchForm = await ReviewFormModel.findByIdAndUpdate(
      req.params.id, 
      req.body,
      { new: true, runValidators: true }
    );
    
    res.status(200).send(
      successResponse({
        message: "LaunchForm Updated Successfully!",
        data: updatedLaunchForm
      })
    );
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "LaunchForm Not Updated!",
      })
    );
  }
};

module.exports = {
  deleteLaunchForm,
  updateLaunchForm,
  getAllLaunchFormsById,
  createLaunchForm,
  getAllLaunchForms,
  getAllLaunchFormsByEmployeeId
};