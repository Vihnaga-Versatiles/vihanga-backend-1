const ReviewFormModel = require("../models/reviewForm.model");
const TemplateModel = require("../models/templateScreen.model");
const LaunchFormModel = require("../models/launchForms.model");
const LookupModel = require("../models/Lookups/Lookups");
const EmployeeModel = require("../models/employee.model");
const getRandom = require('../middlewares/randomNumber');
const { sendEmail } = require("../middlewares/recruitment/sendMail");
const { launchFormTemplate } = require("../templatees/launchForm/launchFormTemplate");
const { approvalNotificationTemplate } = require("../templatees/approvalNotification/approvalNotificationTemplate");
const { CLIENTURL } = require("../config/environment");

// Bulk Email Configuration
const EMAIL_BATCH_SIZE = 10; // Number of emails per batch
const EMAIL_BATCH_DELAY = 1000; // Delay between batches (milliseconds)

/**
 * Sanitize numeric fields to prevent NaN casting errors
 * @param {any} value - The value to sanitize
 * @returns {number} - Sanitized numeric value (0 if invalid)
 */
const sanitizeNumericField = (value) => {
  if (value === null || value === undefined || value === '') {
    return 0;
  }
  if (typeof value === 'string') {
    if (value.toLowerCase() === 'nan' || value === 'NaN') {
      return 0;
    }
    const parsed = parseFloat(value);
    return isNaN(parsed) ? 0 : parsed;
  }
  if (typeof value === 'number') {
    return isNaN(value) ? 0 : value;
  }
  return 0;
};

/**
 * Sanitize review form data to prevent NaN casting errors
 * @param {Object} data - Review form data to sanitize
 * @returns {Object} - Sanitized review form data
 */
const sanitizeReviewFormData = (data) => {
  const sanitizedData = { ...data };
  
  // Sanitize numeric fields
  if ('overallRating' in sanitizedData) {
    sanitizedData.overallRating = sanitizeNumericField(sanitizedData.overallRating);
  }
  if ('managersRating' in sanitizedData) {
    sanitizedData.managersRating = sanitizeNumericField(sanitizedData.managersRating);
  }

  // Sanitize goals array if present
  if (sanitizedData.goals && Array.isArray(sanitizedData.goals)) {
    sanitizedData.goals = sanitizedData.goals.map(goal => ({
      ...goal,
      weight: goal.weight ? sanitizeNumericField(goal.weight) : goal.weight,
      progressStatus: goal.progressStatus ? sanitizeNumericField(goal.progressStatus) : goal.progressStatus,
      employeeRating: goal.employeeRating ? sanitizeNumericField(goal.employeeRating) : goal.employeeRating,
      managerRating: goal.managerRating ? sanitizeNumericField(goal.managerRating) : goal.managerRating
    }));
  }

  // Sanitize competencies array if present
  if (sanitizedData.competencies && Array.isArray(sanitizedData.competencies)) {
    sanitizedData.competencies = sanitizedData.competencies.map(comp => ({
      ...comp,
      Feedback: comp.Feedback ? sanitizeNumericField(comp.Feedback) : comp.Feedback
    }));
  }

  return sanitizedData;
};

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

/**
 * Send bulk email notifications to employees with their individual review form links
 * @param {Array} reviewForms - Array of created review forms
 * @param {Object} launchFormData - The launch form data containing employee info
 * @param {Function} template - Email template function
 * @param {number} batchSize - Number of emails to send per batch (default: 10)
 * @param {number} batchDelay - Delay between batches in milliseconds (default: 1000ms)
 */
