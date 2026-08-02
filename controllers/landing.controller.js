require("dotenv").config();
const RequestDemoModel = require('../models/landing.model');
const WishModel = require('../models/wishreminders.model');
const ContactsModel = require('../models/contactus.model');
const CareerModel = require('../models/careers.model');
const EmailModel = require('../models/emailsignup.model');
const employeeModel  = require('../models/employee.model');
var nodemailer = require("nodemailer");
const { sendEmail } = require("../middlewares/recruitment/sendMail");
const isEmailConfigured = Boolean(
  process.env.SMTP_HOST &&
  process.env.SMTP_PORT &&
  process.env.EMAIL_USER &&
  process.env.EMAIL_PASS
);
const path = require("path");
var ejs = require("ejs");
const Theme = require("./themeSetting/ThemeSettingController"); // use controller for util access if needed
const ThemeModel = require("../models/themeSetting/ThemeSettingModel");
var pathrequestDemo = path.resolve(__dirname, "../views/templates/requestDemo.ejs");
var contact = path.resolve(__dirname, "../views/templates/contact.ejs");
var careerTemplate = path.resolve(__dirname, "../views/templates/career.ejs");
var emailsignupTemplate = path.resolve(__dirname, "../views/templates/emailsignup.ejs");
var pathBirthdayDemo = path.resolve(__dirname, "../views/templates/birthday.ejs");
const successResponse = ({ message, data, ...rest }) => ({ success: true, data: data ? data : null, message, ...rest });
const failResponse = ({ message, data, ...rest }) => ({ success: false, data: data ? data : null, message, ...rest });

const requestDemo = async (req, res) => {
  // #swagger.tags = ['Vihanga Landing Page']
  try {
    // Get drynoEmail from body or header
    const drynoEmail = req.body.drynoEmail || req.headers['dryno-email'];
    
    let requestBody = {
      // secondName: req.body.secondName,
      // region: req.body.region,
      fullName: req.body.fullName,
      businessEmail: req.body.businessEmail,
      phoneNumber: req.body.phoneNumber ? req.body.phoneNumber : "",
      sizeOfOrganization: req.body.sizeOfOrganization,
      message: req.body.message ? req.body.message : "",
      address: req.body.address ? req.body.address : "",
      drynoEmail: drynoEmail ? drynoEmail : "",
    }
    
    // Determine email recipients: use drynoEmail if exists, otherwise use default
    const emailRecipients = drynoEmail 
      ? [drynoEmail] 
      : ["aneel@appsdreamz.com", "aneel@talentspotify.com"];
    
    const newRequestDemo = new RequestDemoModel(requestBody);
    await newRequestDemo.save().then((err, result) => {
      const logoUrl = process.env.DEFAULT_LOGO_URL || null;
      ejs.renderFile(pathrequestDemo, { user: requestBody, logoUrl }, function (err, data) {
       if (err) {
         console.log(err);
       } else {
         sendEmail(
           emailRecipients,
           "Request Demo",
           data,
           true,
           () => data
         )
           .then((info) => {
             if (!info || info.success === false) {
               console.log('Email sending error:', info ? info.error : 'Unknown error');
               return res.status(200).send(
                 successResponse({
                   message: 'Request Demo saved successfully but email delivery failed!',
                   id: newRequestDemo._id,
                   emailError: info ? info.error : 'Unknown error'
                 })
               );
             }
             console.log('Email sent successfully:', info);
             return res.status(200).send(
               successResponse({
                 message: 'Request Demo Sent Successfully!',
                 id: newRequestDemo._id,
                 data: newRequestDemo
               })
             );
           })
           .catch((error) => {
             console.log('Email sending error:', error);
             return res.status(200).send(
               successResponse({
                 message: 'Request Demo saved successfully but email delivery failed!',
                 id: newRequestDemo._id,
                 emailError: error.message
               })
             );
           });
       }
      });
    });
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Request Demo Not Sent!"
      })
    );
  }
};

