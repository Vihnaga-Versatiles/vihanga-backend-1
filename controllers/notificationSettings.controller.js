const NotificationSettingsModel = require("../models/notificationSettings.model");

const successResponse = ({ message, data }) => ({
  success: true,
  data: data ? data : null,
  message,
});
const failResponse = ({ message, data }) => ({
  success: false,
  data: data ? data : null,
  message,
});

const createNotificationSettings = async (req, res) => {
  // #swagger.tags = ['Notification Settings']
  try {
    let requestBody = {
      //userId: req.body.userId,
      actions: req.body.actions,
      companyId: req.body.companyId
    };
    const newKeyResult = new NotificationSettingsModel(requestBody);
    await newKeyResult.save();
    res.status(200).send(
      successResponse({
        message: "Settings Created Successfully!",
      })
    );
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Settings Not Created!",
      })
    );
  }
};

const getAllNotificationSettings = async (req, res) => {
  // #swagger.tags = ['Notification Settings']
  try {
    const Privileges = await NotificationSettingsModel.find({ companyId: req.params.companyId }).sort({ _id: -1 });
    res.status(200).send(
      successResponse({
        message: "Settings Retrieved Successfully!",
        data: Privileges,
      })
    );
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Settings Not Fetched!",
      })
    );
  }
};

const getNotificationSettings = async (req, res) => {
  // #swagger.tags = ['Notification Settings']
  try {
    const Privileges = await NotificationSettingsModel.find({ userId: req.params.id }).sort({ _id: -1 });
    res.status(200).send(
      successResponse({
        message: "Settings Retrieved Successfully!",
        data: Privileges,
      })
    );
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Settings Not Fetched!",
      })
    );
  }
};

const deleteNotificationSettings = (req, res) => {
  // #swagger.tags = ['Notification Settings']
  NotificationSettingsModel.findByIdAndRemove({ _id: req.params.id }, (err) => {
    if (!err) {
      res.status(200).send(
        successResponse({
          message: "Settings Deleted Successfully!",
        })
      );
    } else {
      res.status(500).send(
        failResponse({
          message: err ? err.message : "Settings Not Deleted!",
        })
      );
    }
  });
};

const deleteNotificationSettingsMultiple = (req, res) => {
  // #swagger.tags = ['Notification Settings']
  NotificationSettingsModel.deleteMany({ _id: { $in: req.body.data } }, (err) => {
    if (!err) {
      res.status(200).send(
        successResponse({
          message: "Settings Deleted Successfully!",
        })
      );
    } else {
      res.status(500).send(
        failResponse({
          message: err ? err.message : "Settings Not Deleted!",
        })
      );
    }
  });
};

const updateNotificationSettings = async (req, res) => {
  // #swagger.tags = ['Notification Settings']
  try {
    const privileges = await NotificationSettingsModel.findById(req.params.id);
    if (privileges) {
      NotificationSettingsModel.findByIdAndUpdate(req.params.id, req.body, (err) => {
        if (!err) {
          res.status(200).send(
            successResponse({
              message: "Settings Updated Successfully!",
            })
          );
        }
      });
    }
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Settings Not Updated!",
      })
    );
  }
};

const updateNotificationSettingsActive = async (req, res) => {
  // #swagger.tags = ['Notification Settings']
  try {
    NotificationSettingsModel.updateMany({ _id: { $in: req.body.data } }, { $set: { active: true } }, (err) => {
      if (!err) {
        res.status(200).send(
          successResponse({
            message: "Settings Updated Successfully!",
          })
        );
      }
    });
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Settings Not Updated!",
      })
    );
  }
};

const updateNotificationSettingsInActive = async (req, res) => {
  // #swagger.tags = ['Notification Settings']
  try {
    NotificationSettingsModel.updateMany({ _id: { $in: req.body.data } }, { $set: { active: false } }, (err) => {
      if (!err) {
        res.status(200).send(
          successResponse({
            message: "Settings Updated Successfully!",
          })
        );
      }
    });
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Settings Not Updated!",
      })
    );
  }
};
module.exports = {
  deleteNotificationSettingsMultiple,
  deleteNotificationSettings,
  createNotificationSettings,
  updateNotificationSettingsInActive,
  updateNotificationSettingsActive,
  updateNotificationSettings,
  getNotificationSettings,
  getAllNotificationSettings,
};