const sendReviewFormNotifications = async (reviewForms, launchFormData, template, batchSize = EMAIL_BATCH_SIZE, batchDelay = EMAIL_BATCH_DELAY) => {
  try {
    const { formType, templateName, launchDate, reviewPeriodStartDate, reviewPeriodEndDate } = launchFormData;
     
    console.log('Review form notifications data:', {
      reviewFormsCount: reviewForms.length,
      companyId: launchFormData.companyId
    });
    
    // Create a mapping of employee ID to review form ID
    const employeeFormMap = {};
    reviewForms.forEach(form => {
      if (form.employeeName) {
        employeeFormMap[form.employeeName] = form._id;
      }
    });

    // Get all employee IDs from review forms
    const employeeIds = reviewForms.map(form => form.employeeName).filter(id => id);
    
    if (employeeIds.length === 0) {
      console.warn('No employees found in review forms');
      return {
        total: 0,
        successful: 0,
        failed: 0,
        results: []
      };
    }

    // Get employee details with email addresses
    const employeeDetails = await EmployeeModel.find({
      _id: { $in: employeeIds },
      companyId: launchFormData.companyId
    }).select('personalInformation.firstName personalInformation.lastName contactInformation.email');

    console.log('Found employee details:', {
      count: employeeDetails.length,
      employees: employeeDetails.map(emp => ({
        id: emp._id,
        name: `${emp.personalInformation.firstName} ${emp.personalInformation.lastName || ''}`.trim(),
        email: emp.contactInformation.email
      }))
    });

    if (employeeDetails.length === 0) {
      console.warn('No employees found for the given IDs and companyId');
      return {
        total: 0,
        successful: 0,
        failed: 0,
        results: []
      };
    }

    console.log(`📧 Starting bulk email sending for ${employeeDetails.length} employees in batches of ${batchSize}`);
    
    // Process emails in batches
    const allResults = [];
    const batches = [];
    
    // Split employees into batches
    for (let i = 0; i < employeeDetails.length; i += batchSize) {
      batches.push(employeeDetails.slice(i, i + batchSize));
    }
    
    console.log(`📦 Created ${batches.length} batches for processing`);
    
    // Process each batch
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      console.log(`🚀 Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} emails)`);
      
      const batchPromises = batch.map(async (employee) => {
        const employeeName = `${employee.personalInformation.firstName} ${employee.personalInformation.lastName || ''}`.trim();
        const email = employee.contactInformation.email;
        
        if (!email) {
          console.warn(`No email found for employee: ${employeeName} (${employee._id})`);
          return { success: false, employeeId: employee._id, error: 'No email address', employeeName };
        }

        // Get the specific form ID for this employee
        const formId = employeeFormMap[employee._id.toString()];
        if (!formId) {
          console.warn(`No review form found for employee: ${employeeName} (${employee._id})`);
          return { success: false, employeeId: employee._id, error: 'No review form found', employeeName };
        }

        // Create individual form link for this employee
        const formLink = `${CLIENTURL}/admin/reviews/${formId}`;

        const emailData = {
          employeeName,
          formType,
          templateName,
          launchDate,
          reviewPeriodStartDate,
          reviewPeriodEndDate,
          formLink
        };

        const subject = `New ${formType} Form Launched - ${templateName}`;
        
        console.log(`📨 Sending email to: ${email} for employee: ${employeeName} with form ID: ${formId}`);
        
        try {
          const result = await sendEmail(email, subject, emailData, true, template);
          return { ...result, employeeId: employee._id, employeeName, email, formId };
        } catch (error) {
          console.error(`❌ Error sending email to ${email}:`, error.message);
          return { success: false, employeeId: employee._id, employeeName, email, formId, error: error.message };
        }
      });

      // Wait for current batch to complete
      const batchResults = await Promise.allSettled(batchPromises);
      
      // Process batch results
      const batchSuccessful = batchResults.filter(result => result.status === 'fulfilled' && result.value.success).length;
      const batchFailed = batchResults.length - batchSuccessful;
      
      console.log(`✅ Batch ${batchIndex + 1} completed: ${batchSuccessful} successful, ${batchFailed} failed`);
      
      allResults.push(...batchResults);
      
      // Add delay between batches (except for the last batch)
      if (batchIndex < batches.length - 1) {
        console.log(`⏳ Waiting ${batchDelay}ms before next batch...`);
        await new Promise(resolve => setTimeout(resolve, batchDelay));
      }
    }
    
    // Calculate final results
    const successful = allResults.filter(result => result.status === 'fulfilled' && result.value.success).length;
    const failed = allResults.length - successful;
    
    console.log(`🎉 Bulk email sending completed: ${successful} successful, ${failed} failed out of ${allResults.length} total`);
    
    return {
      total: allResults.length,
      successful,
      failed,
      results: allResults,
      batches: batches.length,
      batchSize
    };
  } catch (error) {
    console.error('Error sending review form notifications:', error);
    throw error;
  }
};

