const express = require('express');
const router = express.Router();
const themeController = require('../../controllers/themeSetting/ThemeSettingController');
const multer = require('multer');
const upload = multer();

// Minimal Theme routes with explicit names:
// 1) GET theme by company (current usage)
// 2) GET theme by id (named)
// 3) CREATE theme (named)
// 4) UPDATE theme (named)

router.get('/company/:companyId', themeController.getCompanyTheme);
router.get('/get-theme/:themeId', themeController.getThemeById);
router.post('/save-theme', themeController.createTheme);
router.put('/update-theme/:themeId', themeController.updateTheme);
router.post('/upload-logo', upload.single('logo'), themeController.uploadThemeLogo);

module.exports = router;