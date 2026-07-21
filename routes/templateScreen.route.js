const express = require("express");
const { createTemplateScreen, getAllTemplateScreens, getAllTemplateScreensById, updateTemplateScreen, deleteTemplateScreen } = require("../controllers/templateScreen.controller");
const router = express.Router();

const prefix = "/templates"
router.post(`${prefix}/createTemplate`, createTemplateScreen);
router.get(`${prefix}/getTemplates`, getAllTemplateScreens);
router.get(`${prefix}/getTemplates/:templateId`, getAllTemplateScreensById);
router.delete(`${prefix}/deleteTemplate/:id`, deleteTemplateScreen);

router.put(`${prefix}/updateTemplate/:id`, updateTemplateScreen);
module.exports = router;