const createReviewForm = async (req, res) => {
  // #swagger.tags = ['Review Form']
  try {
    let requestBody = sanitizeReviewFormData(req.body);
    requestBody.formId = "REVIEW_FORM_" + getRandom(7);
    
    const newChatbotReview = new ReviewFormModel(requestBody);
    await newChatbotReview.save();
    res.status(200).send(
      successResponse({
        message: "Review Form Saved Successfully!",
      })
    );
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Review Form Not Saved!",
      })
    );
  }
};
const createMultipleReviewForm = async (req, res) => {
  // #swagger.tags = ['Review Form']
  try {
    let requestBody = req.body;
    
    // Validate required fields
    if (!requestBody || !Array.isArray(requestBody) || requestBody.length === 0) {
      return res.status(400).send(
        failResponse({
          message: "Request body must be a non-empty array of review forms",
        })
      );
    }

    // Add form IDs and sanitize numeric fields for each review form
    requestBody = requestBody.map((item) => {
      const sanitizedItem = sanitizeReviewFormData(item);
      sanitizedItem.formId = "REVIEW_FORM_" + getRandom(7);
      return sanitizedItem;
    });

    // Insert multiple review forms and get the created documents with IDs
    const createdReviewForms = await ReviewFormModel.insertMany(requestBody);
    
    // Extract launch form data from the first review form (assuming all have same launch data)
    const firstForm = createdReviewForms[0];
    if (firstForm && firstForm.companyId) {
      const launchFormData = {
        companyId: firstForm.companyId,
        formType: firstForm.formType || 'Review',
        templateName: firstForm.templateName || 'Review Form',
        launchDate: firstForm.launchDate || new Date(),
        reviewPeriodStartDate: firstForm.startDate,
        reviewPeriodEndDate: firstForm.endDate
      };
console.log(launchFormData,'launchFsdfsdormData')
      // Start email sending prodscess in background without blocking response
      sendReviewFormNotifications(createdReviewForms, launchFormData, launchFormTemplate)
        .then(emailResults => {
          console.log(`✅ Background bulk email sending completed for Review Forms:`, {
            total: emailResults.total,
            successful: emailResults.successful,
            failed: emailResults.failed,
            batches: emailResults.batches,
            batchSize: emailResults.batchSize
          });
        })
        .catch(emailError => {
          console.error(`❌ Background bulk email sending failed for Review Forms:`, emailError.message);
        });
    } else {
      console.log('No email notifications sent - missing company ID or launch data');
    }

    res.status(200).send(
      successResponse({
        message: "Review Forms Saved Successfully! Email notifications are being sent in background.",
        data: {
          reviewForms: createdReviewForms,
          emailStatus: "Emails are being processed in background"
        }
      })
    );
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Review Forms Not Saved!",
      })
    );
  }
};
const getAllReviewsForm = async (req, res) => {
  // #swagger.tags = ['Review Form']
  try {
    let userId = req.params.userId;
    let role = req.params.role === "Manager" ? { managerId: userId } : (req.params.role === "HR Admin" || req.params.role === "Super Admin" ? {} : { employeeName: userId });
    let queryObj = {
      companyId: req.params.companyId, $or: [
        { employeeName: userId },
        role
      ]
    };
    const Reviews = await ReviewFormModel.find(queryObj).sort({ _id: -1 });
    const TemplateIds = Reviews.map(item => item.templateId);
    const LaunchForms = await LaunchFormModel.find({ formTemplate: { $in: TemplateIds } }).sort({ _id: -1 });
    let templateIds = Reviews.map(item => item.templateId);
    const TemplatesInfo = await TemplateModel.find({ _id: { $in: templateIds } }).sort({ _id: -1 });
    
    let result = Reviews.map((Review, index) => {
      let TemplateInfo = TemplatesInfo.filter(item => item._id.toString() === Review.templateId.toString())[0];
      
      let totalWeightsPercent = Review._doc.goals.reduce((prev, current) => {
        return prev + Number(current.weight) * Number(current.progressStatus);
      }, 0)
      totalWeightsPercent = Number(totalWeightsPercent / 100).toFixed(2);

      let totalEmployeeRating = Review._doc.goals.reduce((prev, current) => {
        return prev + (Number(current.employeeRating) * Number(current.weight)) / 100;
      }, 0);
      totalEmployeeRating = Number(totalEmployeeRating).toFixed(2);

      let totalManagerRating = Review._doc.goals.reduce((prev, current) => {
        return prev + (Number(current.managerRating) * Number(current.weight)) / 100;
      }, 0);
      totalManagerRating = Number(totalManagerRating).toFixed(2)

      const empCompetencies = Review._doc.competencies.filter(item => item.type === "employee");
      let totalCompetenciesRatingEmp = empCompetencies.reduce((prev, current) => {
        return prev + Number(current.Feedback);
      }, 0);
      totalCompetenciesRatingEmp = empCompetencies.length > 0 ? Number(totalCompetenciesRatingEmp / empCompetencies.length).toFixed(2) : "0.00";

      const managerCompetencies = Review._doc.competencies.filter(item => item.type === "manager");
      let totalCompetenciesRatingManager = managerCompetencies.reduce((prev, current) => {
        return prev + Number(current.Feedback);
      }, 0);
      totalCompetenciesRatingManager = managerCompetencies.length > 0 ? Number(totalCompetenciesRatingManager / managerCompetencies.length).toFixed(2) : "0.00";
      
      const hasGoals = Review._doc.goals && Review._doc.goals.length > 0;
      const hasManagerCompetencies = managerCompetencies.length > 0;
      
      let goalPercentage = (TemplateInfo && TemplateInfo.goalPercentage) ? Number(TemplateInfo.goalPercentage) : 0;
      let competenciesPercentage = (TemplateInfo && TemplateInfo.competenciesPercentage) ? Number(TemplateInfo.competenciesPercentage) : 0;

      if (hasGoals && !hasManagerCompetencies) {
        goalPercentage = 100;
        competenciesPercentage = 0;
      } else if (!hasGoals && hasManagerCompetencies) {
        goalPercentage = 0;
        competenciesPercentage = 100;
      }

      const averageRatingGoals = (Number(totalManagerRating) * goalPercentage) / 100;
      const totalCompetenciesRating = (Number(totalCompetenciesRatingManager) * competenciesPercentage) / 100;
      
      let averageRating = "0.00";
      if (hasGoals || hasManagerCompetencies) {
        averageRating = (averageRatingGoals + totalCompetenciesRating).toFixed(2);
      }

      let filteredLaunchForm = LaunchForms.filter(item => item.formTemplate.toString() === Review._doc.templateId.toString());
      const reviewPeriodStartDate = filteredLaunchForm.length > 0 ? filteredLaunchForm[0].reviewPeriodStartDate : "No Date";
      const reviewPeriodEndDate = filteredLaunchForm.length > 0 ? filteredLaunchForm[0].reviewPeriodEndDate : "No Date";
      
      return {
        ...Review._doc,
        templateName: TemplateInfo ? TemplateInfo.templateName : "Template Not Found",
        employeesRating: totalEmployeeRating,
        managersRating: Review._doc.managersRating ? Review._doc.managersRating : totalManagerRating,
        overallRating: Review._doc.managersRating ? Review._doc.managersRating : (Review._doc.overallRating ? Review._doc.overallRating : averageRating),
        averageRating,
        reviewPeriodStartDate,
        reviewPeriodEndDate
      }
    })

    res.status(200).send(
      successResponse({
        message: "Reviews Retrieved Successfully!",
        data: result,
      })
    );
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "reviews Not Fetched!",
      })
    );
  }
};
const getAllReviewsByUserId = async (req, res) => {
  // #swagger.tags = ['Review Form']
  try {
    const Reviews = await ReviewFormModel.find({ employeeName: req.params.id }).sort({ _id: -1 });
    res.status(200).send(
      successResponse({
        message: "Reviews Retrieved Successfully!",
        data: Reviews,
      })
    );
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Reviews Not Fetched!",
      })
    );
  }
};
const getAllReviewsById = async (req, res) => {
  try {
    const Reviews = await ReviewFormModel.findOne({ _id: req.params.id }).sort({ _id: -1 });
    const TemplateInfo = await TemplateModel.findOne({ _id: Reviews._doc.templateId }).sort({ _id: -1 });
    const ratings = await LookupModel.find({ 
      lookType: TemplateInfo?.ratingScale || "Performance Rating Scale",
      companyId: Reviews._doc.companyId 
    }).sort({ _id: -1 });
    let totalWeightsPercent = Reviews._doc.goals.reduce((prev, current) => {
      return prev + Number(current.weight) * Number(current.progressStatus);
    }, 0)
    totalWeightsPercent = Number(totalWeightsPercent / 100).toFixed(2);

    // Calculate total weights for proper weighted average
    let totalWeights = Reviews._doc.goals.reduce((prev, current) => {
      return prev + Number(current.weight);
    }, 0);

    // Calculate weighted sum for employee ratings
    let totalWeightedEmployeeRating = Reviews._doc.goals.reduce((prev, current) => {
      return prev + (Number(current.employeeRating) * Number(current.weight));
    }, 0);

    // Calculate weighted sum for manager ratings
    let totalWeightedManagerRating = Reviews._doc.goals.reduce((prev, current) => {
      return prev + (Number(current?.managerRating) * Number(current?.weight));
    }, 0);

    // Calculate proper weighted averages
    let totalEmployeeRating = totalWeights > 0 ? totalWeightedEmployeeRating / totalWeights : 0;
    let totalManagerRating = totalWeights > 0 ? totalWeightedManagerRating / totalWeights : 0;
    totalEmployeeRating = Number(totalEmployeeRating).toFixed(2);
    totalManagerRating = Number(totalManagerRating).toFixed(2);

    const empCompetencies = Reviews._doc.competencies.filter(item => item.type === "employee");
    let totalCompetenciesRatingEmp = empCompetencies.reduce((prev, current) => {
      return prev + Number(current.Feedback)
    }, 0)
    totalCompetenciesRatingEmp = empCompetencies.length > 0 ? Number(totalCompetenciesRatingEmp / empCompetencies.length).toFixed(2) : "0.00";

    const managerCompetencies = Reviews._doc.competencies.filter(item => item.type === "manager");
    let totalCompetenciesRatingManager = managerCompetencies.reduce((prev, current) => {
      return prev + Number(current.Feedback)
    }, 0)
    totalCompetenciesRatingManager = managerCompetencies.length > 0 ? Number(totalCompetenciesRatingManager / managerCompetencies.length).toFixed(2) : "0.00";
    
    const hasGoals = Reviews._doc.goals && Reviews._doc.goals.length > 0;
    const hasManagerCompetencies = managerCompetencies.length > 0;
    
    let goalPercentage = (TemplateInfo && TemplateInfo.goalPercentage) ? Number(TemplateInfo.goalPercentage) : 0;
    let competenciesPercentage = (TemplateInfo && TemplateInfo.competenciesPercentage) ? Number(TemplateInfo.competenciesPercentage) : 0;

    if (hasGoals && !hasManagerCompetencies) {
      goalPercentage = 100;
      competenciesPercentage = 0;
    } else if (!hasGoals && hasManagerCompetencies) {
      goalPercentage = 0;
      competenciesPercentage = 100;
    }

    const averageRatingGoals = (Number(totalManagerRating) * goalPercentage) / 100;
    const totalCompetenciesRating = (Number(totalCompetenciesRatingManager) * competenciesPercentage) / 100;
    
    let averageRating = "0.00";
    if (hasGoals || hasManagerCompetencies) {
      averageRating = (averageRatingGoals + totalCompetenciesRating).toFixed(2);
    }
    
    // Format ratings data with date filtering
    const currentDate = new Date();
    const ratingsData = ratings.map(rating => {
      // Filter rating scale items based on current date
      const filteredRatingScale = (rating.ratingScale || []).filter(item => {
        const itemStartDate = item.dateStart ? new Date(item.dateStart) : null;
        const itemEndDate = item.dateEnd ? new Date(item.dateEnd) : null;
        
        // Check if item is enabled and within date range
        if (!item.enabled) return false;
        
        // If no dates are set, include the item
        if (!itemStartDate && !itemEndDate) return true;
        
        // If only start date is set, check if current date is after start date
        if (itemStartDate && !itemEndDate) {
          return currentDate >= itemStartDate;
        }
        
        // If only end date is set, check if current date is before end date
        if (!itemStartDate && itemEndDate) {
          return currentDate <= itemEndDate;
        }
        
        // If both dates are set, check if current date is within range
        if (itemStartDate && itemEndDate) {
          return currentDate >= itemStartDate && currentDate <= itemEndDate;
        }
        
        return true;
      });
      
      return {
        name: rating.meaning,
        value: filteredRatingScale
      };
    });
    
    let result = {
      ...Reviews._doc,
      overallRating: Reviews._doc.managersRating ? Reviews._doc.managersRating : averageRating,
      totalAchievement: totalWeightsPercent,
      ratings: ratingsData
    }
    res.status(200).send(
      successResponse({
        message: "Reviews Retrieved Successfully!",
        data: result,
      })
    );
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Reviews Not Fetched!",
      })
    );
  }
};
const getAllReviewsByTemplateId = async (req, res) => {
  // #swagger.tags = ['Review Form']
  try {
    const Reviews = await ReviewFormModel.findOne({ _id: req.params.id }).sort({ _id: -1 });
    const TemplateInfo = await TemplateModel.findOne({ _id: req.params.id }).sort({ _id: -1 });
    let totalWeightsPercent = Reviews._doc.goals.reduce((prev, current) => {
      return prev + Number(current.weight) * Number(current.progressStatus);
    }, 0)
    totalWeightsPercent = Number(totalWeightsPercent / 100).toFixed(2);

    let totalEmployeeRating = Reviews._doc.goals.reduce((prev, current) => {
      return prev + Number(current.employeeRating)
    }, 0);
    totalEmployeeRating = Number(totalEmployeeRating / Reviews._doc.goals.length).toFixed(2);
    let totalManagerRating = Reviews._doc.goals.reduce((prev, current) => {
      return prev + Number(current.managerRating)
    }, 0)
    totalManagerRating = Number(totalManagerRating / Reviews._doc.goals.length).toFixed(2);
    let totalCompetenciesRatingEmp = Reviews._doc.competencies.filter(item => item.type === "employee").reduce((prev, current) => {
      return prev + Number(current.Feedback)
    }, 0)
    totalCompetenciesRatingEmp = Number(totalCompetenciesRatingEmp / (Reviews._doc.competencies.filter(item => item.type === "employee").length)).toFixed(2);

    let totalCompetenciesRatingManager = Reviews._doc.competencies.filter(item => item.type === "manager").reduce((prev, current) => {
      return prev + Number(current.Feedback)
    }, 0)
    totalCompetenciesRatingManager = Number(totalCompetenciesRatingManager / (Reviews._doc.competencies.filter(item => item.type === "manager").length)).toFixed(2);
    //let totalCompetenciesRating = Number((Number(totalCompetenciesRatingEmp) + Number(totalCompetenciesRatingManager)) / 2).toFixed(2);
    let totalCompetenciesRating = (Number(totalCompetenciesRatingManager)).toFixed(2);
    totalCompetenciesRating = Number(Number(totalCompetenciesRating) * (Number(TemplateInfo ? TemplateInfo.competenciesPercentage : 0) / 100)).toFixed(2);
    let totalGoals = Reviews._doc.goals.length;
    //let averageRatingGoals = totalEmployeeRating > 0 && totalManagerRating > 0 ? Number((Number(totalEmployeeRating) + Number(totalManagerRating)) / totalGoals).toFixed(2) : 0;
    let averageRatingGoals = totalManagerRating > 0 ? (Number(totalManagerRating) / totalGoals).toFixed(2) : 0;
    averageRatingGoals = Number((Number(averageRatingGoals)) * (Number(TemplateInfo ? TemplateInfo.goalPercentage : 0) / 100)).toFixed(2);
    let averageRating = Number(Number(averageRatingGoals) + Number(totalCompetenciesRating)).toFixed(2);
    let result = {
      ...Reviews._doc,
      overallRating: Reviews._doc.managersRating ? Reviews._doc.managersRating : averageRating,
      totalAchievement: totalWeightsPercent
    }
    res.status(200).send(
      successResponse({
        message: "Reviews Retrieved Successfully!",
        data: result,
      })
    );
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Reviews Not Fetched!",
      })
    );
  }
};
const deleteReview = (req, res) => {
  // #swagger.tags = ['Review Form']
  ReviewFormModel.findByIdAndRemove({ _id: req.params.id }, (err) => {
    if (!err) {
      res.status(200).send(
        successResponse({
          message: "Review Deleted Successfully!",
        })
      );
    } else {
      res.status(500).send(
        failResponse({
          message: err ? err.message : "Review Not Deleted!",
        })
      );
    }
  });
};

