const { isValidDate, totalRewardPoints, totalRewardPointsTask, getDueMessage } = require("../helpers/percentageCalculation");
const TasksModel = require("../models/tasks2.model");
const moment = require("moment");
const EmployModel = require("../models/employee.model");
const RewardsModel = require("../models/rewardManagement.model");
const CommentsModel = require("../models/tasksChat.model");
const AuditTrailModel = require("../models/AuditTrail");
const PrivilegesModel = require("../models/privileges.model");
const RewardPointsModel = require("../models/rewardpoints.model")
const { google } = require('googleapis');
const credentials = require('../public/cred.json');
const KeyResultModel = require("../models/keyResults.model");
const objectivesModel = require("../models/objectives.model");
const CompanyModel = require("../models/company.model");
const mongoose = require("mongoose");
const { sendEmail } = require("../middlewares/recruitment/sendMail");
const { CLIENTURL } = require("../config/environment");
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

function getSpreadsheetIdFromConfig(companyConfig) {
  const url = companyConfig?.googleSheetEditURL;
  if (!url || typeof url !== "string") return null;
  const trimmed = url.trim();
  // URL form: https://docs.google.com/spreadsheets/d/SHEET_ID/edit...
  const match = trimmed.match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (match) return match[1];
  // If it looks like a raw spreadsheet ID (alphanumeric, length ~44)
  if (/^[a-zA-Z0-9-_]{30,}$/.test(trimmed)) return trimmed;
  return null;
}

const createSheet = async (req, res) => {
  try {
    const tasks = req.body?.data || [];
    if (!Array.isArray(tasks) || tasks.length === 0) {
      return res.status(400).send(
        failResponse({ message: "No tasks data provided" })
      );
    }
    const sheets = google.sheets({
      version: 'v4',
      auth: new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      }),
    });

    let sheetId = '1RwvdbJx9BIbuJXz7ljouF4PZFeqAOoAGGiyMih65658';
    let companyConfigEditUrl = null;
    let companyConfig = null;
    const companyId = req.params.companyId;
    if (companyId) {
      try {
        const company = await CompanyModel.findById(companyId).select('config').lean();
        companyConfig = company?.config;
        const fromConfig = getSpreadsheetIdFromConfig(companyConfig);
        if (fromConfig) sheetId = fromConfig;
        companyConfigEditUrl = companyConfig?.googleSheetEditURL;
      } catch (e) {
        // keep default sheetId
      }
    }

    let finalTasks = [];
    tasks.forEach(item => {
      if (item?.children?.length > 0) {
        item.children.forEach(child => finalTasks.push(child));
      }
      finalTasks.push(item);
    });
    let allComments = [];
    finalTasks.forEach(item => {
      const comments = Array.isArray(item.comments) ? item.comments : [];
      if (comments.length > 0) {
        comments.forEach(child => allComments.push({
          ...item,
          comment: child.comment,
        }))
      } else {
        allComments.push({ ...item, comment: "" });
      }
    })

    finalTasks = allComments.map(item => {
      item.owner = item.owner;
      item.title = item.title;
      item.priority = item.priority;
      delete item.comments;
      delete item.children;
      delete item.krReferenceId;
      delete item.__v;
      delete item.linkToKR;
      delete item.recurrenceDetails;
      // delete item.assignTo;
      delete item.targetDate;
      delete item.recurrence;
      item.startDate = item.startDate;
      item.dueDate = item.dueDate;
      item.actualCompletionDate = item.actualCompletionDate;
      return {
        owner: item.owner,
        employeeName: item.employeeName,
        title: item.title,
        description: item.description,
        priority: item.priority,
        status: item.status,
        mainTask: item.mainTask,
        progressStatus: item.progressStatus,
        startDate: item.startDate,
        dueDate: item.dueDate,
        actualCompletionDate: item.actualCompletionDate,
        actualEffort: item.actualEffort,
        estimationEffort: item.estimationEffort,
        rewardPoints: item.rewardPoints,
        companyId: item.companyId,
        userId: item.userId,
        _id: item._id || item.id,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        assignTo: (Array.isArray(item.assignTo) && item.assignTo[0]) || "",
      }
    })
    const range = 'Sheet1';

    if (finalTasks.length === 0) {
      return res.status(400).send(
        failResponse({ message: "No valid task data to export" })
      );
    }

    await sheets.spreadsheets.values.clear({
      spreadsheetId: sheetId,
      range,
    });

    // Update the Google Sheet with data
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range,
      valueInputOption: 'RAW',
      resource: {
        values: [Object.keys(finalTasks[0]), ...finalTasks.map(Object.values)],
      },
    });


    // Write Config sheet so Apps Script onEdit can read WEBHOOK_URL (dynamic from company config or request)
    let webhookUrl;
    const fromWebhookConfig = companyConfig?.webhookURL && typeof companyConfig.webhookURL === "string" && companyConfig.webhookURL.trim();
    const fromSheetEditUrl = companyConfig?.googleSheetEditURL && typeof companyConfig.googleSheetEditURL === "string" && /\/webhook/i.test(companyConfig.googleSheetEditURL);
    if (fromWebhookConfig) {
      webhookUrl = companyConfig.webhookURL.trim();
    } else if (fromSheetEditUrl) {
      webhookUrl = companyConfig.googleSheetEditURL.trim();
    } else {
      const apiBaseFromConfig = companyConfig?.apiBaseURL && typeof companyConfig.apiBaseURL === "string" && companyConfig.apiBaseURL.trim();
      const apiBase = apiBaseFromConfig ? companyConfig.apiBaseURL.trim().replace(/\/$/, "") : `${req.protocol}://${req.get("host")}`;
      webhookUrl = `${apiBase}/api/tasks2/webhook`;
    }
    try {
      const meta = await sheets.spreadsheets.get({ spreadsheetId: sheetId, fields: "sheets.properties" });
      const hasConfig = (meta.data.sheets || []).some((s) => (s.properties?.title || "").toLowerCase() === "config");
      if (!hasConfig) {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: sheetId,
          resource: {
            requests: [{ addSheet: { properties: { title: "Config" } } }],
          },
        });
      }
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: "Config!A1:B3",
        valueInputOption: "RAW",
        resource: {
          values: [
            ["Key", "Value"],
            ["WEBHOOK_URL", webhookUrl],
            ["COMPANY_ID", companyId || ""],
          ],
        },
      });
    } catch (configErr) {
      // non-fatal: sheet export still succeeded
    }

    // Return the actual sheet URL we wrote to: use config URL only if it's a valid Google Sheets URL
    const isGoogleSheetUrl = (url) =>
      typeof url === "string" && /docs\.google\.com\/spreadsheets\/d\//i.test(url.trim());
    const responseUrl =
      companyConfigEditUrl && isGoogleSheetUrl(companyConfigEditUrl)
        ? companyConfigEditUrl.trim()
        : `https://docs.google.com/spreadsheets/d/${sheetId}/edit#gid=0`;

    res.status(200).send(successResponse({
      message: "Google Sheet updated successfully",
      data: responseUrl,
    }));
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Tasks Not Fetched!",
      })
    );
  }
}

