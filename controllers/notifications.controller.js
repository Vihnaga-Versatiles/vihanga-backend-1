require("dotenv").config();
const NotificationModel = require("../models/notification.model");
const ObjectivesModel = require("../models/objectives.model");
const KeyResultsModel = require("../models/keyResults.model");
const TasksModel = require("../models/tasks2.model");
const GoalsModel = require("../models/goals.model");
const NotificationSettingsModel = require("../models/notificationSettings.model");
const EmployModel = require("../models/employee.model");
var nodemailer = require("nodemailer");
const sendgridTransport = require("nodemailer-sendgrid-transport");
const transporter = nodemailer.createTransport(
  sendgridTransport({
    auth: {
      api_key: process.env.SENGRID_API_KEY,
    },
  }),
);

const path = require("path");
var ejs = require("ejs");
var pathnotification = path.resolve(__dirname, "../views/templates/notification.ejs");
const successResponse = ({ message, data, ...rest }) => ({
  success: true,
  data: data ? data : null,
  message,
  ...rest
});
const failResponse = ({ message, data, ...rest }) => ({
  success: false,
  data: data ? data : null,
  message,
  ...rest
});

let getPrefix = (input) => {
  return input === 'Create' || input === 'Update' || input === 'Approve' ? 'd' : 'ed';
};

const createNotification = async (req, res) => {
  // #swagger.tags = ['Notifications']
  try {
    let requestBody = {
      title: req.body.title,
      path: req.body.path,
      operation: req.body.operation,
    };
    const newNotification = new NotificationModel(requestBody);
    await newNotification.save();
    res.status(200).send(
      successResponse({
        message: "Notification Created Successfully!",
      })
    );
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Notification Not Created!",
      })
    );
  }
};

const getAllNotificationsByUser = async (req, res) => {
  // #swagger.tags = ['Notifications']
  try {
    // Always scope to the current user so badge count matches the dropdown list
    const obj = { "row.employeeReferenceId": req.params.id };
    const Tasks = await NotificationModel.find(obj).sort({ _id: -1 }).limit(10);
    res.status(200).send(
      successResponse({
        message: "Notification Retrieved Successfully!",
        data: Tasks,
        count: Tasks.length
      })
    );
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Notification Not Fetched!",
      })
    );
  }
};
const getAllNotificationsByUserAll = async (req, res) => {
  // #swagger.tags = ['Notifications']
  try {
    const Tasks = await NotificationModel.find({ "row.employeeReferenceId": req.params.id }).sort({ _id: -1 })
    res.status(200).send(
      successResponse({
        message: "Notification Retrieved Successfully!",
        data: Tasks,
        count: Tasks.length
      })
    );
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Notification Not Fetched!",
      })
    );
  }
};
const getAllNotifications = async (req, res) => {
  // #swagger.tags = ['Notifications']
  try {
    const Tasks = await NotificationModel.find({}).sort({ _id: -1 });
    res.status(200).send(
      successResponse({
        message: "Notification Retrieved Successfully!",
        data: Tasks,
      })
    );
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Notification Not Fetched!",
      })
    );
  }
};

const getAllNotificationsCount = async (req, res) => {
  // #swagger.tags = ['Notifications']
  try {
    const Tasks = await NotificationModel.find({ "row.employeeReferenceId": req.params.username }).count();
    res.status(200).send(
      successResponse({
        message: "Notification Retrieved Successfully!",
        data: Tasks,
      })
    );
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Notification Not Fetched!",
      })
    );
  }
};
const deleteNotification = (req, res) => {
  // #swagger.tags = ['Notifications']
  NotificationModel.findByIdAndRemove({ _id: req.params.id }, (err) => {
    if (!err) {
      res.status(200).send(
        successResponse({
          message: "Notification Deleted Successfully!",
        })
      );
    } else {
      res.status(500).send(
        failResponse({
          message: err ? err.message : "Notification Not Deleted!",
        })
      );
    }
  });
};
const getNotificationById = async (req, res) => {
  // #swagger.tags = ['Notifications']
  try {
    const notification = await NotificationModel.findById(req.params.id);
    res.status(200).send(
      successResponse({
        message: 'Notification Retrieved Successfully!',
        data: notification
      })
    )
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Notification Not Fetched!"
      })
    );
  }
};