/**
 * Get HR employees by company ID
 * @param {string} companyId - The company ID
 * @returns {Promise<Array>} Array of HR employees
 */
const getHREmployees = async (companyId) => {
  try {
    const hrEmployees = await EmployeeModel.find({
      companyId: companyId,
      $or: [
        { 'employmentInformation.role': { $regex: /hr/i } },
        { 'employmentInformation.role': { $regex: /human resource/i } },
        { 'employmentInformation.designation': { $regex: /hr/i } },
        { 'employmentInformation.designation': { $regex: /human resource/i } }
      ]
    }).select('personalInformation.firstName personalInformation.lastName contactInformation.email _id');

    console.log(`Found ${hrEmployees.length} HR employees for company ${companyId}`);
    return hrEmployees;
  } catch (error) {
    console.error('Error fetching HR employees:', error);
    return [];
  }
};

/**
 * Send approval notification email
 * @param {Object} reviewForm - The review form object
 * @param {string} recipientEmail - Email of the recipient
 * @param {string} recipientName - Name of the recipient
 * @param {string} notificationType - Type of notification (manager, hr, employee)
 * @param {string} companyName - Company name (optional)
 */
const sendApprovalNotification = async (reviewForm, recipientEmail, recipientName, notificationType, companyName = 'Vihanga') => {
  try {
    if (!recipientEmail) {
      console.warn(`No email found for recipient: ${recipientName}`);
      return { success: false, error: 'No email address' };
    }

    const formLink = `${CLIENTURL}/admin/reviews/${reviewForm._id}`;
    const currentDate = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const emailData = {
      recipientName,
      employeeName: reviewForm.employeeFullName,
      employeeId: reviewForm.employeeId,
      templateName: reviewForm.templateName,
      formId: reviewForm.formId,
      status: reviewForm.status,
      formLink,
      reviewPeriod: reviewForm.reviewPeriod,
      currentDate,
      notificationType,
      companyName
    };

    let subject;
    switch (reviewForm.status) {
      case 'Manager Review':
        subject = `Action Required: Review Form Ready for Manager Review - ${reviewForm.employeeFullName}`;
        break;
      case 'HR Review':
        subject = `Action Required: Review Form Ready for HR Review - ${reviewForm.employeeFullName}`;
        break;
      case 'Manager SignOff':
        subject = `Action Required: Manager Sign-Off Needed - ${reviewForm.employeeFullName}`;
        break;
      case 'Employee SignOff':
        subject = `Action Required: Your Performance Review Sign-Off`;
        break;
      case 'Completed':
        subject = notificationType === 'employee' ? 
          `Performance Review Completed - ${reviewForm.reviewPeriod}` :
          `Performance Review Completed - ${reviewForm.employeeFullName}`;
        break;
      default:
        subject = `Review Form Update - ${reviewForm.employeeFullName}`;
    }

    console.log(`📨 Sending approval notification to: ${recipientEmail} for status: ${reviewForm.status}`);
    
    const result = await sendEmail(recipientEmail, subject, emailData, true, approvalNotificationTemplate);
    return { ...result, recipientEmail, recipientName };
  } catch (error) {
    console.error(`❌ Error sending approval notification to ${recipientEmail}:`, error.message);
    return { success: false, error: error.message, recipientEmail, recipientName };
  }
};