const updateSheet = async (req, res) => {
  try {
    const sheets = google.sheets({
      version: 'v4',
      auth: new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      }),
    });

    const sheetId = '1RwvdbJx9BIbuJXz7ljouF4PZFeqAOoAGGiyMih65658';
    const range = 'Sheet1';
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: range,
    });
    const jsonData = [];
    const values = response.data.values;
    if (values.length) {
      // Assuming the first row contains headers
      const headers = values[0];

      // Creating an array to store the JSON objects
      // Loop through rows, starting from the second row
      for (let i = 1; i < values.length; i++) {
        const row = values[i];
        const rowData = {};
        // Loop through columns and populate the JSON object
        for (let j = 0; j < headers.length; j++) {
          if (headers[j] === "assignTo") {
            rowData[headers[j]] = [row[j]];
          } else {
            rowData[headers[j]] = row[j];
          }
        }
        // Add the JSON object to the array
        delete rowData.createdAt;
        delete rowData.updatedAt;
        jsonData.push(rowData);
      }
    } else {
      console.log('No data found.');
    }

    var ops = [];
    jsonData.forEach(item => {
      if (item._id && item._id !== '') {
        ops.push(
          {
            updateOne: {
              filter: { _id: item._id },
              update: {
                $set: item,
              },
              upsert: true
            }
          }
        );
      } else {
        delete item._id;
        ops.push(
          {
            insertOne: {
              document: item
            }
          }
        )
      }
    })
    await TasksModel.bulkWrite(ops, { ordered: false });

    res.status(200).send(response);
  } catch (error) {
    console.error('Error syncing data:', error);
    res.status(500).send('Internal Server Error');
  }
}