const contactUs = async (req, res) => {
  // #swagger.tags = ['Vihanga Landing Page']
  try {
    let requestBody = {
      name: req.body.name,
      subject: req.body.subject,
      email: req.body.email,
      phone: req.body.phone,
      message: req.body.message,
    }
    const newRequestDemo = new ContactsModel(requestBody);
    await newRequestDemo.save().then((err, result) => {
      const logoUrl = process.env.DEFAULT_LOGO_URL || null;
      ejs.renderFile(contact, { user: requestBody, logoUrl }, function (err, data) {
        if (err) {
          console.log(err);
        } else {
          sendEmail(
            ["aneel@appsdreamz.com", "aneel@talentspotify.com", requestBody.email],
            "Contact Support",
            data,
            true,
            () => data
          )
            .then((info) => {
              if (!info || info.success === false) {
                res.status(200).send(
                  successResponse({
                    message: 'Contact Form Sent Successfully!',
                    id: newRequestDemo._id
                  })
                );
              } else {
                res.status(200).send(
                  successResponse({
                    message: 'Contact Form Submitted Successfully!',
                    id: newRequestDemo._id
                  })
                );
              }
            })
            .catch(() => {
              res.status(200).send(
                successResponse({
                  message: 'Contact Form Sent Successfully!',
                  id: newRequestDemo._id
                })
              );
            });
        }
      });
    });
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Contact Form Not Sent!"
      })
    );
  }
};
const career = async (req, res) => {
  // #swagger.tags = ['Vihanga Landing Page']
  try {
    let requestBody = {
      name: req.body.name,
      linkedinURL: req.body.linkedinURL,
      email: req.body.email,
      phone: req.body.phone,
      cvURL: req.body.cvURL,
    }
    const newRequestDemo = new CareerModel(requestBody);
    const isMailFound = await CareerModel.findOne({ email: requestBody.email });
    if (isMailFound) {
      res.status(200).send(
        failResponse({
          message: "Career Form Already Submitted!"
        })
      );
    } else {
      await newRequestDemo.save().then((err, result) => {
        const logoUrl = process.env.DEFAULT_LOGO_URL || null;
        ejs.renderFile(careerTemplate, { user: requestBody, logoUrl }, function (err, data) {
          if (err) {
            console.log(err);
          } else {
            sendEmail(
              ["aneel@appsdreamz.com", "aneel@talentspotify.com", requestBody.email],
              "New Career Request",
              data,
              true,
              () => data
            )
              .then((info) => {
                if (!info || info.success === false) {
                  res.status(200).send(
                    successResponse({
                      message: 'Career Form Submitted Successfully!',
                      id: newRequestDemo._id
                    })
                  );
                } else {
                  res.status(200).send(
                    successResponse({
                      message: 'Career Form Submitted Successfully!',
                      id: newRequestDemo._id
                    })
                  );
                }
              })
              .catch(() => {
                res.status(200).send(
                  successResponse({
                    message: 'Career Form Submitted Successfully!',
                    id: newRequestDemo._id
                  })
                );
              });
          }
        });
      });
    }
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Career Form Not Sent!"
      })
    );
  }
};
const emailsignup = async (req, res) => {
  // #swagger.tags = ['Vihanga Landing Page']
  try {
    let requestBody = {
      email: req.body.email
    }
    EmailModel.find({ email: req.body.email }, async (err, result) => {
      if (result) {
        res.status(200).send(
          failResponse({
            message: "Email Already Signedup!"
          })
        );
      } else {
        const newRequestDemo = new EmailModel(requestBody);
        await newRequestDemo.save().then((err, result) => {
          const logoUrl = process.env.DEFAULT_LOGO_URL || null;
          ejs.renderFile(emailsignupTemplate, { user: requestBody, logoUrl }, function (err, data) {
            if (err) {
              console.log(err);
            } else {
              sendEmail(
                ["aneel@appsdreamz.com", "aneel@talentspotify.com", requestBody.email],
                "New Email Signup",
                data,
                true,
                () => data
              )
                .then((info) => {
                  if (!info || info.success === false) {
                    res.status(200).send(
                      successResponse({
                        message: 'Email Signup Submitted Successfully!',
                        id: newRequestDemo._id
                      })
                    );
                  } else {
                    res.status(200).send(
                      successResponse({
                        message: 'Email Signup Submitted Successfully!',
                        id: newRequestDemo._id
                      })
                    );
                  }
                })
                .catch(() => {
                  res.status(200).send(
                    successResponse({
                      message: 'Email Signup Submitted Successfully!',
                      id: newRequestDemo._id
                    })
                  );
                });
            }
          });
        });
      }
    })
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Email Signup Not Sent!"
      })
    );
  }
};
const sendBirthdayWish = async (req, res) => {
  // #swagger.tags = ['Vihanga Landing Page']
  try {
    let requestBody = {
      name: req.body.name,
      description: req.body.description,
      email: req.body.email,
      type: req.body.type,
      senderName: req.body.senderName
    }
    console.log('requestBody', requestBody);
    
    // Validate required fields
    if (!requestBody.name || !requestBody.email || !requestBody.type) {
      return res.status(400).send(
        failResponse({
          message: "Name, email, and type are required fields!"
        })
      );
    }
    
    // Validate type
    if (!['Birthday', 'Anniversary'].includes(requestBody.type)) {
      return res.status(400).send(
        failResponse({
          message: "Type must be either 'Birthday' or 'Anniversary'!"
        })
      );
    }
    
    // Check if email service is configured
    if (!isEmailConfigured) {
      return res.status(500).send(
        failResponse({
          message: "Email service is not configured properly! Please check SMTP configuration."
        })
      );
    }
    
    const newWish = new WishModel(requestBody);
    await newWish.save();
    
    const employee = await employeeModel
    .findOne({ $or: [
      { 'contactInformation.email': requestBody.email },
      { 'contactInformation.workEmail': requestBody.email }
    ]})
    .select('employmentInformation.legalEntity personalInformation.firstName personalInformation.lastName companyId')
    .lean();

  const legalEntity = employee?.employmentInformation?.legalEntity;

  requestBody.legalEntity = legalEntity || 'Vihanga';
  let logoUrl = process.env.DEFAULT_LOGO_URL || null;
  try {
    if (employee?.companyId) {
      const theme = await ThemeModel.getCompanyTheme(employee.companyId);
      logoUrl = theme?.logoUrl || logoUrl;
    }
  } catch (e) {}

  const recipientFirstName = employee?.personalInformation?.firstName || '';
  const recipientLastName = employee?.personalInformation?.lastName || '';
  const resolvedRecipientName = `${recipientFirstName} ${recipientLastName}`.trim() || requestBody.name || '';
  requestBody.recipientName = resolvedRecipientName;
    ejs.renderFile(pathBirthdayDemo, { user: requestBody, logoUrl }, function (err, data) {
      if (err) {
        console.log('Template rendering error:', err);
        return res.status(500).send(
          failResponse({
            message: "Email template rendering failed!"
          })
        );
      }
      
      sendEmail(
        requestBody.email,
        `${requestBody.type} Wishes - ${requestBody.legalEntity}`,
        data,
        true,
        () => data
      )
        .then(async (info) => {
          if (!info || info.success === false) {
            console.log('Email sending error:', info ? info.error : 'Unknown error');
            return res.status(200).send(
              successResponse({
                message: `${requestBody.type} wish saved successfully but email delivery failed!`,
                id: newWish._id,
                emailError: info ? info.error : 'Unknown error',
                saved: true
              })
            );
          } else {
            console.log('Email sent successfully:', info);
            return res.status(200).send(
              successResponse({
                message: `${requestBody.type} Wishes Sent Successfully!`,
                id: newWish._id,
                data: newWish,
                emailService: 'Primary'
              })
            );
          }
        })
        .catch((error) => {
          console.log('Email sending error:', error);
          return res.status(200).send(
            successResponse({
              message: `${requestBody.type} wish saved successfully but email delivery failed!`,
              id: newWish._id,
              emailError: error.message,
              saved: true
            })
          );
        });
    });
  } catch (err) {
    console.log('Birthday wish error:', err);
    res.status(500).send(
      failResponse({
        message: err ? err.message : `${req.body.type || 'Wish'} Not Sent!`
      })
    );
  }
};

const getAllWishes = async (req, res) => {
  // #swagger.tags = ['Vihanga Landing Page']
  try {
    const { type, page = 1, limit = 10 } = req.query;
    
    let query = {};
    if (type && ['Birthday', 'Anniversary'].includes(type)) {
      query.type = type;
    }
    
    const skip = (page - 1) * limit;
    
    const wishes = await WishModel.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await WishModel.countDocuments(query);
    
    res.status(200).send(
      successResponse({
        message: 'Wishes retrieved successfully!',
        data: {
          wishes,
          pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(total / limit),
            totalItems: total,
            itemsPerPage: parseInt(limit)
          }
        }
      })
    );
  } catch (err) {
    console.log('Get wishes error:', err);
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Failed to retrieve wishes!"
      })
    );
  }
};

module.exports = {
  requestDemo,
  sendBirthdayWish,
  getAllWishes,
  contactUs,
  career,
  emailsignup
};