/**
 * Handle approval notifications based on status change
 * @param {Object} reviewForm - The updated review form
 * @param {string} previousStatus - The previous status
 */
const handleApprovalNotifications = async (reviewForm, previousStatus) => {
  try {
    const { status, managerId, employeeName, companyId } = reviewForm;
    
    // Don't send notifications if status hasn't changed or is the initial status
    if (status === previousStatus || status === 'Submit') {
      return { success: true, message: 'No notifications needed' };
    }

    console.log(`Handling approval notifications for status change: ${previousStatus} → ${status}`);
    const results = [];

    switch (status) {
      case 'Manager Review':
        // Send notification to manager
        if (managerId) {
          const manager = await EmployeeModel.findById(managerId)
            .select('personalInformation.firstName personalInformation.lastName contactInformation.email');
          
          if (manager) {
            const managerName = `${manager.personalInformation.firstName} ${manager.personalInformation.lastName || ''}`.trim();
            const result = await sendApprovalNotification(reviewForm, manager.contactInformation.email, managerName, 'manager');
            results.push(result);
          }
        }
        break;

      case 'HR Review':
        // Send notification to HR employees
        const hrEmployees = await getHREmployees(companyId);
        for (const hrEmployee of hrEmployees) {
          const hrName = `${hrEmployee.personalInformation.firstName} ${hrEmployee.personalInformation.lastName || ''}`.trim();
          const result = await sendApprovalNotification(reviewForm, hrEmployee.contactInformation.email, hrName, 'hr');
          results.push(result);
        }
        break;

      case 'Manager SignOff':
        // Send notification to manager
        if (managerId) {
          const manager = await EmployeeModel.findById(managerId)
            .select('personalInformation.firstName personalInformation.lastName contactInformation.email');
          
          if (manager) {
            const managerName = `${manager.personalInformation.firstName} ${manager.personalInformation.lastName || ''}`.trim();
            const result = await sendApprovalNotification(reviewForm, manager.contactInformation.email, managerName, 'manager');
            results.push(result);
          }
        }
        break;

      case 'Employee SignOff':
        // Send notification to employee
        const employee = await EmployeeModel.findById(employeeName)
          .select('personalInformation.firstName personalInformation.lastName contactInformation.email');
        
        if (employee) {
          const employeeName = `${employee.personalInformation.firstName} ${employee.personalInformation.lastName || ''}`.trim();
          const result = await sendApprovalNotification(reviewForm, employee.contactInformation.email, employeeName, 'employee');
          results.push(result);
        }
        break;

      case 'Completed':
        // Send notifications to both employee and HR
        
        // Send to employee
        const employeeForCompletion = await EmployeeModel.findById(employeeName)
          .select('personalInformation.firstName personalInformation.lastName contactInformation.email');
        
        if (employeeForCompletion) {
          const empName = `${employeeForCompletion.personalInformation.firstName} ${employeeForCompletion.personalInformation.lastName || ''}`.trim();
          const empResult = await sendApprovalNotification(reviewForm, employeeForCompletion.contactInformation.email, empName, 'employee');
          results.push(empResult);
        }

        // Send to HR employees
        const hrEmployeesForCompletion = await getHREmployees(companyId);
        for (const hrEmployee of hrEmployeesForCompletion) {
          const hrName = `${hrEmployee.personalInformation.firstName} ${hrEmployee.personalInformation.lastName || ''}`.trim();
          const hrResult = await sendApprovalNotification(reviewForm, hrEmployee.contactInformation.email, hrName, 'hr');
          results.push(hrResult);
        }
        break;
    }

    const successful = results.filter(result => result.success).length;
    const failed = results.length - successful;

    console.log(`📧 Approval notifications sent: ${successful} successful, ${failed} failed`);
    
    return {
      success: true,
      results,
      summary: { total: results.length, successful, failed }
    };
  } catch (error) {
    console.error('Error handling approval notifications:', error);
    return { success: false, error: error.message };
  }
};