const createTask = async (req, res) => {
  // #swagger.tags = ['Tasks V2']
  try {
    let requestBody = {
      title: req.body.title,
      description: req.body.description,
      startDate: isValidDate(req.body.startDate) ? req.body.startDate : null,
      dueDate: isValidDate(req.body.dueDate) ? req.body.dueDate : null,
      actualCompletionDate: isValidDate(req.body.actualCompletionDate) ? req.body.actualCompletionDate : null,
      linkToKR: req.body.linkToKR,
      assignTo: req.body.assignTo,
      priority: req.body.priority,
      comments: req.body.comments,
      attachments: req.body.attachments,
      krReferenceId: req.body.krReferenceId,
      estimationEffort: req.body.estimationEffort,
      actualEffort: req.body.actualEffort,
      status: req.body.status ? req.body.status : "notstarted",
      recurrence: req.body.recurrence,
      recurrenceDetails: req.body.recurrenceDetails,
      mainTask: req.body.mainTask,
      progressStatus: req.body.progressStatus,
      companyId: req.body.companyId,
      userId: req.body.userId,
      jiraKey: req.body.jiraKey || "",
      jiraStatus: req.body.jiraStatus || "",
    };
    let repeatedObjects = [requestBody];
    if (requestBody.recurrence) {
      let repeatMode = requestBody.recurrenceDetails.repeat;
      let repeatTimes = requestBody.recurrenceDetails.every;
      let repeatDays = requestBody.recurrenceDetails.onDays;
      let endDate = requestBody.recurrenceDetails.endDate;
      let newRequestBody = { ...requestBody };
      delete newRequestBody.recurrence;
      delete newRequestBody.recurrenceDetails;
      if (repeatTimes === 1) {
        let index = 0;
        var start = moment(newRequestBody.startDate, "YYYY-MM-DD");
        var end = moment(endDate, "YYYY-MM-DD");
        for (let current = start; current <= end; current.add(1, 'days')) {
          let day = current.format("YYYY-MM-DD");
          if (repeatMode === "Week" && repeatDays.includes(new Date(day).getDay())) {
            let newRequestBody = { ...requestBody };
            delete newRequestBody.recurrence;
            delete newRequestBody.recurrenceDetails;
            newRequestBody.startDate = day;
            newRequestBody.dueDate = day;
            repeatedObjects.push(newRequestBody)
          }
          if (repeatMode === "Month" && repeatDays.includes(new Date(day).getDay())) {
            index = index + 1;
            if (index % 4 === 1) {
              let newRequestBody = { ...requestBody };
              delete newRequestBody.recurrence;
              delete newRequestBody.recurrenceDetails;
              newRequestBody.startDate = day;
              newRequestBody.dueDate = day;
              repeatedObjects.push(newRequestBody)
            }
          }
          if (repeatMode === "Quarter" && repeatDays.includes(new Date(day).getDay())) {
            index = index + 1;
            if (index % 12 === 1) {
              let newRequestBody = { ...requestBody };
              delete newRequestBody.recurrence;
              delete newRequestBody.recurrenceDetails;
              newRequestBody.startDate = day;
              newRequestBody.dueDate = day;
              repeatedObjects.push(newRequestBody)
            }
          }
        }
      } else if (repeatTimes === 2) {
        let index = 0;
        let index2 = 0;
        var start = moment(newRequestBody.startDate, "YYYY-MM-DD");
        var end = moment(endDate, "YYYY-MM-DD");
        for (let current = start; current <= end; current.add(1, 'days')) {
          let day = current.format("YYYY-MM-DD");
          if (repeatMode === "Week" && repeatDays.includes(new Date(day).getDay())) {
            index = index + 1;
            if (index % 2 === 1) {
              let newRequestBody = { ...requestBody };
              delete newRequestBody.recurrence;
              delete newRequestBody.recurrenceDetails;
              newRequestBody.startDate = day;
              newRequestBody.dueDate = day;
              repeatedObjects.push(newRequestBody)
            }
          }
        }
        if (repeatMode === "Month" && repeatDays.includes(new Date(day).getDay())) {
          index = index + 1;
          if (index % 4 === 1) {
            index2 = index2 + 1;
            if (index2 % 2 === 1) {
              let newRequestBody = { ...requestBody };
              delete newRequestBody.recurrence;
              delete newRequestBody.recurrenceDetails;
              newRequestBody.startDate = day;
              newRequestBody.dueDate = day;
              repeatedObjects.push(newRequestBody)
            }
          }
        }
        if (repeatMode === "Quarter" && repeatDays.includes(new Date(day).getDay())) {
          index = index + 1;
          if (index % 12 === 1) {
            index2 = index2 + 1;
            if (index2 % 2 === 1) {
              let newRequestBody = { ...requestBody };
              delete newRequestBody.recurrence;
              delete newRequestBody.recurrenceDetails;
              newRequestBody.startDate = day;
              newRequestBody.dueDate = day;
              repeatedObjects.push(newRequestBody)
            }
          }
        }
      } else if (repeatTimes === 3) {
        let index = 0;
        let index2 = 0;
        var start = moment(newRequestBody.startDate, "YYYY-MM-DD");
        var end = moment(endDate, "YYYY-MM-DD");
        for (let current = start; current <= end; current.add(1, 'days')) {
          let day = current.format("YYYY-MM-DD");
          if (repeatMode === "Week" && repeatDays.includes(new Date(day).getDay())) {
            index = index + 1;
            if (index % 3 === 1) {
              let newRequestBody = { ...requestBody };
              delete newRequestBody.recurrence;
              delete newRequestBody.recurrenceDetails;
              newRequestBody.startDate = day;
              newRequestBody.dueDate = day;
              repeatedObjects.push(newRequestBody)
            }
          }
          if (repeatMode === "Month" && repeatDays.includes(new Date(day).getDay())) {
            index = index + 1;
            if (index % 4 === 1) {
              index2 = index2 + 1;
              if (index2 % 3 === 1) {
                let newRequestBody = { ...requestBody };
                delete newRequestBody.recurrence;
                delete newRequestBody.recurrenceDetails;
                newRequestBody.startDate = day;
                newRequestBody.dueDate = day;
                repeatedObjects.push(newRequestBody)
              }
            }
          }
          if (repeatMode === "Quarter" && repeatDays.includes(new Date(day).getDay())) {
            index = index + 1;
            if (index % 12 === 1) {
              index2 = index2 + 1;
              if (index2 % 3 === 1) {
                let newRequestBody = { ...requestBody };
                delete newRequestBody.recurrence;
                delete newRequestBody.recurrenceDetails;
                newRequestBody.startDate = day;
                newRequestBody.dueDate = day;
                repeatedObjects.push(newRequestBody)
              }
            }
          }
        }
      } else if (repeatTimes === 4) {
        let index = 0;
        let index2 = 0;
        var start = moment(newRequestBody.startDate, "YYYY-MM-DD");
        var end = moment(endDate, "YYYY-MM-DD");
        for (let current = start; current <= end; current.add(1, 'days')) {
          let day = current.format("YYYY-MM-DD");
          if (repeatMode === "Week" && repeatDays.includes(new Date(day).getDay())) {
            index = index + 1;
            if (index % 4 === 1) {
              let newRequestBody = { ...requestBody };
              delete newRequestBody.recurrence;
              delete newRequestBody.recurrenceDetails;
              newRequestBody.startDate = day;
              newRequestBody.dueDate = day;
              repeatedObjects.push(newRequestBody)
            }
          }
          if (repeatMode === "Month" && repeatDays.includes(new Date(day).getDay())) {
            index = index + 1;
            if (index % 4 === 1) {
              index2 = index2 + 1;
              if (index2 % 4 === 1) {
                let newRequestBody = { ...requestBody };
                delete newRequestBody.recurrence;
                delete newRequestBody.recurrenceDetails;
                newRequestBody.startDate = day;
                newRequestBody.dueDate = day;
                repeatedObjects.push(newRequestBody)
              }
            }
          }

          if (repeatMode === "Quarter" && repeatDays.includes(new Date(day).getDay())) {
            index = index + 1;
            if (index % 12 === 1) {
              index2 = index2 + 1;
              if (index2 % 4 === 1) {
                let newRequestBody = { ...requestBody };
                delete newRequestBody.recurrence;
                delete newRequestBody.recurrenceDetails;
                newRequestBody.startDate = day;
                newRequestBody.dueDate = day;
                repeatedObjects.push(newRequestBody)
              }
            }
          }
        }
      }
      repeatedObjects = repeatedObjects.filter((item, index) => index !== 1);
    }
    let tasks = await TasksModel.find({});
    if (req.body.mainTask !== "") {
      let filteredTasks = tasks.filter(item => item._doc.mainTask == req.body.mainTask);
      //fetch sub tasks progress.
      let progresses = filteredTasks.reduce((prev, current) => {
        return prev + Number(current.progressStatus)
      }, 0);
      let updateTask = { progressStatus: (progresses + Number(req.body.progressStatus)) / (filteredTasks.length + 1) };
      updateTask.progressStatus = Number(updateTask.progressStatus).toFixed(2)
      await TasksModel.findByIdAndUpdate(req.body.mainTask, updateTask, async (err, doc) => {
        if (!err) {
          await TasksModel.insertMany(repeatedObjects).then(async (result, err) => {
            if (!err) {
              let auditId = req.auditId.toString();
              await AuditTrailModel.findByIdAndUpdate(auditId, { recordId: result[0]._id }, async (err, doc) => {
                if (!err) {
                  try {
                    const taskTitleForMail = requestBody.title || "Task";
                    const taskDueDateString = requestBody.dueDate ? new Date(requestBody.dueDate).toLocaleDateString('en-US') : null;
                    const companyId = requestBody.companyId || null;

                    // Fetch company name from companyId
                    let companyName = null;
                    if (companyId) {
                      try {
                        const company = await CompanyModel.findById(companyId).select('companyEntityName').lean();
                        companyName = company?.companyEntityName || null;
                      } catch (err) {
                        console.error("Error fetching company name:", err);
                      }
                    }

                    const description = requestBody.description || "";
                    const viewUrl = `${CLIENTURL}/admin/objectives/task?isEdit=true&keyResultId=${requestBody.krReferenceId || ""}&taskId=${result[0]?._id?.toString() || ""}&fromTask=true`;
                    const assigneeIds = Array.isArray(requestBody.assignTo) ? requestBody.assignTo.filter(Boolean) : [];
                    if (assigneeIds.length > 0) {
                      try {
                        const recipients = await EmployModel.find({ _id: { $in: assigneeIds } })
                          .select("contactInformation.email personalInformation.firstName personalInformation.lastName")
                          .lean();
                        for (const r of (recipients || [])) {
                          const to = r?.contactInformation?.email;
                          if (!to) continue;
                          const name = `${r?.personalInformation?.firstName || ""} ${r?.personalInformation?.lastName || ""}`.trim() || "there";
                          const subject = `Task assigned to you: ${taskTitleForMail}`;
                          await sendEmail(
                            to,
                            subject,
                            {
                              name,
                              taskAssigned: true,
                              taskDetails: {
                                taskTitle: taskTitleForMail,
                                dueDate: taskDueDateString || undefined,
                                company: companyName || undefined,
                                description: description || undefined,
                                viewUrl
                              }
                            },
                            true
                          );
                          console.log("Task assignment email sent", {
                            to,
                            subject,
                            name,
                            taskTitle: taskTitleForMail,
                            dueDate: taskDueDateString || null,
                            company: companyName || null,
                            viewUrl
                          });
                        }
                      } catch (mailErr) {
                        console.error("Failed to send task assignment notifications:", mailErr);
                      }
                    }
                  } catch (notifyErr) {
                    console.error("Error during task creation notification:", notifyErr);
                  }
                  res.status(200).send(
                    successResponse({
                      message: "Task Created Successfully!",
                      data: result[0]
                    })
                  );
                } else {
                  res.status(500).send(
                    failResponse({
                      message: "Task Not Created!",
                    })
                  );
                }
              })
            } else {
              res.status(500).send(
                failResponse({
                  message: "Task Not Created!",
                })
              );
            }
          })
        } else {
          res.status(500).send(
            failResponse({
              message: err ? err.message : "Task Not Created!",
            })
          );
        }
      })
    } else {
      await TasksModel.insertMany(repeatedObjects).then(async (result, err) => {
        if (!err) {
          let auditId = req.auditId.toString();
          await AuditTrailModel.findByIdAndUpdate(auditId, { recordId: result[0]._id }, async (err, doc) => {
            if (!err) {
              try {
                const taskTitleForMail = requestBody.title || "Task";
                const taskDueDateString = requestBody.dueDate ? new Date(requestBody.dueDate).toLocaleDateString('en-US') : null;
                const companyId = requestBody.companyId || null;

                // Fetch company name from companyId
                let companyName = null;
                if (companyId) {
                  try {
                    const company = await CompanyModel.findById(companyId).select('companyEntityName').lean();
                    companyName = company?.companyEntityName || null;
                  } catch (err) {
                    console.error("Error fetching company name:", err);
                  }
                }

                const description = requestBody.description || "";
                const viewUrl = `${CLIENTURL}/admin/objectives/task?isEdit=true&keyResultId=${requestBody.krReferenceId || ""}&taskId=${result[0]?._id?.toString() || ""}&fromTask=true`;
                const assigneeIds = Array.isArray(requestBody.assignTo) ? requestBody.assignTo.filter(Boolean) : [];
                if (assigneeIds.length > 0) {
                  try {
                    const recipients = await EmployModel.find({ _id: { $in: assigneeIds } })
                      .select("contactInformation.email personalInformation.firstName personalInformation.lastName")
                      .lean();
                    for (const r of (recipients || [])) {
                      const to = r?.contactInformation?.email;
                      if (!to) continue;
                      const name = `${r?.personalInformation?.firstName || ""} ${r?.personalInformation?.lastName || ""}`.trim() || "there";
                      const subject = `Task assigned to you: ${taskTitleForMail}`;
                      await sendEmail(
                        to,
                        subject,
                        {
                          name,
                          taskAssigned: true,
                          taskDetails: {
                            taskTitle: taskTitleForMail,
                            dueDate: taskDueDateString || undefined,
                            company: companyName || undefined,
                            description: description || undefined,
                            viewUrl
                          }
                        },
                        true
                      );
                      console.log("Task assignment email sent", {
                        to,
                        subject,
                        name,
                        taskTitle: taskTitleForMail,
                        dueDate: taskDueDateString || null,
                        company: companyName || null,
                        viewUrl
                      });
                    }
                  } catch (mailErr) {
                    console.error("Failed to send task assignment notifications:", mailErr);
                  }
                }
              } catch (notifyErr) {
                console.error("Error during task creation notification:", notifyErr);
              }
              res.status(200).send(
                successResponse({
                  message: "Task Created Successfully!",
                  data: result[0]
                })
              );
            } else {
              res.status(500).send(
                failResponse({
                  message: "Task Not Created!",
                })
              );
            }
          })
        } else {
          res.status(500).send(
            failResponse({
              message: "Task Not Created!",
            })
          );
        }
      })
    }
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Task Not Created!",
      })
    );
  }
};

