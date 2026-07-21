const EntityModel = require('../models/entity.model');

const successResponse = ({ message, data }) => ({ success: true, data: data ? data : null, message });
const failResponse = ({ message, data }) => ({ success: false, data: data ? data : null, message });

const createEntity = async (req, res) => {
  // #swagger.tags = ['Entity']
  try {
    let requestBody = {
      companyEntityName: req.body.companyEntityName,
      companyId: req.body.companyId,
      industry: req.body.industry,
      legalEntityName: req.body.legalEntityName,
      status: req.body.status,
      country: req.body.country,
      entityComposite: {
        companyEntityName: req.body.companyEntityName,
        legalEntityName: req.body.legalEntityName,
        country: req.body.country
      },
    }
    const newCompany = new EntityModel(requestBody);
    await newCompany.save();
    res.status(200).send(
      successResponse({
        message: 'Entity Created Successfully!',
      })
    );
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Entity Not Created!"
      })
    );
  }
};

const createOrUpdateMultipleEntities = async (req, res) => {
  // #swagger.tags = ['Entity']
  try {
    const items = req.body.data;
    var ops = [];
    items.forEach(item => {
      item.entityComposite = {
        companyEntityName: item.companyEntityName,
        legalEntityName: item.legalEntityName,
        country: item.country
      };
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
    await EntityModel.bulkWrite(ops, { ordered: false });
    res.status(200).send(
      successResponse({
        message: 'Entities Created Successfully!',
      })
    );
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Entities Not Created!"
      })
    );
  }
};

const updateEntity = async (req, res) => {
  // #swagger.tags = ['Entity']
  try {
    const company = await EntityModel.findById(req.params.id);
    if (company) {
      let data = {
        companyEntityName: req.body.companyEntityName,
        companyId: req.body.companyId,
        industry: req.body.industry,
        legalEntityName: req.body.legalEntityName,
        status: req.body.status,
        country: req.body.country,
        entityComposite: {
          companyEntityName: req.body.companyEntityName,
          legalEntityName: req.body.legalEntityName,
          country: req.body.country
        }
      }
      EntityModel.findByIdAndUpdate(req.params.id, data, (err) => {
        if (!err) {
          res.status(200).send(
            successResponse({
              message: 'Entity Updated Successfully!',
            })
          );
        } else {
          res.status(500).send(
            failResponse({
              message: err ? err.message : "Entity Not Updated!"
            })
          );
        }
      });
    }
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Entity Not Updated!"
      })
    );
  }
};

const deleteEntity = (req, res) => {
  // #swagger.tags = ['Entity']
  EntityModel.findByIdAndRemove({ _id: req.params.id }, (err) => {
    if (!err) {
      res.status(200).send(
        successResponse({
          message: 'Entity Deleted Successfully!',
        })
      );
    } else {
      res.status(500).send(
        failResponse({
          message: err ? err.message : "Entity Not Deleted!"
        })
      );
    }
  });
};


const deleteEntities = (req, res) => {
  // #swagger.tags = ['Entity']
  let ids = req.body.data.map(data => data._id);
  EntityModel.deleteMany({ _id: { $in: ids } }, (err) => {
    if (!err) {
      res.status(200).send(
        successResponse({
          message: 'Entities Deleted Successfully!',
        })
      );
    } else {
      res.status(500).send(
        failResponse({
          message: err ? err.message : "Entities Not Deleted!"
        })
      );
    }
  });
};


const getEntities = async (req, res) => {
  // #swagger.tags = ['Entity']
  try {
    const companies = await EntityModel.find({ companyId: req.params.companyId }).sort({ _id: -1 });
    res.status(200).send(
      successResponse({
        message: 'Entities Retrieved Successfully!',
        data: companies
      })
    )
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Entities Not Fetched!"
      })
    );
  }
};

const getEntityById = async (req, res) => {
  // #swagger.tags = ['Entity']
  try {
    const company = await EntityModel.findById(req.params.id);
    res.status(200).send(
      successResponse({
        message: 'Entity Retrieved Successfully!',
        data: company
      })
    )
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Entity Not Fetched!"
      })
    );
  }
};

module.exports = {
  createOrUpdateMultipleEntities,
  createEntity,
  updateEntity,
  deleteEntities,
  deleteEntity,
  getEntities,
  getEntityById
};
