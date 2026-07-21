const EligibilityCriteriaModel = require("../../models/recruitment/EligibilityCriteria/EligibilityCriteria");
const { successResponse, errorResponse } = require("../../utils/recruitment/responseHandler");


const createEligibilityCriteria = async (req, res) => {
  try {
    const data = req.body;

    // Optional: Add validation logic here if needed

    const newCriteria = await EligibilityCriteriaModel.create(data);

    return successResponse(
      res,
      newCriteria,
      "Eligibility criteria created successfully"
    );
  } catch (error) {
    return errorResponse(res, error);
  }
};


 
const getEligibilityCriteria = async (req, res) => {
  try {
     const page = parseInt(req.query.page) || 1;
     const limit = parseInt(req.query.limit) || 10;
     const search = req.query.search || "";
     const skip = (page - 1) * limit;
    const companyId = req.query.companyId;
    
     const filters = {};

     // Company filter
     if (companyId) {
       filters.companyId = companyId;
    }
    
     if (search) {
       const searchRegex = new RegExp(search, "i"); 

       filters.$or = [
         { eligibilityName: searchRegex },
         { jobName: searchRegex },
         { gender: searchRegex },
         { grade: searchRegex },
         { maritalStatus: searchRegex },
         { location: searchRegex },
         { personType: searchRegex },
         { religion: searchRegex },
         { position: searchRegex },
         { department: searchRegex },
         { workType: searchRegex },
       ];
    }
    


    const criteriaList = await EligibilityCriteriaModel.find(filters)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    const total = await EligibilityCriteriaModel.countDocuments(filters);
    const totalPages = Math.ceil(total / limit);

    const result = {
      totalRecords: total,
      page,
      limit,
      totalPages: totalPages,
      data: criteriaList,
    };

    


    return successResponse(
      res,
      result,
      "Fetched eligibility criteria with pagination "
    );
  } catch (error) {
    return errorResponse(res, error);
  }
};



const updateEligibilityCriteria = async (req, res) => {
  try {
    const id = req.query.id;

    if (!id) {
      return errorResponse(res, "Missing eligibility criteria ID in query");
    }

    const updatedCriteria = await EligibilityCriteriaModel.findByIdAndUpdate(
      id,
      req.body,
      { new: true }
    );

    if (!updatedCriteria) {
      return errorResponse(res, "Eligibility criteria not found");
    }

    return successResponse(
      res,
      updatedCriteria,
      "Eligibility criteria updated successfully"
    );
  } catch (error) {
    return errorResponse(res, error);
  }
};


const getEligibilityCriteriaById = async (req, res) => {
  try {
    const id = req.query.id;

    if (!id) {
      return errorResponse(res, "Missing eligibility criteria ID in query");
    }

    const criteria = await EligibilityCriteriaModel.findById(id);

    if (!criteria) {
      return errorResponse(res, "Eligibility criteria not found");
    }

    return successResponse(
      res,
      criteria,
      "Fetched eligibility criteria by ID successfully"
    );
  } catch (error) {
    return errorResponse(res, error);
  }
};


const deleteEligibilityCriteria = async (req, res) => {
  try {
    const id = req.query.id;

    if (!id) {
      return errorResponse(res, "Missing eligibility criteria ID in query");
    }

    const deletedCriteria = await EligibilityCriteriaModel.findByIdAndDelete(
      id
    );

    if (!deletedCriteria) {
      return errorResponse(res, "Eligibility criteria not found");
    }

    return successResponse(
      res,
      deletedCriteria,
      "Eligibility criteria deleted successfully"
    );
  } catch (error) {
    return errorResponse(res, error);
  }
};




module.exports = {
  createEligibilityCriteria,
  getEligibilityCriteria,
  updateEligibilityCriteria,
  getEligibilityCriteriaById,
  deleteEligibilityCriteria,
};