const updateReview = async (req, res) => {
  // #swagger.tags = ['Review Form']
  try {
    const reviewId = req.params.id;
    let updateData = { ...req.body }; // Create a copy to avoid mutating original
    
    // First, get the current review to capture the previous status
    const currentReview = await ReviewFormModel.findById(reviewId);
    if (!currentReview) {
      return res.status(404).send(
        failResponse({
          message: "Review not found!",
        })
      );
    }

    const previousStatus = currentReview.status;

    // Sanitize numeric fields to prevent NaN casting errors
    updateData = sanitizeReviewFormData(updateData);

    // Update the review
    const updatedReview = await ReviewFormModel.findByIdAndUpdate(
      reviewId, 
      updateData,
      { new: true, runValidators: true }
    );

    if (!updatedReview) {
      return res.status(404).send(
        failResponse({
          message: "Failed to update review!",
        })
      );
    }

    // Handle approval notifications if status has changed
    if (updateData.status && updateData.status !== previousStatus) {
      // Send notifications in background without blocking the response
      handleApprovalNotifications(updatedReview, previousStatus)
        .then(notificationResults => {
          console.log(`✅ Background approval notifications completed for Review ${reviewId}:`, {
            statusChange: `${previousStatus} → ${updateData.status}`,
            summary: notificationResults.summary
          });
        })
        .catch(notificationError => {
          console.error(`❌ Background approval notifications failed for Review ${reviewId}:`, {
            statusChange: `${previousStatus} → ${updateData.status}`,
            error: notificationError.message
          });
        });
    }

    res.status(200).send(
      successResponse({
        message: "Review Updated Successfully!",
        data: {
          review: updatedReview,
          statusChange: updateData.status && updateData.status !== previousStatus ? {
            from: previousStatus,
            to: updateData.status,
            notificationStatus: "Notifications are being processed in background"
          } : null
        }
      })
    );
  } catch (err) {
    console.error('Error updating review:', err);
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Review Not Updated!",
      })
    );
  }
};

