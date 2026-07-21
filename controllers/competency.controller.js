const CompetencyModel = require('../models/competency.model');

const successResponse = ({ message, data }) => ({ success: true, data: data ? data : null, message });
const failResponse = ({ message, data }) => ({ success: false, data: data ? data : null, message });

const createCompetency = async (req, res) => {
  // #swagger.tags = ['Competency']
  try {
    let requestBody = {
      competencyName: req.body.competencyName,
      companyId: req.body.companyId,
      description: req.body.description,
      startDate: req.body.startDate,
      endDate: req.body.endDate,
      competencyType: req.body.competencyType,
      developmentActivities: req.body.developmentActivities,
      coachingActivities: req.body.coachingActivities,
      categoryActivities: req.body.categoryActivities,
      designation: req.body.designation
    }
    const newCompetency = new CompetencyModel(requestBody);
   const savedCompetency= await newCompetency.save();
    res.status(200).send(
      successResponse({
        message: 'Competency Created Successfully!',
        data: savedCompetency
      })

    );
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Competency Not Created!"
      })
    );
  }
};

const updateCompetency = async (req, res) => {
  // #swagger.tags = ['Competency']
  try {
    const competency = await CompetencyModel.findById(req.params.id);
    if (competency) {
      let data = {
        competencyName: req.body.competencyName,
        companyId: req.body.companyId,
        description: req.body.description,
        startDate: req.body.startDate,
        endDate: req.body.endDate,
        competencyType: req.body.competencyType,
        developmentActivities: req.body.developmentActivities,
        coachingActivities: req.body.coachingActivities,
        categoryActivities: req.body.categoryActivities,
        designation: req.body.designation


      }
      CompetencyModel.findByIdAndUpdate(req.params.id, data, (err) => {
        if (!err) {
          res.status(200).send(
            successResponse({
              message: 'Competency Updated Successfully!',
            })
          );
        }
      });
    }
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Competency Not Updated!"
      })
    );
  }
};

const deleteCompetency = (req, res) => {
  // #swagger.tags = ['Competency']
  CompetencyModel.findByIdAndRemove({ _id: req.params.id }, (err) => {
    if (!err) {
      res.status(200).send(
        successResponse({
          message: 'Competency Deleted Successfully!',
        })
      );
    } else {
      res.status(500).send(
        failResponse({
          message: err ? err.message : "Competency Not Deleted!"
        })
      );
    }
  });
};


const getCompetencies = async (req, res) => {
  const { companyId } = req.query;
  // #swagger.tags = ['Competency']
  try {
    const companies = await CompetencyModel.find({companyId}).sort({ _id: -1 });
    res.status(200).send(
      successResponse({
        message: 'Competencies Retrieved Successfully!',
        data: companies
      })
    )
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Competencies Not Fetched!"
      })
    );
  }
};

const getCompetencyById = async (req, res) => {
  // #swagger.tags = ['Competency']
  try {
    const competency = await CompetencyModel.findById(req.params.id);
    res.status(200).send(
      successResponse({
        message: 'Competency Retrieved Successfully!',
        data: competency
      })
    )
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Competency Not Fetched!"
      })
    );
  }
};

module.exports = {
  createCompetency,
  updateCompetency,
  deleteCompetency,
  getCompetencies,
  getCompetencyById
};