const getAllTasks = async (req, res) => {
  // #swagger.tags = ['Tasks V2']
  try {
    const { userId, companyId } = req.params;
    const { type = 'me', page = 0, limit = 10, search = '' } = req.query;
    const normalizedType = (type || 'me').toString().trim().toLowerCase();

    console.log('Params:', { type, userId, companyId, page, limit, search });

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = pageNum * limitNum;

    let isSuperAdmin = userId !== "all" ? await EmployModel.findOne({
      _id: userId,
      "employmentInformation.status": "Active",
      "employmentInformation.role": "Super Admin"
    }, { status: 1 }) : false;

    let companyObj = {};
    if (!isSuperAdmin) {
      companyObj = { companyId: companyId };
    }

    let commentsObj = userId === "all" ? {} : { employeeId: userId };
    let mainTasks = [];
    let subTasks = [];
    let employees = null;
    let mainComments = [];
    let subComments = [];
    let targetUserIds = []; // Array to store user IDs whose tasks we need to fetch
    let totalCount = 0; // For pagination

    // Build search query if search term is provided
    let searchQuery = {};
    if (search && search.trim()) {
      searchQuery = {
        $or: [
          { title: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } },
          { comments: { $regex: search, $options: 'i' } }
        ]
      };
    }

    if (userId === "all") {
      // Original logic for fetching all tasks with pagination and search
      const mainTaskQuery = {
        companyId: companyId,
        mainTask: "",
        userId: { $exists: true },
        ...searchQuery
      };

      // Get total count for pagination
      totalCount = await TasksModel.countDocuments(mainTaskQuery);

      mainTasks = await TasksModel.find(mainTaskQuery)
        .sort({ _id: -1 })
        .skip(skip)
        .limit(limitNum);

      const mainTaskIds = mainTasks.length > 0 ? mainTasks.map(mainTask => mainTask._id.toString()) : [];

      // Get all subtasks for the main tasks (not paginated)
      subTasks = await TasksModel.find({
        companyId: companyId,
        mainTask: { $in: mainTaskIds },
        userId: { $exists: true }
      }).sort({ _id: -1 });

      const subTaskIds = subTasks.length > 0 ? subTasks.map(subTask => subTask._id.toString()) : [];

      employees = await EmployModel.findOne({
        ...companyObj,
        "employmentInformation.status": "Active"
      }, { "employmentInformation.role": 1 });

      mainComments = await CommentsModel.find({
        ...commentsObj,
        referenceId: { $in: mainTaskIds }
      }).sort({ _id: -1 });

      subComments = await CommentsModel.find({
        ...commentsObj,
        referenceId: { $in: subTaskIds }
      }).sort({ _id: -1 });

    } else {
      if (normalizedType === 'me') {
        targetUserIds = [userId];
      } else if (normalizedType === 'team' || normalizedType === 'myteam') {
        const currentUser = await EmployModel.findOne({
          _id: userId,
          ...companyObj,
          "employmentInformation.status": "Active"
        });
        if (currentUser) {
          // Find all employees who have this user as their line manager
          const teamMembers = await EmployModel.find({
            ...companyObj,
            "employmentInformation.status": "Active",
            "employmentInformation.lineManager": currentUser._id
          }, { _id: 1 });

          targetUserIds = teamMembers.map(member => member._id.toString());
        }
      } else if (normalizedType === 'function' || normalizedType === 'myfunction') {
        const currentUser = await EmployModel.findOne({
          _id: userId,
          ...companyObj,
          "employmentInformation.status": "Active"
        });

        let userFunctions = [];
        if (currentUser && currentUser.employmentInformation) {
          // Add primary department
          if (currentUser.employmentInformation.department) {
            userFunctions.push(currentUser.employmentInformation.department);
          }
          // Add functions from legal entity mappings
          if (currentUser.employmentInformation.legalEntityMappings && Array.isArray(currentUser.employmentInformation.legalEntityMappings)) {
            currentUser.employmentInformation.legalEntityMappings.forEach(mapping => {
              if (mapping.function) {
                userFunctions.push(mapping.function);
              }
            });
          }
        }

        // Remove duplicates
        userFunctions = [...new Set(userFunctions)];

        if (userFunctions.length > 0) {
          // Find all employees in the same department as the current user
          const functionMembers = await EmployModel.find({
            ...companyObj,
            "employmentInformation.status": "Active",
            $or: [
              { "employmentInformation.department": { $in: userFunctions } },
              { "employmentInformation.legalEntityMappings.function": { $in: userFunctions } }
            ]
          }, { _id: 1 });

          targetUserIds = functionMembers.map(member => member._id.toString());
        } else {
          targetUserIds = [userId];
        }
      } else if (normalizedType === 'company' || normalizedType === 'mycompany') {
        const companyEmployees = await EmployModel.find({
          companyId: companyId,
          "employmentInformation.status": "Active"
        }, { _id: 1 });
        targetUserIds = companyEmployees.map(e => e._id.toString());
      } else {
        // Default to 'me' behavior if type is not specified or invalid
        targetUserIds = [userId];
      }


      if (targetUserIds.length === 0) {
        // No target users found, return empty result
        return res.status(200).send(
          successResponse({
            message: "Tasks Retrieved Successfully!",
            data: [],
            privileges: [],
            pagination: {
              currentPage: pageNum,
              totalPages: 0,
              totalCount: 0,
              hasNext: false,
              hasPrev: false
            }
          })
        );
      }

      // Build main task query
      const mainTaskQuery = {
        companyId: companyId,
        assignTo: { $in: targetUserIds },
        mainTask: { $in: ["", null] }, // Handle both empty string and null
        userId: { $exists: true },
        ...searchQuery
      };

      console.log('Main Task Query:', JSON.stringify(mainTaskQuery, null, 2));

      // Get total count for pagination
      totalCount = await TasksModel.countDocuments(mainTaskQuery);
      console.log('Total Count:', totalCount);

      // Fetch main tasks for target users with pagination
      mainTasks = await TasksModel.find(mainTaskQuery)
        .sort({ _id: -1 })
        .skip(skip)
        .limit(limitNum);

      console.log('Main Tasks Found:', mainTasks.length);

      const mainTaskIds = mainTasks.length > 0 ? mainTasks.map(mainTask => mainTask._id.toString()) : [];

      // Fetch sub tasks for the main tasks (not paginated)
      subTasks = await TasksModel.find({
        companyId: companyId,
        assignTo: { $in: targetUserIds },
        mainTask: { $in: mainTaskIds },
        userId: { $exists: true }
      }).sort({ _id: -1 });

      const subTaskIds = subTasks.length > 0 ? subTasks.map(subTask => subTask._id.toString()) : [];

      // Get employee details for the requesting user (for privileges)
      employees = await EmployModel.findOne({
        _id: userId,
        ...companyObj,
        "employmentInformation.status": "Active"
      }, { "employmentInformation.role": 1 });

      // Update comments query based on type
      if (normalizedType === 'team' || normalizedType === 'myteam' || normalizedType === 'function' || normalizedType === 'myfunction') {
        // For team view, get comments from all team members
        commentsObj = { employeeId: { $in: targetUserIds } };
      } else {
        // For 'me' view, keep original logic
        commentsObj = { employeeId: userId };
      }

      mainComments = await CommentsModel.find({
        ...commentsObj,
        referenceId: { $in: mainTaskIds }
      }).sort({ _id: -1 });

      subComments = await CommentsModel.find({
        ...commentsObj,
        referenceId: { $in: subTaskIds }
      }).sort({ _id: -1 });
    }

    // Calculate pagination info
    const totalPages = Math.ceil(totalCount / limitNum);
    const hasNext = pageNum < totalPages - 1;
    const hasPrev = pageNum > 0;

    if (mainTasks.length > 0) {
      const users = await EmployModel.find({
        "employmentInformation.status": "Active"
      }).sort({ _id: 1 });

      const rewards = await RewardsModel.findOne({ companyId: companyId }, {
        taskAchievementPercent: 1,
        taskAchievementPoints: 1,
        subTaskAchievementPercent: 1,
        subTaskAchievementPoints: 1
      });

      const isRewardsFound = !!rewards;
      let taskAchievementPercent = isRewardsFound ? rewards.taskAchievementPercent : 0;
      let taskAchievementPoints = isRewardsFound ? rewards.taskAchievementPoints : 0;
      let subTaskAchievementPercent = isRewardsFound ? rewards.subTaskAchievementPercent : 0;
      let subTaskAchievementPoints = isRewardsFound ? rewards.subTaskAchievementPoints : 0;

      const privileges = !!employees ? await PrivilegesModel.findOne({
        role: employees.employmentInformation.role,
        companyId: companyId
      }).sort({ _id: -1 }) : [];
      console.log(mainTasks)
      const finalTasks = mainTasks.map(task => {
        let rewardPoints = totalRewardPointsTask(task.progressStatus, taskAchievementPercent, taskAchievementPoints);
        let userName = users.find(user => user._id.toString() === task.userId);
        let userNameAssigned = users.find(user => user._id.toString() === task.assignTo[0]);
        let dueMessage = getDueMessage(task);

        let children = subTasks.filter(item => item.mainTask === task._id.toString()).map(item => {
          let subUserName = users.find(user => user._id.toString() === item.userId);
          let subUserNameAssigned = users.find(user => user._id.toString() === item.assignTo[0]);
          let rewardPoints = totalRewardPointsTask(item.progressStatus, subTaskAchievementPercent, subTaskAchievementPoints);
          let dueMessage = getDueMessage(item);

          return {
            ...item._doc,
            dueMessage,
            owner: subUserName ? `${subUserName?.personalInformation?.firstName || ''} ${subUserName?.personalInformation?.lastName || ''}`.trim() : "",
            employeeName: subUserNameAssigned ? `${subUserNameAssigned?.personalInformation?.firstName || ''} ${subUserNameAssigned?.personalInformation?.lastName || ''}`.trim() : "",
            rewardPoints,
            profilePicture: subUserName ? subUserName.personalInformation?.profilePicture || "" : "",
            comments: subComments.filter((comment) => comment.referenceId === item._id.toString())
          }
        });

        return {
          ...task._doc,
          dueMessage,
          owner: userName ? `${userName?.personalInformation?.firstName || ''} ${userName?.personalInformation?.lastName || ''}`.trim() : "",
          employeeName: userNameAssigned ? `${userNameAssigned?.personalInformation?.firstName || ''} ${userNameAssigned?.personalInformation?.lastName || ''}`.trim() : "",
          profilePicture: userName ? userName?.personalInformation?.profilePicture || "" : "",
          rewardPoints,
          children,
          comments: mainComments.filter((comment) => comment.referenceId === task._id.toString())
        }
      });

      res.status(200).send(
        successResponse({
          message: "Tasks Retrieved Successfully!",
          data: finalTasks,
          privileges: !!privileges ? [privileges] : [],
          pagination: {
            currentPage: pageNum,
            totalPages,
            totalCount,
            hasNext,
            hasPrev,
            limit: limitNum
          }
        })
      );
    } else {
      res.status(200).send(
        successResponse({
          message: "Tasks Retrieved Successfully!",
          data: [],
          privileges: [],
          pagination: {
            currentPage: pageNum,
            totalPages: Math.ceil(totalCount / limitNum),
            totalCount,
            hasNext: false,
            hasPrev: pageNum > 0,
            limit: limitNum
          }
        })
      );
    }
  } catch (err) {
    console.error('Error in getAllTasks:', err);
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Tasks Not Fetched!",
      })
    );
  }
};