const getChartData = async (req, res) => {
  // #swagger.tags = ['Review Form']
  try {
    const enums = ["Submit", "Manager Review", "HR Review", "Manager SignOff", "Employee SignOff", "Completed"]
    const isAdmin = req.params.role === "HR Admin" || req.params.role === "Super Admin";
    const objj = isAdmin ? { companyId: req.params.id } : { managerId: req.params.id }
    const reviews = await ReviewFormModel.aggregate([
      {
        $match: objj,
      },
      {
        $project: {
          status: 1,
        }
      },
      {
        "$group": {
          "_id": "$status",
          "count": { $sum: 1 }
        }
      }
    ]);
    const reviewsData = await ReviewFormModel.find(objj).sort({ _id: -1 })
    const finalData = enums.map((item) => {
      const filterData = reviews.filter((itemChild) => item === itemChild._id)
      if (filterData.length > 0) {
        return filterData[0]
      } else {
        return {
          _id: item,
          count: 0
        }
      }
    })
    if (reviews) {
      res.status(200).send(
        successResponse({
          message: "Review get Successfully!",
          data: { finalData: finalData, reviewsData: reviewsData }
        })
      )
    }
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Review Not Updated!",


      }))
  }
}
const UpdateMultipleReviews = async (req, res) => {
  // #swagger.tags = ['Review Form']
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
                  status: item.status,
                },
              },
              upsert: true
            }
          }
        );
      }
    })
    await ReviewFormModel.bulkWrite(ops, { ordered: false });
    res.status(200).send(
      successResponse({
        message: 'Reviews Updated Successfully!',
      })
    );
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Reviews Not Updated!"
      })
    );
  }
};


module.exports = {
  deleteReview,
  updateReview,
  getAllReviewsByUserId,
  createReviewForm,
  getAllReviewsForm,
  getAllReviewsById,
  getChartData,
  getAllReviewsByTemplateId,
  createMultipleReviewForm,
  UpdateMultipleReviews
};
