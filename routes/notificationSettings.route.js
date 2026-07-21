const express = require("express");
const { createNotificationSettings, getAllNotificationSettings, deleteNotificationSettings, updateNotificationSettings, getNotificationSettings, deleteNotificationSettingsMultiple, updateNotificationSettingsActive, updateNotificationSettingsInActive } = require("../controllers/notificationSettings.controller");
const router = express.Router();

//const { isAuth } = require("../config/auth");
const prefix = "/notificationSettings"
router.post(`${prefix}/createNotificationSettings`, createNotificationSettings);
router.get(`${prefix}/getNotificationSettings/:id`, getNotificationSettings);
router.get(`${prefix}/getAllNotificationSettings/:companyId`, getAllNotificationSettings);
router.post(`${prefix}/deleteNotificationSettingsMultiple`, deleteNotificationSettingsMultiple);
router.delete(`${prefix}/deleteNotificationSettings/:id`, deleteNotificationSettings);
router.post(`${prefix}/updateNotificationSettingsInActive`, updateNotificationSettingsInActive);
router.post(`${prefix}/updateNotificationSettingsActive`, updateNotificationSettingsActive);
router.put(`${prefix}/updateNotificationSettings/:id`, updateNotificationSettings);

module.exports = router;