const getTasksByID = async (req, res) => {
  // #swagger.tags = ['Tasks V2']
  try {
    const tasks = await TasksModel.find({ _id: req.params.id }).sort({ _id: -1 });
    // const mainTasks = Tasks.filter((item) => item.mainTask == '')
    // const subTasks = Tasks.filter((item) => item.mainTask !== '')
    // console.log("mainTasks", mainTasks)
    // console.log("subTasks", subTasks)
    // const finalTasks = mainTasks.map(task => {
    //   let children = subTasks.filter(item => item.mainTask === task._id.toString())
    //   return { ...task._doc, children }
    // })
    // console.log("finalTasks", finalTasks)
    res.status(200).send(
      successResponse({
        message: "Tasks Retrieved Successfully!",
        data: tasks[0],
      })
    );
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Tasks Not Fetched!",
      })
    );
  }
};

const getTasksByRole = async (req, res) => {
  // #swagger.tags = ['Tasks V2']
  try {
    const rewards = await RewardsModel.find({ companyId: req.params.companyId }).sort({ _id: -1 });
    let commentsObj = req.params.userId === "all" ? {} : { employeeId: req.params.userId };
    const comments = await CommentsModel.find(commentsObj).sort({ _id: -1 });
    //const users = await EmployModel.find({}).sort({ _id: 1 });
    let taskAchievementPercent = rewards.length > 0 ? rewards[0].taskAchievementPercent : 0;
    let taskAchievementPoints = rewards.length > 0 ? rewards[0].taskAchievementPoints : 0;
    let subTaskAchievementPercent = rewards.length > 0 ? rewards[0].subTaskAchievementPercent : 0;
    let subTaskAchievementPoints = rewards.length > 0 ? rewards[0].subTaskAchievementPoints : 0;
    let Tasks = [];
    let users = [];
    if (req.params.userId === "all") {
      Tasks = await TasksModel.find({ companyId: req.params.companyId }).sort({ _id: -1 });
      users = await EmployModel.find({ companyId: req.params.companyId, "employmentInformation.status": "Active" }).sort({ _id: -1 });
    } else {
      users = await EmployModel.find({ companyId: req.params.companyId, "employmentInformation.status": "Active" }).sort({ _id: -1 });
      Tasks = await TasksModel.find({ companyId: req.params.companyId, assignTo: { $in: [req.params.userId] } }).sort({ dueDate: 1 });
    }
    //const Tasks = await TasksModel.find({}).sort({ _id: -1 });
    const userData = await EmployModel.findOne({ _id: req.params.id, "employmentInformation.status": "Active" }).sort({ _id: -1 });
    const myTeam = (userData && userData.employmentInformation.role === "HR Admin" || userData.employmentInformation.role === "Super Admin") ? users : users.filter((item) => item.employmentInformation.lineManager == req.params.ownerId)
    const mainTasks = Tasks.filter((item) => item.mainTask == '')
    const subTasks = Tasks.filter((item) => item.mainTask !== '')
    const finalTasks = mainTasks.filter(item => !item.assignTo.includes(null)).map(task => {
      let rewardPoints = totalRewardPointsTask(task.progressStatus, taskAchievementPercent, taskAchievementPoints);
      let commentsMain = comments.filter(item => item.referenceId).filter(item => item.referenceId == task._id.toString());
      let userName = users.filter(user => user._id == task.assignTo[0])[0];
      let children = subTasks.filter(item => item.mainTask === task._id.toString()).map(item => {
        let userName = users.filter(user => user._id == task.assignTo[0])[0];
        let rewardPoints = totalRewardPointsTask(item.progressStatus, subTaskAchievementPercent, subTaskAchievementPoints);
        let commentsSub = comments.filter(itemm => itemm.referenceId == item._id.toString());
        return { ...item._doc, owner: userName ? userName.personalInformation.firstName + " " + userName.personalInformation.lastName : "", rewardPoints, profilePicture: userName ? userName.personalInformation.profilePicture : "", comments: commentsSub }
      })
      return { ...task._doc, owner: userName ? userName.personalInformation.firstName + " " + userName.personalInformation.lastName : "", profilePicture: userName ? userName.personalInformation.profilePicture : "", rewardPoints, children, comments: commentsMain }
    })
    const myteamTasks = finalTasks.filter((item) => {
      const data = myTeam.filter((item2) => item2._id.toString() === item.assignTo[0])
      if (data.length > 0) {
        return true
      }
    })
    res.status(200).send(
      successResponse({
        message: "Tasks Retrieved Successfully!",
        data: {
          myTeam: myTeam,
          myteamTasks: myteamTasks
        },
      })
    );
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Tasks Not Fetched!",
      })
    );
  }
};