const updateNotifications = async (req, res) => {
  // #swagger.tags = ['Notifications']
  try {
    const notification = await NotificationModel.findById(req.params.id);
    if (notification) {
      NotificationModel.findByIdAndUpdate(req.params.id, req.body, (err) => {
        if (!err) {
          res.status(200).send(
            successResponse({
              message: "Notification Updated Successfully!",
            })
          );
        }
      });
    }
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Notification Not Updated!",
      })
    );
  }
};
const updateNotificationTask = async (req, res) => {
  // #swagger.tags = ['Notifications']
  try {
    const objective = await TasksModel.findById(req.params.id);
    if (objective) {
      TasksModel.findByIdAndUpdate(req.params.id, req.body, async (err) => {
        if (!err) {
          let path = "/admin/tasks";
          let requestBody = {
            title: "Your task has been " + req.body.objectiveStatus + getPrefix(req.body.objectiveStatus),
            path,
            operation: req.body.objectiveStatus,
            row: req.body.row,
            companyInfo: req.body.companyInfo
          };
          const notificationSettings = await NotificationSettingsModel.find({});
          let subject = "";
          let message = "";
          let toAddress = "";
          let ccAddress = "";
          let attachment = "";
          let active = false;
          if (req.body.objectiveStatus === "Create") {
            subject = notificationSettings[0].actions.filter(item => item.page === "Create Task")[0].subject;
            message = notificationSettings[0].actions.filter(item => item.page === "Create Task")[0].message;
            toAddress = notificationSettings[0].actions.filter(item => item.page === "Create Task")[0].toAddress;
            ccAddress = notificationSettings[0].actions.filter(item => item.page === "Create Task")[0].ccAddress;
            active = notificationSettings[0].actions.filter(item => item.page === "Create Task")[0].active;
            attachment = notificationSettings[0].actions.filter(item => item.page === "Create Task")[0].attachment;
          } else if (req.body.objectiveStatus === "Update") {
            subject = notificationSettings[0].actions.filter(item => item.page === "Update Task")[0].subject;
            message = notificationSettings[0].actions.filter(item => item.page === "Update Task")[0].message;
            toAddress = notificationSettings[0].actions.filter(item => item.page === "Update Task")[0].toAddress;
            ccAddress = notificationSettings[0].actions.filter(item => item.page === "Update Task")[0].ccAddress;
            active = notificationSettings[0].actions.filter(item => item.page === "Update Task")[0].active;
            attachment = notificationSettings[0].actions.filter(item => item.page === "Update Task")[0].attachment;
          } else if (req.body.objectiveStatus === "Delete") {
            subject = notificationSettings[0].actions.filter(item => item.page === "Delete Task")[0].subject;
            message = notificationSettings[0].actions.filter(item => item.page === "Delete Task")[0].message;
            toAddress = notificationSettings[0].actions.filter(item => item.page === "Delete Task")[0].toAddress;
            ccAddress = notificationSettings[0].actions.filter(item => item.page === "Delete Task")[0].ccAddress;
            active = notificationSettings[0].actions.filter(item => item.page === "Delete Task")[0].active;
            attachment = notificationSettings[0].actions.filter(item => item.page === "Delete Task")[0].attachment;
          }
          if (active) {
            let employee = await EmployModel.findOne({ _id: req.body.row.employeeReferenceId });
            let manager = "";
            if (employee.employmentInformation.lineManager !== "") {
              manager = await EmployModel.findOne({ _id: employee.employmentInformation.lineManager });
            }
            //let toMail = employee.contactInformation.email;
            //let ccMail = manager.contactInformation.email;
            subject = subject.replace(/&task/gi, req.body.row.title);
            subject = subject.replace(/&amp;task/gi, req.body.row.title);
            subject = subject.replace(/&amp;kr/gi, req.body.row.linkToKR);
            message = message.replace(/&amp;task/gi, req.body.row.title);
            message = message.replace(/&amp;kr/gi, req.body.row.linkToKR);
            subject = subject.replace(/&amp;employee/gi, employee.personalInformation.firstName + " " + employee.personalInformation.lastName);
            if (manager) {
              subject = subject.replace(/&amp;manager/gi, manager.personalInformation.firstName + " " + manager.personalInformation.lastName);
              message = message.replace(/&amp;manager/gi, manager.personalInformation.firstName + " " + manager.personalInformation.lastName);
            }
            message = message.replace(/&amp;employee/gi, employee.personalInformation.firstName + " " + employee.personalInformation.lastName);
            const newNotification = new NotificationModel(requestBody);
            await newNotification.save().then((err, result) => {
              //ejs.renderFile(pathnotification, { message, subject, attachment, objectiveName: req.body.row.title, _id: req.body.row._id }, function (err, data) {
              //  if (err) {
              //    console.log(err);
              //  } else {
              //    var mailOptions = {
              //      from: "info@talentspotify.com",
              //      fromname: "Vihanga",
              //      to: "mogilivenkatesh3@gmail.com",//toMail,
              //      cc: ["mogilivenkatesh3@gmail.com", "aneel@appsdreamz.com"], //ccMail,
              //      subject,
              //      html: data,
              //    };

              //    transporter.sendMail(mailOptions, function (error, info) {
              //      if (error) {
              //        //res.status(500).send(
              //        //  failResponse({
              //        //    message: error ? error.message : "Mail Not Sent!"
              //        //  })
              //        //);

              //        res.status(200).send(
              //          successResponse({
              //            message: subject,
              //          })
              //        );
              //      } else {
              res.status(200).send(
                successResponse({
                  message: subject,
                })
              );
              //      }
              //    });
              //  }
              //});
            })
          } else {
            res.status(200).send(
              successResponse({
                message: "Your task has been " + req.body.objectiveStatus + getPrefix(req.body.objectiveStatus),
              })
            );
          }
        }
      });
    } else {
      res.status(500).send(
        failResponse({
          message: "Task Not Found!",
        })
      );
    }
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Notification Not Updated!",
      })
    );
  }
};
const updateNotificationKR = async (req, res) => {
  // #swagger.tags = ['Notifications']
  try {
    const objective = await KeyResultsModel.findById(req.params.id);
    if (objective) {
      KeyResultsModel.findByIdAndUpdate(req.params.id, req.body, async (err) => {
        if (!err) {
          let path = "/admin/objectives/okrdetails";
          let requestBody = {
            title: "Your key result has been " + req.body.objectiveStatus + getPrefix(req.body.objectiveStatus),
            path,
            operation: req.body.objectiveStatus,
            row: req.body.row,
            companyInfo: req.body.companyInfo
          };
          const notificationSettings = await NotificationSettingsModel.find({});
          let subject = "";
          let message = "";
          let toAddress = "";
          let ccAddress = "";
          let attachment = "";
          let active = false;
          if (req.body.objectiveStatus === "Create") {
            subject = notificationSettings[0].actions.filter(item => item.page === "Create KR")[0].subject;
            message = notificationSettings[0].actions.filter(item => item.page === "Create KR")[0].message;
            toAddress = notificationSettings[0].actions.filter(item => item.page === "Create KR")[0].toAddress;
            ccAddress = notificationSettings[0].actions.filter(item => item.page === "Create KR")[0].ccAddress;
            active = notificationSettings[0].actions.filter(item => item.page === "Create KR")[0].active;
            attachment = notificationSettings[0].actions.filter(item => item.page === "Create KR")[0].attachment;
          } else if (req.body.objectiveStatus === "Update") {
            subject = notificationSettings[0].actions.filter(item => item.page === "Update KR")[0].subject;
            message = notificationSettings[0].actions.filter(item => item.page === "Update KR")[0].message;
            toAddress = notificationSettings[0].actions.filter(item => item.page === "Update KR")[0].toAddress;
            ccAddress = notificationSettings[0].actions.filter(item => item.page === "Update KR")[0].ccAddress;
            active = notificationSettings[0].actions.filter(item => item.page === "Update KR")[0].active;
            attachment = notificationSettings[0].actions.filter(item => item.page === "Update KR")[0].attachment;
          } else if (req.body.objectiveStatus === "Delete") {
            subject = notificationSettings[0].actions.filter(item => item.page === "Delete KR")[0].subject;
            message = notificationSettings[0].actions.filter(item => item.page === "Delete KR")[0].message;
            toAddress = notificationSettings[0].actions.filter(item => item.page === "Delete KR")[0].toAddress;
            ccAddress = notificationSettings[0].actions.filter(item => item.page === "Delete KR")[0].ccAddress;
            active = notificationSettings[0].actions.filter(item => item.page === "Delete KR")[0].active;
            attachment = notificationSettings[0].actions.filter(item => item.page === "Delete KR")[0].attachment;
          }
          if (active) {
            let employee = await EmployModel.findOne({ _id: req.body.row.employeeReferenceId });
            let manager = "";
            if (employee.employmentInformation.lineManager !== "") {
              manager = await EmployModel.findOne({ _id: employee.employmentInformation.lineManager });
            }
            //let toMail = employee.contactInformation.email;
            //let ccMail = manager.contactInformation.email;
            subject = subject.replace(/&kr/gi, req.body.row.keyResultName);
            subject = subject.replace(/&amp;kr/gi, req.body.row.keyResultName);
            subject = subject.replace(/&amp;objective/gi, req.body.row.okrName);
            message = message.replace(/&amp;kr/gi, req.body.row.keyResultName);
            message = message.replace(/&amp;objective/gi, req.body.row.okrName);
            subject = subject.replace(/&amp;employee/gi, employee.personalInformation.firstName + " " + employee.personalInformation.lastName);
            if (manager) {
              subject = subject.replace(/&amp;manager/gi, manager.personalInformation.firstName + " " + manager.personalInformation.lastName);
              message = message.replace(/&amp;manager/gi, manager.personalInformation.firstName + " " + manager.personalInformation.lastName);
            }
            message = message.replace(/&amp;employee/gi, employee.personalInformation.firstName + " " + employee.personalInformation.lastName);
            const newNotification = new NotificationModel(requestBody);
            await newNotification.save().then((err, result) => {
              //ejs.renderFile(pathnotification, { message, subject, attachment, objectiveName: req.body.row.okrName, _id: req.body.row.objectiveId }, function (err, data) {
              //  if (err) {
              //    console.log(err);
              //  } else {
              //    var mailOptions = {
              //      from: "info@talentspotify.com",
              //      fromname: "Vihanga",
              //      to: "mogilivenkatesh3@gmail.com",//toMail,
              //      cc: ["mogilivenkatesh3@gmail.com", "aneel@appsdreamz.com"], //ccMail,
              //      subject,
              //      html: data,
              //    };

              //    transporter.sendMail(mailOptions, function (error, info) {
              //      if (error) {
              //        //res.status(500).send(
              //        //  failResponse({
              //        //    message: error ? error.message : "Mail Not Sent!"
              //        //  })
              //        //);

              //        res.status(200).send(
              //          successResponse({
              //            message: subject,
              //          })
              //        );
              //      } else {
              res.status(200).send(
                successResponse({
                  message: subject,
                })
              );
              //  }
              //});
              //}
              //});
            })
          } else {
            res.status(200).send(
              successResponse({
                message: "Your key result has been " + req.body.objectiveStatus + getPrefix(req.body.objectiveStatus),
              })
            );
          }
        }
      });
    } else {
      res.status(500).send(
        failResponse({
          message: "key result Not Found!",
        })
      );
    }
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Notification Not Updated!",
      })
    );
  }
};
const updateNotification = async (req, res) => {
  // #swagger.tags = ['Notifications']
  try {
    const objective = await ObjectivesModel.findById(req.params.id);
    if (objective) {
      const objectives = await ObjectivesModel.find({ employeeReferenceId: req.body.row.employeeReferenceId });
      let totalWeight = objectives.reduce((prev, current) => {
        return prev + current.weight
      }, 0);
      if (req.body.objectiveStatus === "Submit" && totalWeight !== 100) {
        res.status(500).send(
          failResponse({
            message: "Total Weight Should Be 100",
          })
        );
      } else {
        ObjectivesModel.findByIdAndUpdate(req.params.id, req.body, async (err) => {
          if (!err) {
            let path = "";
            if (req.body.objectiveStatus === "Approve") {
              path = "/admin/objectives/okrdetails"
            } else {
              path = "/admin/objectives"
            }
            let requestBody = {
              title: "Your objective has been " + req.body.objectiveStatus + getPrefix(req.body.objectiveStatus),
              path,
              operation: req.body.objectiveStatus,
              row: req.body.row,
              companyInfo: req.body.companyInfo
            };
            const notificationSettings = await NotificationSettingsModel.find({});
            let subject = "";
            let message = "";
            let toAddress = "";
            let ccAddress = "";
            let attachment = "";
            let active = false;
            if (req.body.objectiveStatus === "Create") {
              subject = notificationSettings[0].actions.filter(item => item.page === "Create Objective")[0].subject;
              message = notificationSettings[0].actions.filter(item => item.page === "Create Objective")[0].message;
              toAddress = notificationSettings[0].actions.filter(item => item.page === "Create Objective")[0].toAddress;
              ccAddress = notificationSettings[0].actions.filter(item => item.page === "Create Objective")[0].ccAddress;
              active = notificationSettings[0].actions.filter(item => item.page === "Create Objective")[0].active;
              attachment = notificationSettings[0].actions.filter(item => item.page === "Create Objective")[0].attachment;
            } else if (req.body.objectiveStatus === "Update") {
              subject = notificationSettings[0].actions.filter(item => item.page === "Update Objective")[0].subject;
              message = notificationSettings[0].actions.filter(item => item.page === "Update Objective")[0].message;
              toAddress = notificationSettings[0].actions.filter(item => item.page === "Update Objective")[0].toAddress;
              ccAddress = notificationSettings[0].actions.filter(item => item.page === "Update Objective")[0].ccAddress;
              active = notificationSettings[0].actions.filter(item => item.page === "Update Objective")[0].active;
              attachment = notificationSettings[0].actions.filter(item => item.page === "Update Objective")[0].attachment;
            } else if (req.body.objectiveStatus === "Delete") {
              subject = notificationSettings[0].actions.filter(item => item.page === "Delete Objective")[0].subject;
              message = notificationSettings[0].actions.filter(item => item.page === "Delete Objective")[0].message;
              toAddress = notificationSettings[0].actions.filter(item => item.page === "Delete Objective")[0].toAddress;
              ccAddress = notificationSettings[0].actions.filter(item => item.page === "Delete Objective")[0].ccAddress;
              active = notificationSettings[0].actions.filter(item => item.page === "Delete Objective")[0].active;
              attachment = notificationSettings[0].actions.filter(item => item.page === "Delete Objective")[0].attachment;
            } else if (req.body.objectiveStatus === "Unlock") {
              subject = notificationSettings[0].actions.filter(item => item.page === "Unlock Objective")[0].subject;
              message = notificationSettings[0].actions.filter(item => item.page === "Unlock Objective")[0].message;
              toAddress = notificationSettings[0].actions.filter(item => item.page === "Unlock Objective")[0].toAddress;
              ccAddress = notificationSettings[0].actions.filter(item => item.page === "Unlock Objective")[0].ccAddress;
              active = notificationSettings[0].actions.filter(item => item.page === "Unlock Objective")[0].active;
              attachment = notificationSettings[0].actions.filter(item => item.page === "Unlock Objective")[0].attachment;
            } else if (req.body.objectiveStatus === "Approve") {
              subject = notificationSettings[0].actions.filter(item => item.page === "Approval")[0].subject;
              message = notificationSettings[0].actions.filter(item => item.page === "Approval")[0].message;
              toAddress = notificationSettings[0].actions.filter(item => item.page === "Approval")[0].toAddress;
              ccAddress = notificationSettings[0].actions.filter(item => item.page === "Approval")[0].ccAddress;
              active = notificationSettings[0].actions.filter(item => item.page === "Approval")[0].active;
              attachment = notificationSettings[0].actions.filter(item => item.page === "Approval")[0].attachment;
            } else if (req.body.objectiveStatus === "Reject") {
              subject = notificationSettings[0].actions.filter(item => item.page === "Reject")[0].subject;
              message = notificationSettings[0].actions.filter(item => item.page === "Reject")[0].message;
              toAddress = notificationSettings[0].actions.filter(item => item.page === "Reject")[0].toAddress;
              ccAddress = notificationSettings[0].actions.filter(item => item.page === "Reject")[0].ccAddress;
              active = notificationSettings[0].actions.filter(item => item.page === "Reject")[0].active;
              attachment = notificationSettings[0].actions.filter(item => item.page === "Reject")[0].attachment;
            } else if (req.body.objectiveStatus === "Submit") {
              subject = notificationSettings[0].actions.filter(item => item.page === "Submission")[0].subject;
              message = notificationSettings[0].actions.filter(item => item.page === "Submission")[0].message;
              toAddress = notificationSettings[0].actions.filter(item => item.page === "Submission")[0].toAddress;
              ccAddress = notificationSettings[0].actions.filter(item => item.page === "Submission")[0].ccAddress;
              active = notificationSettings[0].actions.filter(item => item.page === "Submission")[0].active;
              attachment = notificationSettings[0].actions.filter(item => item.page === "Submission")[0].attachment;
            }
            if (active) {
              let employee = await EmployModel.findOne({ _id: req.body.row.employeeReferenceId });
              let manager = "";
              if (employee.employmentInformation.lineManager !== "") {
                manager = await EmployModel.findOne({ _id: employee.employmentInformation.lineManager });
              }
              //let toMail = employee.contactInformation.email;
              //let ccMail = manager.contactInformation.email;
              subject = subject.replace(/&objective/gi, req.body.row.objective);
              subject = subject.replace(/&amp;objective/gi, req.body.row.objective);
              message = message.replace(/&amp;objective/gi, req.body.row.objective);
              subject = subject.replace(/&amp;employee/gi, employee.personalInformation.firstName + " " + employee.personalInformation.lastName);
              if (manager) {
                subject = subject.replace(/&amp;manager/gi, manager.personalInformation.firstName + " " + manager.personalInformation.lastName);
                message = message.replace(/&amp;manager/gi, manager.personalInformation.firstName + " " + manager.personalInformation.lastName);
              }
              message = message.replace(/&amp;employee/gi, employee.personalInformation.firstName + " " + employee.personalInformation.lastName);
              const newNotification = new NotificationModel(requestBody);
              await newNotification.save().then((err, result) => {
                //ejs.renderFile(pathnotification, { message, subject, attachment, objectiveName: req.body.row.objective, _id: req.body.row._id }, function (err, data) {
                //  if (err) {
                //    console.log(err);
                //  } else {
                //    var mailOptions = {
                //      from: "info@talentspotify.com",
                //      fromname: "Vihanga",
                //      to: "mogiliv3@gmail.com",//toMail,
                //      cc: ["mogiliv3@gmail.com", "aneel@appsdreamz.com"], //ccMail,
                //      subject,
                //      html: data,
                //    };

                //    transporter.sendMail(mailOptions, function (error, info) {
                //      if (error) {
                //        //res.status(500).send(
                //        //  failResponse({
                //        //    message: error ? error.message : "Mail Not Sent!"
                //        //  })
                //        //);
                //        res.status(200).send(
                //          successResponse({
                //            message: subject,
                //          })
                //        );
                //      } else {
                res.status(200).send(
                  successResponse({
                    message: subject,
                  })
                );
                //}
                //});
                //}
                //});
              })
            } else {
              res.status(200).send(
                successResponse({
                  message: "Your objective has been " + req.body.objectiveStatus + getPrefix(req.body.objectiveStatus),
                })
              );
            }
          }
        });
      }
    } else {
      res.status(500).send(
        failResponse({
          message: "Objective Not Found!",
        })
      );
    }
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Notification Not Updated!",
      })
    );
  }
};

