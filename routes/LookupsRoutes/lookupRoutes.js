// routes/lookupsRoutes.js
const express = require("express");
const {
  createLookup,
  getLookupById,
  getLookupsByType,
  updateLookup,
  deleteLookup,
  getAllLookupsByCompany
} = require("../../controllers/LookupsControllers/lookupsControllers");

const router = express.Router();

// Basic CRUD operations
router.post("/createLookups", createLookup);
router.get("/getLookupsWithId/:id", getLookupById);
router.get("/getLookupsByType", getLookupsByType);
router.put("/updateLookups/:id", updateLookup);
router.delete("/deleteLookups/:id", deleteLookup);
router.get("/getAllLookupsByCompany", getAllLookupsByCompany);

module.exports = router;