const deleteTask = async (req, res) => {
  // #swagger.tags = ['Tasks V2']
  const tasks = await TasksModel.find({}).sort({ _id: -1 });
  let filteredTasks = tasks.filter(item => item._doc._id == req.params.id);
  let mainTaskId = filteredTasks[0]?.mainTask;
  if (mainTaskId !== "") {
    let filteredTasksSub = tasks.filter(item => item._doc.mainTask == mainTaskId);
    //fetch sub tasks progress.
    let progresses = filteredTasksSub.reduce((prev, current) => {
      return prev + current.progressStatus
    }, 0);
    progresses = progresses - filteredTasks[0]?.progressStatus;
    let updateTask = { progressStatus: filteredTasksSub.length > 1 ? (Number(progresses) / Number(filteredTasksSub.length - 1)) : 0 };
    updateTask.progressStatus = Number(updateTask.progressStatus).toFixed(updateTask.progressStatus > 0 ? 2 : 0);
    await TasksModel.findByIdAndUpdate(mainTaskId, updateTask, async (err, doc) => {
      if (!err) {
        let auditId = req.auditId.toString();
        await AuditTrailModel.findByIdAndUpdate(auditId, { recordId: req.params.id }, (err, doc) => {
          if (!err) {
            TasksModel.findByIdAndRemove({ _id: req.params.id }, (err) => {
              if (!err) {
                res.status(200).send(
                  successResponse({
                    message: "Task Deleted Successfully!",
                  })
                );
              } else {
                res.status(500).send(
                  failResponse({
                    message: err ? err.message : "Task Not Deleted!",
                  })
                );
              }
            });
          } else {
            res.status(500).send(
              failResponse({
                message: err ? err.message : "Task Not Deleted!",
              })
            );
          }
        });

      } else {
        res.status(500).send(
          failResponse({
            message: err ? err.message : "Task Not Deleted!",
          })
        );
      }
    });
  } else {
    let auditId = req.auditId.toString();
    await AuditTrailModel.findByIdAndUpdate(auditId, { recordId: req.params.id }, (err, doc) => {
      if (!err) {
        TasksModel.findByIdAndRemove({ _id: req.params.id }, (err) => {
          if (!err) {
            res.status(200).send(
              successResponse({
                message: "Task Deleted Successfully!",
              })
            );
          } else {
            res.status(500).send(
              failResponse({
                message: err ? err.message : "Task Not Deleted!",
              })
            );
          }
        });
      } else {
        res.status(500).send(
          failResponse({
            message: err ? err.message : "Task Not Deleted!",
          })
        );
      }
    })
  }
};




const approveTask = async (req, res) => {
  // #swagger.tags = ['Tasks V2']
  try {
    const { taskId, isApproved, rewardPoints } = req.body;

    // Validate required fields
    if (!taskId || !isApproved || rewardPoints === undefined) {
      return res.status(400).send(
        failResponse({
          message: "taskId, isApproved, and rewardPoints are required fields"
        })
      );
    }

    // Validate isApproved value
    if (!['approved', 'rejected'].includes(isApproved)) {
      return res.status(400).send(
        failResponse({
          message: "isApproved must be either 'approved' or 'rejected'"
        })
      );
    }

    // Find the task
    const task = await TasksModel.findById(taskId);
    if (!task) {
      return res.status(404).send(
        failResponse({
          message: "Task not found"
        })
      );
    }

    // Update task status based on approval
    const statusUpdate = isApproved === 'approved' ? 'approved' : 'rejected';
    await TasksModel.findByIdAndUpdate(taskId, {
      status: statusUpdate,

    });

    // Handle reward points
    if (rewardPoints > 0) {
      try {
        // Find existing reward points record
        const existingRewardPoints = await RewardPointsModel.findOne({
          referenceID: taskId,
          type: "Task"
        });

        if (existingRewardPoints) {
          // Update existing record
          await RewardPointsModel.findByIdAndUpdate(existingRewardPoints._id, {
            rewardPoints: rewardPoints,
            isApproved: isApproved,
            employeeReferenceId: task.assignTo && task.assignTo[0] ? task.assignTo[0] : task.userId
          });
        } else {
          // Create new reward points record
          const newRewardPoints = new RewardPointsModel({
            referenceID: taskId,
            employeeReferenceId: task.assignTo && task.assignTo[0] ? task.assignTo[0] : task.userId,
            type: "Task",
            rewardPoints: rewardPoints,
            isApproved: isApproved
          });
          await newRewardPoints.save();
        }
      } catch (rewardErr) {
        console.error('Error handling reward points:', rewardErr);
        // Don't fail the task approval if reward points fail
      }
    }

    res.status(200).send(
      successResponse({
        message: `Task ${isApproved} successfully!`,
        data: {
          taskId: taskId,
          status: statusUpdate,
          rewardPoints: rewardPoints,
          isApproved: isApproved
        }
      })
    );

  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Task approval failed!",
      })
    );
  }
};

