const express = require("express");
const { createNotification, getAllNotifications, getAllNotificationsByUser, getAllNotificationsCount, getNotificationById, deleteNotification, updateNotification, updateNotifications, updateNotificationKR, updateNotificationTask, getAllNotificationsByUserAll, updateNotificationGoal } = require("../controllers/notifications.controller");
const router = express.Router();

const prefix = "/notifications"
router.post(`${prefix}/createNotification`, createNotification);
router.put(`${prefix}/updateNotificationTask/:id`, updateNotificationTask);
router.put(`${prefix}/updateNotificationKR/:id`, updateNotificationKR);
router.put(`${prefix}/updateNotifications/:id`, updateNotifications);
router.put(`${prefix}/updateNotificationGoal/:id`, updateNotificationGoal);
router.put(`${prefix}/updateNotification/:id`, updateNotification);
router.delete(`${prefix}/deleteNotification/:id`, deleteNotification);
router.get(`${prefix}/getNotificationsCount/:username`, getAllNotificationsCount);
router.get(`${prefix}/getNotificationsByUserAll/:id`, getAllNotificationsByUserAll);
router.get(`${prefix}/getNotificationsByUser/:id/:role`, getAllNotificationsByUser);
router.get(`${prefix}/getNotifications`, getAllNotifications);
router.get(`${prefix}/getNotificationById/:id`, getNotificationById);

module.exports = router;