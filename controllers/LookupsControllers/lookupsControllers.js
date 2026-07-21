const Lookup = require("../../models/Lookups/Lookups"); // adjust path if needed

// Create a new lookup
const createLookup = async (req, res) => {
  try {
    const { lookType, meaning, ratingScale, companyId } = req.body;
    
    // Validate required fields
    if (!lookType || !meaning || !companyId) {
      return res.status(400).json({
        success: false,
        message: "lookType, meaning, and companyId are required"
      });
    }

    const lookup = new Lookup({
      companyId,
      lookType,
      meaning,
      ratingScale: ratingScale || []
    });
    
    await lookup.save();
    res.status(201).json({
      success: true,
      message: "Lookup created successfully",
      data: lookup
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// Get single lookup by ID
const getLookupById = async (req, res) => {
  try {
    const { companyId } = req.query;
    
    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: "companyId is required in query parameters"
      });
    }

    const lookup = await Lookup.findOne({ 
      _id: req.params.id,
      companyId: companyId
    });
    
    if (!lookup) {
      return res.status(404).json({
        success: false,
        message: "Lookup not found"
      });
    }
    res.status(200).json({
      success: true,
      data: lookup
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get lookups by lookType
const getLookupsByType = async (req, res) => {
  try {
    const { companyId,lookType } = req.query;
    
    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: "companyId is required in query parameters"
      });
    }

    const lookups = await Lookup.find({ 
      lookType,
      companyId: companyId
    });
    
    res.status(200).json({
      success: true,
      data: lookups
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get all lookups for a company
const getAllLookupsByCompany = async (req, res) => {
  try {
    const { companyId } = req.query;
    
    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: "companyId is required in query parameters"
      });
    }

    const lookups = await Lookup.find({ companyId: companyId });
    
    res.status(200).json({
      success: true,
      data: lookups
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Update lookup by ID
const updateLookup = async (req, res) => {
  try {
    const { lookType, meaning, ratingScale, companyId } = req.body;
    
    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: "companyId is required"
      });
    }
    
    const updateData = {};
    if (lookType) updateData.lookType = lookType;
    if (meaning) updateData.meaning = meaning;
    if (ratingScale) updateData.ratingScale = ratingScale;

    const lookup = await Lookup.findOneAndUpdate(
      { 
        _id: req.params.id,
        companyId: companyId
      },
      updateData,
      { new: true, runValidators: true }
    );

    if (!lookup) {
      return res.status(404).json({
        success: false,
        message: "Lookup not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Lookup updated successfully",
      data: lookup
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// Delete lookup by ID
const deleteLookup = async (req, res) => {
  try {
    const { companyId } = req.query;
    
    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: "companyId is required in query parameters"
      });
    }

    const lookup = await Lookup.findOneAndDelete({ 
      _id: req.params.id,
      companyId: companyId
    });

    if (!lookup) {
      return res.status(404).json({
        success: false,
        message: "Lookup not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Lookup deleted successfully"
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = {
  createLookup,
  getLookupById,
  getLookupsByType,
  getAllLookupsByCompany,
  updateLookup,
  deleteLookup
};