const updateTask = async (req, res) => {
  // #swagger.tags = ['Tasks V2']
  try {
    const task = await TasksModel.findById(req.params.id);
    if (task) {
      // Detect newly added assignees (assignTo is an array)
      const previousAssignees = Array.isArray(task.assignTo) ? task.assignTo.map(id => id?.toString()) : [];
      const hasAssignToInRequest = Object.prototype.hasOwnProperty.call(req.body, "assignTo");
      const nextAssignees = hasAssignToInRequest && Array.isArray(req.body.assignTo)
        ? req.body.assignTo.map(id => id?.toString())
        : previousAssignees;
      const newlyAddedAssigneeIds = nextAssignees.filter(id => !!id && !previousAssignees.includes(id));
      // Prepare details for notification
      const taskTitleForMail = req.body.title || task.title || "Task";
      const taskDueDate = req.body.dueDate || task.dueDate || null;
      const taskDueDateString = taskDueDate ? new Date(taskDueDate).toLocaleDateString('en-US') : null;
      const companyId = req.body.companyId || task.companyId;

      // Fetch company name from companyId
      let companyName = null;
      if (companyId) {
        try {
          const company = await CompanyModel.findById(companyId).select('companyEntityName').lean();
          companyName = company?.companyEntityName || null;
        } catch (err) {
          console.error("Error fetching company name:", err);
        }
      }

      let dynamicRewardPoints = 0;
      if (Number(req.body.progressStatus) == 100) {

        const { krReferenceId } = task;

        // If no KR is linked, set reward points to 0 and continue with normal update
        if (!krReferenceId || krReferenceId === "" || krReferenceId === null) {
          dynamicRewardPoints = 0;
        } else {
          const keyResult = await KeyResultModel.findById(krReferenceId);
          if (!keyResult) {
            dynamicRewardPoints = 0;
          } else {
            const objective = await objectivesModel.findById(keyResult.objectiveId);
            if (!objective) {
              dynamicRewardPoints = 0;
            } else {
              const weight = Number(objective?.weight) || 0;
              dynamicRewardPoints = ((Number(req.body.dynamicRewardPoints) || 0) * weight) / 100;
            }
          }
        }
      }

      // Extract approvalRequired from request body
      const approvalRequired = req.body.approvalRequired || false;

      let tasks = await TasksModel.find({});
      if (req.body.mainTask !== "") {
        let filteredTasks = tasks.filter(item => item._doc.mainTask == req.body.mainTask);
        let progresses = filteredTasks.reduce((prev, current) => {
          return prev + Number(current.progressStatus)
        }, 0);
        let existingProgress = filteredTasks.filter(item => item._id == req.params.id);
        progresses = progresses - existingProgress[0].progressStatus;
        let updateTask = { progressStatus: (progresses + Number(req.body.progressStatus)) / filteredTasks.length };
        updateTask.progressStatus = Number(updateTask.progressStatus).toFixed(2)
        await TasksModel.findByIdAndUpdate(req.body.mainTask, updateTask, async (err, doc) => {
          if (!err) {
            // First, update the task with basic data
            TasksModel.findByIdAndUpdate(req.params.id, req.body, async (err, result) => {
              if (!err) {
                let auditId = req.auditId.toString();
                await AuditTrailModel.findByIdAndUpdate(auditId, { recordId: req.params.id }, async (error, doc) => {
                  if (!error) {
                    // Notify newly added assignees (if any)
                    if (newlyAddedAssigneeIds && newlyAddedAssigneeIds.length > 0) {
                      try {
                        const recipients = await EmployModel.find({ _id: { $in: newlyAddedAssigneeIds } })
                          .select("contactInformation.email personalInformation.firstName personalInformation.lastName")
                          .lean();
                        for (const r of (recipients || [])) {
                          const to = r?.contactInformation?.email;
                          if (!to) continue;
                          const name = `${r?.personalInformation?.firstName || ""} ${r?.personalInformation?.lastName || ""}`.trim() || "there";
                          const subject = `Task assigned to you: ${taskTitleForMail}`;
                          const viewUrl = `${CLIENTURL}/admin/objectives/task?isEdit=true&keyResultId=${task?.krReferenceId || ""}&taskId=${task?._id?.toString() || req.params.id}&fromTask=true`;
                          await sendEmail(
                            to,
                            subject,
                            {
                              name,
                              taskAssigned: true,
                              taskDetails: {
                                taskTitle: taskTitleForMail,
                                dueDate: taskDueDateString || undefined,
                                company: companyName || undefined,
                                description: req.body.description || task?.description || undefined,
                                viewUrl
                              }
                            },
                            true
                          );
                          console.log("Task assignment email sent", {
                            to,
                            subject,
                            name,
                            taskTitle: taskTitleForMail,
                            dueDate: taskDueDateString || null,
                            company: companyName || null,
                            viewUrl
                          });
                        }
                      } catch (mailErr) {
                        console.error("Failed to send task assignment notifications:", mailErr);
                      }
                    }
                    // Handle additional logic for progressStatus 100
                    if (req.body.progressStatus == 100) {
                      if (approvalRequired === false) {
                        // No approval required - add reward points and mark as approved
                        if (dynamicRewardPoints > 0) {
                          try {
                            const taskData = await TasksModel.findById(req.params.id);
                            const existingRewardPoints = await RewardPointsModel.findOne({
                              referenceID: req.params.id,
                              type: "Task",
                              isApproved: "approved"
                            });

                            if (existingRewardPoints) {
                              const updatedRewardPoints = existingRewardPoints.rewardPoints + dynamicRewardPoints;
                              await RewardPointsModel.findByIdAndUpdate(existingRewardPoints._id, {
                                rewardPoints: updatedRewardPoints,
                                employeeReferenceId: taskData.assignTo && taskData.assignTo[0] ? taskData.assignTo[0] : taskData.userId,
                                isApproved: "approved"
                              });
                            } else {
                              const newRewardPoints = new RewardPointsModel({
                                referenceID: req.params.id,
                                employeeReferenceId: taskData.assignTo && taskData.assignTo[0] ? taskData.assignTo[0] : taskData.userId,
                                type: "Task",
                                rewardPoints: dynamicRewardPoints,
                                isApproved: "approved"
                              });
                              await newRewardPoints.save();
                            }
                          } catch (rewardErr) {
                            console.error('Error adding reward points:', rewardErr);
                          }
                        }
                        // Update task with approval status
                        await TasksModel.findByIdAndUpdate(req.params.id, {
                          isApproved: "approved"
                        });
                      } else {
                        // Approval required - store in pending object and don't add reward points
                        const pendingData = {
                          dynamicRewardPoints: dynamicRewardPoints,
                          approvalRequired: approvalRequired,
                          progressStatus: req.body.progressStatus,
                          timestamp: new Date()
                        };
                        await TasksModel.findByIdAndUpdate(req.params.id, {
                          pending: pendingData,
                          isApproved: "pending"
                        });
                      }
                    }

                    res.status(200).send(
                      successResponse({
                        data: {
                          ...result._doc,
                          rewardPoints: dynamicRewardPoints,
                          approvalRequired: approvalRequired,
                          isApproved: "approved"
                        },
                        message: "Task Updated Successfully!",
                      })
                    );
                  } else {
                    res.status(500).send(
                      failResponse({
                        message: error ? error.message : "Task Not Updated!",
                      })
                    );
                  }
                });
              } else {
                res.status(500).send(
                  failResponse({
                    message: err ? err.message : "Task Not Updated!",
                  })
                );
              }
            });
          } else {
            res.status(500).send(
              failResponse({
                message: err ? err.message : "Task Not Updated!",
              })
            );
          }
        });
      } else {
        let filteredTasks = tasks.filter(item => item._doc.mainTask == req.params.id);
        let taskIds = filteredTasks.map(task => task._doc._id);
        let updateTask = { progressStatus: req.body.progressStatus };
        updateTask.progressStatus = Number(updateTask.progressStatus).toFixed(2)
        TasksModel.updateMany({ _id: { $in: taskIds } }, { $set: updateTask }, (err) => {
          if (!err) {
            // First, update the task with basic data
            TasksModel.findByIdAndUpdate(req.params.id, req.body, async (err, result) => {
              if (!err) {
                let auditId = req.auditId.toString();
                await AuditTrailModel.findByIdAndUpdate(auditId, { recordId: req.params.id }, async (error, doc) => {
                  if (!error) {
                    // Notify newly added assignees (if any)
                    if (newlyAddedAssigneeIds && newlyAddedAssigneeIds.length > 0) {
                      try {
                        const recipients = await EmployModel.find({ _id: { $in: newlyAddedAssigneeIds } })
                          .select("contactInformation.email personalInformation.firstName personalInformation.lastName")
                          .lean();
                        for (const r of (recipients || [])) {
                          const to = r?.contactInformation?.email;
                          if (!to) continue;
                          const name = `${r?.personalInformation?.firstName || ""} ${r?.personalInformation?.lastName || ""}`.trim() || "there";
                          const subject = `Task assigned to you: ${taskTitleForMail}`;
                          const viewUrl = `${CLIENTURL}/admin/objectives/task?isEdit=true&keyResultId=${task?.krReferenceId || ""}&taskId=${task?._id?.toString() || req.params.id}&fromTask=true`;
                          await sendEmail(
                            to,
                            subject,
                            {
                              name,
                              taskAssigned: true,
                              taskDetails: {
                                taskTitle: taskTitleForMail,
                                dueDate: taskDueDateString || undefined,
                                company: companyName || undefined,
                                description: req.body.description || task?.description || undefined,
                                viewUrl
                              }
                            },
                            true
                          );
                          console.log("Task assignment email sent", {
                            to,
                            subject,
                            name,
                            taskTitle: taskTitleForMail,
                            dueDate: taskDueDateString || null,
                            company: companyName || null,
                            viewUrl
                          });
                        }
                      } catch (mailErr) {
                        console.error("Failed to send task assignment notifications:", mailErr);
                      }
                    }
                    // Handle additional logic for progressStatus 100
                    if (req.body.progressStatus == 100) {
                      if (approvalRequired === false) {
                        // No approval required - add reward points and mark as approved
                        if (dynamicRewardPoints > 0) {
                          try {
                            const taskData = await TasksModel.findById(req.params.id);
                            const existingRewardPoints = await RewardPointsModel.findOne({
                              referenceID: req.params.id,
                              type: "Task",
                              isApproved: "approved"
                            });

                            if (existingRewardPoints) {
                              const updatedRewardPoints = existingRewardPoints.rewardPoints + dynamicRewardPoints;
                              await RewardPointsModel.findByIdAndUpdate(existingRewardPoints._id, {
                                rewardPoints: updatedRewardPoints,
                                employeeReferenceId: taskData.assignTo && taskData.assignTo[0] ? taskData.assignTo[0] : taskData.userId,
                                isApproved: "approved"
                              });
                            } else {
                              const newRewardPoints = new RewardPointsModel({
                                referenceID: req.params.id,
                                employeeReferenceId: taskData.assignTo && taskData.assignTo[0] ? taskData.assignTo[0] : taskData.userId,
                                type: "Task",
                                rewardPoints: dynamicRewardPoints,
                                isApproved: "approved"
                              });
                              await newRewardPoints.save();
                            }
                          } catch (rewardErr) {
                            console.error('Error adding reward points:', rewardErr);
                          }
                        }
                        // Update task with approval status
                        await TasksModel.findByIdAndUpdate(req.params.id, {
                          isApproved: "approved"
                        });
                      } else {
                        // Approval required - store in pending object and don't add reward points
                        const pendingData = {
                          dynamicRewardPoints: dynamicRewardPoints,
                          approvalRequired: approvalRequired,
                          progressStatus: req.body.progressStatus,
                          timestamp: new Date()
                        };
                        await TasksModel.findByIdAndUpdate(req.params.id, {
                          pending: pendingData,
                          isApproved: "pending"
                        });
                      }
                    }

                    res.status(200).send(
                      successResponse({
                        data: {
                          ...result._doc,
                          rewardPoints: dynamicRewardPoints,
                          approvalRequired: approvalRequired,
                          isApproved: "approved"
                        },
                        message: "Task Updated Successfully!",
                      })
                    );
                  } else {
                    res.status(500).send(
                      failResponse({
                        message: error ? error.message : "Task Not Updated!",
                      })
                    );
                  }
                });
              } else {
                res.status(500).send(
                  failResponse({
                    message: err ? err.message : "Task Not Updated!",
                  })
                );
              }
            });
          } else {
            res.status(500).send(
              failResponse({
                message: err ? err.message : "Task Not Updated!",
              })
            );
          }
        });
      }
    }
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Task Not Updated!",
      })
    );
  }
};


