const mongoose = require("mongoose");

const actionSchema = new mongoose.Schema(
  {
    category: String,
    page: String,
    action: String,
    active: {
      type: Boolean,
      default: false,
    },
    toAddress: String,
    ccAddress: String,
    subject: String,
    message: String,
    attachment: String,
  }
)

const notificationSettingsSchema = new mongoose.Schema(
  {
    actions: {
      type: [actionSchema],
      required: true,
    },
    companyId: {
      type: String,
      ref: "Company"
    }
  },
  {
    timestamps: true,
  }
);

const NotificationSetting = mongoose.models.NotificationSetting || mongoose.model("NotificationSetting", notificationSettingsSchema);

module.exports = NotificationSetting;
