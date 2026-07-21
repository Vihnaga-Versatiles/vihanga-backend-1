const ReviewFormModel = require("../models/templateScreen.model");

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

const createTemplateScreen = async (req, res) => {
  // #swagger.tags = ['Templates']
  try {
    let requestBody = req.body;
    
    // Validate required fields
    if (!requestBody.companyId || !requestBody.ratingScale) {
      return res.status(400).send(
        failResponse({
          message: "companyId and ratingScale are required",
        })
      );
    }
    
    const newTemplateScreen = new ReviewFormModel(requestBody);
    await newTemplateScreen.save();
    res.status(200).send(
      successResponse({
        message: "Template Screen Saved Successfully!",
        data: newTemplateScreen
      })
    );
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Template Screen Not Saved!",
      })
    );
  }
};

const getAllTemplateScreens = async (req, res) => {
  // #swagger.tags = ['Templates']
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
        message: "Template Screen Retrieved Successfully!",
        data: Reviews,
      })
    );
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Template Screen Not Fetched!",
      })
    );
  }
};

const getAllTemplateScreensById = async (req, res) => {
  // #swagger.tags = ['Templates']
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
      _id: req.params.templateId,
      companyId: companyId
    }).sort({ _id: -1 });
    
    if (!Reviews) {
      return res.status(404).send(
        failResponse({
          message: "Template Screen not found",
        })
      );
    }
    
    res.status(200).send(
      successResponse({
        message: "Template Screen Retrieved Successfully!",
        data: Reviews,
      })
    );
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Template Screen Not Fetched!",
      })
    );
  }
};

const deleteTemplateScreen = async (req, res) => {
  // #swagger.tags = ['Templates']
  try {
    const { companyId } = req.query;
    
    if (!companyId) {
      return res.status(400).send(
        failResponse({
          message: "companyId is required in query parameters",
        })
      );
    }
    
    const template = await ReviewFormModel.findOneAndDelete({ 
      _id: req.params.id,
      companyId: companyId
    });
    
    if (!template) {
      return res.status(404).send(
        failResponse({
          message: "Template Screen not found",
        })
      );
    }
    
    res.status(200).send(
      successResponse({
        message: "Template Screen Deleted Successfully!",
      })
    );
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Template Screen Not Deleted!",
      })
    );
  }
};

const updateTemplateScreen = async (req, res) => {
  // #swagger.tags = ['Templates']
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
          message: "Template Screen not found",
        })
      );
    }
    
    const updatedTemplate = await ReviewFormModel.findByIdAndUpdate(
      req.params.id, 
      req.body,
      { new: true, runValidators: true }
    );
    
    res.status(200).send(
      successResponse({
        message: "Template Screen Updated Successfully!",
        data: updatedTemplate
      })
    );
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Template Screen Not Updated!",
      })
    );
  }
};

module.exports = {
  deleteTemplateScreen,
  updateTemplateScreen,
  getAllTemplateScreensById,
  createTemplateScreen,
  getAllTemplateScreens,
};