const deleteTasks = (req, res) => {
  // #swagger.tags = ['Tasks V2']
  TasksModel.deleteMany({ _id: { $in: req.body.data } }, (err) => {
    if (!err) {
      res.status(200).send(
        successResponse({
          message: "Tasks Deleted Successfully!",
        })
      );
    } else {
      res.status(500).send(
        failResponse({
          message: err ? err.message : "Tasks Not Deleted!",
        })
      );
    }
  });

};


const UpdateMultipleTasks = async (req, res) => {
  // #swagger.tags = ['Tasks V2']
  try {
    const items = req.body.data;
    var ops = [];
    items.forEach(item => {
      if (item._id) {
        ops.push(
          {
            updateOne: {
              filter: { _id: item._id },
              update: {
                $set: {
                  status: item.status
                },
              },
              upsert: true
            }
          }
        );
      }
    })
    await TasksModel.bulkWrite(ops, { ordered: false });
    res.status(200).send(
      successResponse({
        message: 'Tasks Updated Successfully!',
      })
    );
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Tasks Not Updated!"
      })
    );
  }
};
const getAuditTrail = async (req, res) => {
  // #swagger.tags = ['Tasks V2']
  try {
    let auditHistory = await AuditTrailModel.find({ recordId: req.params.recordId }).sort({ _id: 1 });
    const users = await EmployModel.find({ "employmentInformation.status": "Active" }).sort({ _id: 1 });
    auditHistory = auditHistory.map((item) => {
      let userName = users.filter(user => user._id == item.userId)[0];
      return {
        ...item._doc,
        userName: userName.personalInformation.firstName + " " + userName.personalInformation.lastName
      }
    })
    res.status(200).send(
      successResponse({
        message: "Audit History Retrieved Successfully!",
        data: auditHistory,
      })
    );
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Audit History Not Fetched!",
      })
    );
  }
};

const copyTask = async (req, res) => {
  // #swagger.tags = ['Tasks V2']
  try {
    const originalTask = await TasksModel.findById(req.params.id);
    if (!originalTask) {
      return res.status(404).send(
        failResponse({
          message: "Task Not Found!",
        })
      );
    }

    // Create a copy of the task with the same data but new ID
    const taskCopy = {
      title: originalTask.title,
      description: originalTask.description,
      startDate: originalTask.startDate,
      dueDate: originalTask.dueDate,
      actualCompletionDate: originalTask.actualCompletionDate,
      linkToKR: originalTask.linkToKR,
      assignTo: originalTask.assignTo,
      priority: originalTask.priority,
      comments: originalTask.comments,
      attachments: originalTask.attachments,
      krReferenceId: originalTask.krReferenceId,
      estimationEffort: originalTask.estimationEffort,
      actualEffort: originalTask.actualEffort,
      status: originalTask.status,
      recurrence: originalTask.recurrence,
      recurrenceDetails: originalTask.recurrenceDetails,
      mainTask: originalTask.mainTask,
      progressStatus: originalTask.progressStatus,
      companyId: originalTask.companyId,
      userId: originalTask.userId
    };

    const newTask = await TasksModel.create(taskCopy);
    res.status(200).send(
      successResponse({
        message: "Task Copied Successfully!",
        data: newTask
      })
    );
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Task Not Copied!",
      })
    );
  }
};

module.exports = {
  deleteTask,
  createTask,
  updateTask,
  approveTask,
  getAllTasks,
  getTasksByID,
  deleteTasks,
  getTasksByRole,
  UpdateMultipleTasks,
  getAuditTrail,
  createSheet,
  updateSheet,
  copyTask
};
