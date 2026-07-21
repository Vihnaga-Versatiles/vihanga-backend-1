const express = require("express");
const { createEntity, updateEntity, deleteEntity, getEntities, getEntityById, createOrUpdateMultipleEntities, deleteEntities } = require("../controllers/entity.controller");
const router = express.Router();

//const { isAuth } = require("../config/auth");
const prefix = "/entities"
router.post(`${prefix}/createEntity`, createEntity);
router.post(`${prefix}/createOrUpdateMultipleEntities`, createOrUpdateMultipleEntities);
router.put(`${prefix}/updateEntity/:id`, updateEntity);
router.post(`${prefix}/deleteEntities`, deleteEntities);
router.delete(`${prefix}/deleteEntity/:id`, deleteEntity);
router.get(`${prefix}/getEntities/:companyId`, getEntities);
router.get(`${prefix}/getEntityById/:id`, getEntityById);

module.exports = router;