// Use the new email queue system to prevent concurrent connection errors
const { sendEmail, getQueueStatus, shutdownEmailQueue } = require("./emailQueue");

module.exports = {
  sendEmail,
  getQueueStatus,
  shutdownEmailQueue
};