const updateNotificationGoal = async (req, res) => {
  // #swagger.tags = ['Notifications']
  try {
    const objective = await GoalsModel.findById(req.params.id);
    if (objective) {
      const objectives = await GoalsModel.find({ employeeReferenceId: req.body.row.employeeReferenceId });
      let totalWeight = objectives.reduce((prev, current) => {
        return prev + current.weight
      }, 0);
      if (req.body.objectiveStatus === "Submit" && totalWeight !== 100) {
        res.status(500).send(
          failResponse({
            message: "Total Weight Should Be 100",
          })
        );
      } else {
        GoalsModel.findByIdAndUpdate(req.params.id, req.body, async (err) => {
          if (!err) {
            let path = "";
            if (req.body.objectiveStatus === "Approve") {
              path = "/admin/goals/okrdetails"
            } else {
              path = "/admin/goals"
            }
            let requestBody = {
              title: "Your goal has been " + req.body.objectiveStatus + getPrefix(req.body.objectiveStatus),
              path,
              operation: req.body.objectiveStatus,
              row: req.body.row,
              companyInfo: req.body.companyInfo
            };
            const notificationSettings = await NotificationSettingsModel.find({});
            let subject = "";
            let message = "";
            let toAddress = "";
            let ccAddress = "";
            let attachment = "";
            let active = false;
            if (req.body.objectiveStatus === "Create") {
              subject = notificationSettings[0].actions.filter(item => item.page === "Create Objective")[0].subject;
              message = notificationSettings[0].actions.filter(item => item.page === "Create Objective")[0].message;
              toAddress = notificationSettings[0].actions.filter(item => item.page === "Create Objective")[0].toAddress;
              ccAddress = notificationSettings[0].actions.filter(item => item.page === "Create Objective")[0].ccAddress;
              active = notificationSettings[0].actions.filter(item => item.page === "Create Objective")[0].active;
              attachment = notificationSettings[0].actions.filter(item => item.page === "Create Objective")[0].attachment;
            } else if (req.body.objectiveStatus === "Update") {
              subject = notificationSettings[0].actions.filter(item => item.page === "Update Objective")[0].subject;
              message = notificationSettings[0].actions.filter(item => item.page === "Update Objective")[0].message;
              toAddress = notificationSettings[0].actions.filter(item => item.page === "Update Objective")[0].toAddress;
              ccAddress = notificationSettings[0].actions.filter(item => item.page === "Update Objective")[0].ccAddress;
              active = notificationSettings[0].actions.filter(item => item.page === "Update Objective")[0].active;
              attachment = notificationSettings[0].actions.filter(item => item.page === "Update Objective")[0].attachment;
            } else if (req.body.objectiveStatus === "Delete") {
              subject = notificationSettings[0].actions.filter(item => item.page === "Delete Objective")[0].subject;
              message = notificationSettings[0].actions.filter(item => item.page === "Delete Objective")[0].message;
              toAddress = notificationSettings[0].actions.filter(item => item.page === "Delete Objective")[0].toAddress;
              ccAddress = notificationSettings[0].actions.filter(item => item.page === "Delete Objective")[0].ccAddress;
              active = notificationSettings[0].actions.filter(item => item.page === "Delete Objective")[0].active;
              attachment = notificationSettings[0].actions.filter(item => item.page === "Delete Objective")[0].attachment;
            } else if (req.body.objectiveStatus === "Unlock") {
              subject = notificationSettings[0].actions.filter(item => item.page === "Unlock Objective")[0].subject;
              message = notificationSettings[0].actions.filter(item => item.page === "Unlock Objective")[0].message;
              toAddress = notificationSettings[0].actions.filter(item => item.page === "Unlock Objective")[0].toAddress;
              ccAddress = notificationSettings[0].actions.filter(item => item.page === "Unlock Objective")[0].ccAddress;
              active = notificationSettings[0].actions.filter(item => item.page === "Unlock Objective")[0].active;
              attachment = notificationSettings[0].actions.filter(item => item.page === "Unlock Objective")[0].attachment;
            } else if (req.body.objectiveStatus === "Approve") {
              subject = notificationSettings[0].actions.filter(item => item.page === "Approval")[0].subject;
              message = notificationSettings[0].actions.filter(item => item.page === "Approval")[0].message;
              toAddress = notificationSettings[0].actions.filter(item => item.page === "Approval")[0].toAddress;
              ccAddress = notificationSettings[0].actions.filter(item => item.page === "Approval")[0].ccAddress;
              active = notificationSettings[0].actions.filter(item => item.page === "Approval")[0].active;
              attachment = notificationSettings[0].actions.filter(item => item.page === "Approval")[0].attachment;
            } else if (req.body.objectiveStatus === "Reject") {
              subject = notificationSettings[0].actions.filter(item => item.page === "Reject")[0].subject;
              message = notificationSettings[0].actions.filter(item => item.page === "Reject")[0].message;
              toAddress = notificationSettings[0].actions.filter(item => item.page === "Reject")[0].toAddress;
              ccAddress = notificationSettings[0].actions.filter(item => item.page === "Reject")[0].ccAddress;
              active = notificationSettings[0].actions.filter(item => item.page === "Reject")[0].active;
              attachment = notificationSettings[0].actions.filter(item => item.page === "Reject")[0].attachment;
            } else if (req.body.objectiveStatus === "Submit") {
              subject = notificationSettings[0].actions.filter(item => item.page === "Submission")[0].subject;
              message = notificationSettings[0].actions.filter(item => item.page === "Submission")[0].message;
              toAddress = notificationSettings[0].actions.filter(item => item.page === "Submission")[0].toAddress;
              ccAddress = notificationSettings[0].actions.filter(item => item.page === "Submission")[0].ccAddress;
              active = notificationSettings[0].actions.filter(item => item.page === "Submission")[0].active;
              attachment = notificationSettings[0].actions.filter(item => item.page === "Submission")[0].attachment;
            }
            if (active) {
              let employee = await EmployModel.findOne({ _id: req.body.row.employeeReferenceId });
              let manager = "";
              if (employee.employmentInformation.lineManager !== "") {
                manager = await EmployModel.findOne({ _id: employee.employmentInformation.lineManager });
              }
              //let toMail = employee.contactInformation.email;
              //let ccMail = manager.contactInformation.email;
              subject = subject.replace(/&objective/gi, req.body.row.objective);
              subject = subject.replace(/&amp;objective/gi, req.body.row.objective);
              message = message.replace(/&amp;objective/gi, req.body.row.objective);
              subject = subject.replace(/&amp;employee/gi, employee.personalInformation.firstName + " " + employee.personalInformation.lastName);
              if (manager) {
                subject = subject.replace(/&amp;manager/gi, manager.personalInformation.firstName + " " + manager.personalInformation.lastName);
                message = message.replace(/&amp;manager/gi, manager.personalInformation.firstName + " " + manager.personalInformation.lastName);
              }
              message = message.replace(/&amp;employee/gi, employee.personalInformation.firstName + " " + employee.personalInformation.lastName);
              const newNotification = new NotificationModel(requestBody);
              await newNotification.save().then((err, result) => {
                //ejs.renderFile(pathnotification, { message, subject, attachment, objectiveName: req.body.row.objective, _id: req.body.row._id }, function (err, data) {
                //  if (err) {
                //    console.log(err);
                //  } else {
                //    var mailOptions = {
                //      from: "info@talentspotify.com",
                //      fromname: "Vihanga",
                //      to: "mogiliv3@gmail.com",//toMail,
                //      cc: ["mogiliv3@gmail.com", "aneel@appsdreamz.com"], //ccMail,
                //      subject,
                //      html: data,
                //    };

                //    transporter.sendMail(mailOptions, function (error, info) {
                //      if (error) {
                //        //res.status(500).send(
                //        //  failResponse({
                //        //    message: error ? error.message : "Mail Not Sent!"
                //        //  })
                //        //);
                //        res.status(200).send(
                //          successResponse({
                //            message: subject,
                //          })
                //        );
                //      } else {
                res.status(200).send(
                  successResponse({
                    message: subject,
                  })
                );
                //}
                //});
                //}
                //});
              })
            } else {
              res.status(200).send(
                successResponse({
                  message: "Your goal has been " + req.body.objectiveStatus + getPrefix(req.body.objectiveStatus),
                })
              );
            }
          }
        });
      }
    } else {
      res.status(500).send(
        failResponse({
          message: "Goal Not Found!",
        })
      );
    }
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Notification Not Updated!",
      })
    );
  }
};
module.exports = {
  deleteNotification,
  createNotification,
  updateNotificationTask,
  updateNotificationKR,
  updateNotifications,
  updateNotification,
  getAllNotificationsCount,
  getAllNotificationsByUser,
  getAllNotifications,
  getNotificationById,
  getAllNotificationsByUserAll,
  updateNotificationGoal
};
