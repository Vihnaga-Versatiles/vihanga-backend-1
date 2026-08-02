const statusUpdateTemplate = ({
  name,
  testLink,
  email,
  id,
  isFeedback = false,
  documentUpload = false,
  Onboarding = false,
  documentUploadTemplateHR = false,
  // New: task assignment email
  taskAssigned = false,
  taskDetails = {}, // { taskTitle, dueDate, priority, company, createdBy, viewUrl, description }
  leaveApproval = false,
  leaveRejected = false,
  leaveApproved = false,
  leaveDetails = {},
  timeEntryApproval = false,
  timeEntryApproved = false,
  timeEntryRejected = false,
  timeEntryDetails = {},
  // Resignation workflow emails
  resignationApproval = false,
  resignationApproved = false,
  resignationRejected = false,
  resignationDetails = {},
    // New: credentials email variant
  credentialsEmail = false,
  credentialsDetails = {}, // { legalEntityName, loginEmail, password, loginUrl, customMessage }
 
}) => {

  
  console.log("testLink at template", testLink);

  const currentYear = new Date().getFullYear();
  const heading = credentialsEmail
    ? `Dear ${name},`
    
    : documentUploadTemplateHR 
    ? "Hello Dear HR " 
    : taskAssigned
    ? `Dear ${name},`
    : (leaveApproval || leaveRejected || leaveApproved)
    ? `Dear ${name},` 
    : (timeEntryApproval || timeEntryApproved || timeEntryRejected)
    ? `Dear ${name},`
    : (resignationApproval || resignationApproved || resignationRejected)
    ? `Dear ${name},`
    : `Hi  ${name},`;
    
  let mainContent = "";

  if (credentialsEmail) {
    const {
      legalEntityName,
      loginEmail,
      password,
      loginUrl,
      
    } = credentialsDetails || {};

    mainContent = `
      <p>Please find your login credentials for Vihanga below.</p>
      <div class="leave-details-card">
        <h3 style="color: #0073e6; margin-bottom: 15px; font-size: 18px;"> Login Details</h3>
        <div style="padding: 10px 0;">
          <p style="margin: 8px 0; font-size: 15px; color: #333;">
            <strong>Email:</strong> ${loginEmail || email}
          </p>
          ${password ? `
          <p style="margin: 8px 0; font-size: 15px; color: #333;">
            <strong>Password:</strong> ${password}
          </p>` : ''}
        </div>
      </div>

      ${loginUrl ? `
      <div class="button-container">
        <a 
          class="button" 
          href="${loginUrl}" 
          target="_blank"
          style="color: white; font-weight: 600; display: inline-block;"
        >
          Go to Login
        </a>
      </div>` : ''}

      <div style="margin-top: 30px; padding: 20px; background-color: #f8f9fa; border-radius: 8px; border-left: 4px solid #0073e6;">
        <p style="margin: 0 0 15px 0; font-size: 15px; color: #333;">
          If you spot any issues or something isn't working right, let us know by filling out this form:
        </p>
        <div style="margin: 15px 0;">
          <a href="https://forms.gle/N4nRPtmyixjLEfEj7" 
             style="color: #0073e6; text-decoration: none; font-weight: 500; display: inline-block; padding: 8px 0;"
             target="_blank">
            https://forms.gle/N4nRPtmyixjLEfEj7
          </a>
        </div>
        <p style="margin: 15px 0 0 0; font-size: 14px; color: #666;">
          Your inputs will help us make it an even better application for everyone.
        </p>
      </div>

      
    `;
  } else if (taskAssigned) {
    const {
      taskTitle,
      dueDate,
      priority,
      company,
      createdBy,
      viewUrl,
      description
    } = taskDetails || {};

    mainContent = `
      <p>You have been assigned a new task in Vihanga.</p>

      <div class="leave-details-card">
        <h3 style="color: #0073e6; margin-bottom: 15px; font-size: 18px;">Task Assignment</h3>

        <div class="detail-row">
          <span class="detail-label">Task:</span>
          <span class="detail-value">${taskTitle || 'Task'}</span>
        </div>

        ${description ? `
        <div class="detail-row">
          <span class="detail-label">Description:</span>
          <span class="detail-value">${description}</span>
        </div>` : ''}

        ${dueDate ? `
        <div class="detail-row">
          <span class="detail-label">Due Date:</span>
          <span class="detail-value">${dueDate}</span>
        </div>` : ''}

        ${priority ? `
        <div class="detail-row">
          <span class="detail-label">Priority:</span>
          <span class="detail-value">${priority}</span>
        </div>` : ''}

        ${company ? `
        <div class="detail-row">
          <span class="detail-label">Company:</span>
          <span class="detail-value">${company}</span>
        </div>` : ''}

        ${createdBy ? `
        <div class="detail-row">
          <span class="detail-label">Assigned By:</span>
          <span class="detail-value">${createdBy}</span>
        </div>` : ''}
      </div>

      ${description ? `
      <div class="cta-box">
        ${description}
      </div>` : ''}

      ${viewUrl ? `
      <div class="button-container">
        <a 
          class="button" 
          href="${viewUrl}" 
          target="_blank"
          style="color: white; font-weight: 600; display: inline-block;"
        >
          Click here
        </a>
      </div>` : `
      <p style="margin-top: 10px;">
        Please log in to Vihanga to review the task details and take action.
      </p>
      `}
    `;
  } else if (leaveApproval) {
    const {
      employeeName,
      employeeEmail,
      leaveType,
      fromDate,
      toDate,
      duration,
      reason,
      approvalLink
    } = leaveDetails;

    mainContent = `
      <p>You have received a new leave request that requires your approval.</p>
      
      <div class="leave-details-card">
        <h3 style="color: #0073e6; margin-bottom: 15px; font-size: 18px;">Leave Request Details</h3>
        
        <div class="detail-row">
          <span class="detail-label">Employee Name:</span>
          <span class="detail-value">${employeeName}</span>
        </div>
        
        <div class="detail-row">
          <span class="detail-label">Employee Email:</span>
          <span class="detail-value">${employeeEmail}</span>
        </div>
        
        <div class="detail-row">
          <span class="detail-label">Leave Type:</span>
          <span class="detail-value">${leaveType}</span>
        </div>
        
        <div class="detail-row">
          <span class="detail-label">From Date:</span>
          <span class="detail-value">${fromDate}</span>
        </div>
        
        <div class="detail-row">
          <span class="detail-label">To Date:</span>
          <span class="detail-value">${toDate}</span>
        </div>
        
        <div class="detail-row">
          <span class="detail-label">Duration:</span>
          <span class="detail-value">${duration} ${duration === '0.5' ? 'day (Half Day)' : duration === '1' ? 'day' : 'days'}</span>
        </div>
        
        ${reason ? `
        <div class="detail-row">
          <span class="detail-label">Reason:</span>
          <span class="detail-value">${reason}</span>
        </div>
        ` : ''}
      </div>

      <div class="cta-box">
        Please review the leave request and take appropriate action. Click the button below to approve or reject this request.
      </div>

      <div class="button-container">
        <a 
          class="button approve-button" 
          href="${approvalLink}" 
          target="_blank"
          style="color: white; font-weight: 600; display: inline-block; margin-right: 10px;"
        >
          Review & Approve
        </a>
      </div>

      <p style="margin-top: 25px; font-size: 14px; color: #666;">
        <strong>Note:</strong> This request requires your immediate attention. Please log in to the system to review the complete details and make your decision.
      </p>
    `;
  } else if (leaveRejected) {
    const {
      leaveType,
      fromDate,
      toDate,
      rejectedBy,
      rejectionReason
    } = leaveDetails;

    mainContent = `
      <p>We regret to inform you that your leave request has been rejected.</p>
      
      <div class="leave-details-card">
        <h3 style="color: #dc3545; margin-bottom: 15px; font-size: 18px;">Rejected Leave Request Details</h3>
        
        <div class="detail-row">
          <span class="detail-label">Leave Type:</span>
          <span class="detail-value">${leaveType}</span>
        </div>
        
        <div class="detail-row">
          <span class="detail-label">From Date:</span>
          <span class="detail-value">${fromDate}</span>
        </div>
        
        <div class="detail-row">
          <span class="detail-label">To Date:</span>
          <span class="detail-value">${toDate}</span>
        </div>
        
        <div class="detail-row">
          <span class="detail-label">Rejected By:</span>
          <span class="detail-value">${rejectedBy}</span>
        </div>
        
        <div class="detail-row">
          <span class="detail-label">Rejection Reason:</span>
          <span class="detail-value">${rejectionReason}</span>
        </div>
      </div>

      <div class="cta-box" style="background-color: #f8d7da; border-color: #f5c6cb; color: #721c24;">
        Please review the rejection reason and consider submitting a new leave request with the necessary corrections if needed.
      </div>

      <p style="margin-top: 20px; font-size: 14px; color: #666;">
        If you have any questions about this rejection, please contact your manager or HR department for clarification.
      </p>
    `;
  } else if (leaveApproved) {
    const {
      leaveType,
      fromDate,
      toDate,
      finalApprovedBy
    } = leaveDetails;

    mainContent = `
      <p>Great news! Your leave request has been approved.</p>
      
      <div class="leave-details-card">
        <h3 style="color: #28a745; margin-bottom: 15px; font-size: 18px;">Approved Leave Request Details</h3>
        
        <div class="detail-row">
          <span class="detail-label">Leave Type:</span>
          <span class="detail-value">${leaveType}</span>
        </div>
        
        <div class="detail-row">
          <span class="detail-label">From Date:</span>
          <span class="detail-value">${fromDate}</span>
        </div>
        
        <div class="detail-row">
          <span class="detail-label">To Date:</span>
          <span class="detail-value">${toDate}</span>
        </div>
        
        <div class="detail-row">
          <span class="detail-label">Approved By:</span>
          <span class="detail-value">${finalApprovedBy}</span>
        </div>
      </div>

      <div class="cta-box" style="background-color: #d4edda; border-color: #c3e6cb; color: #155724;">
        Your leave request has been successfully approved and is now part of your leave records.
      </div>

      <p style="margin-top: 20px; font-size: 14px; color: #666;">
        Thank you for submitting your leave request. If you have any questions, please contact your manager or HR department.
      </p>
    `;
  } else if (timeEntryApproval) {
    const {
      employeeName,
      employeeEmail,
      date,
      timeIn,
      timeOut,
      hours,
      method,
      reason,
      approvalLink
    } = timeEntryDetails;

    mainContent = `
      <p>You have received a new time entry that requires your approval.</p>
      
      <div class="leave-details-card">
        <h3 style="color: #0073e6; margin-bottom: 15px; font-size: 18px;">Time Entry Details</h3>
        
        <div class="detail-row">
          <span class="detail-label">Employee Name:</span>
          <span class="detail-value">${employeeName}</span>
        </div>
        
        <div class="detail-row">
          <span class="detail-label">Employee Email:</span>
          <span class="detail-value">${employeeEmail}</span>
        </div>
        
        <div class="detail-row">
          <span class="detail-label">Date:</span>
          <span class="detail-value">${date}</span>
        </div>
        
        <div class="detail-row">
          <span class="detail-label">Time In:</span>
          <span class="detail-value">${timeIn}</span>
        </div>
        
        <div class="detail-row">
          <span class="detail-label">Time Out:</span>
          <span class="detail-value">${timeOut}</span>
        </div>
        
        <div class="detail-row">
          <span class="detail-label">Hours:</span>
          <span class="detail-value">${hours}</span>
        </div>
        
        <div class="detail-row">
          <span class="detail-label">Method:</span>
          <span class="detail-value">${method}</span>
        </div>
        
        ${reason ? `
        <div class="detail-row">
          <span class="detail-label">Reason:</span>
          <span class="detail-value">${reason}</span>
        </div>
        ` : ''}
      </div>

      <div class="cta-box">
        Please review the time entry and take appropriate action. Click the button below to approve or reject this request.
      </div>

      <div class="button-container">
        <a 
          class="button approve-button" 
          href="${approvalLink}" 
          target="_blank"
          style="color: white; font-weight: 600; display: inline-block; margin-right: 10px;"
        >
          Review & Approve
        </a>
      </div>

      <p style="margin-top: 25px; font-size: 14px; color: #666;">
        <strong>Note:</strong> This time entry requires your immediate attention. Please log in to the system to review and make your decision.
      </p>
    `;
  } else if (timeEntryApproved) {
    const {
      date,
      timeIn,
      timeOut,
      finalApprovedBy
    } = timeEntryDetails;

    mainContent = `
      <p>Great news! Your time entry has been approved.</p>
      
      <div class="leave-details-card">
        <h3 style="color: #28a745; margin-bottom: 15px; font-size: 18px;">Approved Time Entry Details</h3>
        
        <div class="detail-row">
          <span class="detail-label">Date:</span>
          <span class="detail-value">${date}</span>
        </div>
        
        <div class="detail-row">
          <span class="detail-label">Time In:</span>
          <span class="detail-value">${timeIn}</span>
        </div>
        
        <div class="detail-row">
          <span class="detail-label">Time Out:</span>
          <span class="detail-value">${timeOut}</span>
        </div>
        
        <div class="detail-row">
          <span class="detail-label">Approved By:</span>
          <span class="detail-value">${finalApprovedBy}</span>
        </div>
      </div>

      <div class="cta-box" style="background-color: #d4edda; border-color: #c3e6cb; color: #155724;">
        Your time entry has been successfully processed and is now part of your timesheet records.
      </div>

      <p style="margin-top: 20px; font-size: 14px; color: #666;">
        Thank you for submitting your time entry. If you have any questions, please contact your manager or HR department.
      </p>
    `;
  } else if (timeEntryRejected) {
    const {
      date,
      timeIn,
      timeOut,
      rejectedBy,
      rejectionReason
    } = timeEntryDetails;

    mainContent = `
      <p>We regret to inform you that your time entry has been rejected.</p>
      
      <div class="leave-details-card">
        <h3 style="color: #dc3545; margin-bottom: 15px; font-size: 18px;">Rejected Time Entry Details</h3>
        
        <div class="detail-row">
          <span class="detail-label">Date:</span>
          <span class="detail-value">${date}</span>
        </div>
        
        <div class="detail-row">
          <span class="detail-label">Time In:</span>
          <span class="detail-value">${timeIn}</span>
        </div>
        
        <div class="detail-row">
          <span class="detail-label">Time Out:</span>
          <span class="detail-value">${timeOut}</span>
        </div>
        
        <div class="detail-row">
          <span class="detail-label">Rejected By:</span>
          <span class="detail-value">${rejectedBy}</span>
        </div>
        
        <div class="detail-row">
          <span class="detail-label">Rejection Reason:</span>
          <span class="detail-value">${rejectionReason}</span>
        </div>
      </div>

      <div class="cta-box" style="background-color: #f8d7da; border-color: #f5c6cb; color: #721c24;">
        Please review the rejection reason and resubmit your time entry with the necessary corrections if needed.
      </div>

      <p style="margin-top: 20px; font-size: 14px; color: #666;">
        If you have any questions about this rejection, please contact your manager or HR department for clarification.
      </p>
    `;
  } else if (resignationApproval) {
    const {
      employeeName,
      employeeEmail,
      reason,
      lastDayOfWorking,
      notifiedDate,
      approvalLink
    } = resignationDetails;

    mainContent = `
      <p>You have received a new resignation request that requires your approval.</p>
      
      <div class="leave-details-card">
        <h3 style="color: #0073e6; margin-bottom: 15px; font-size: 18px;">Resignation Request Details</h3>
        
        <div class="detail-row">
          <span class="detail-label">Employee Name:</span>
          <span class="detail-value">${employeeName}</span>
        </div>
        
        <div class="detail-row">
          <span class="detail-label">Employee Email:</span>
          <span class="detail-value">${employeeEmail}</span>
        </div>
        
        <div class="detail-row">
          <span class="detail-label">Notified Date:</span>
          <span class="detail-value">${notifiedDate}</span>
        </div>
        
        <div class="detail-row">
          <span class="detail-label">Last Working Day:</span>
          <span class="detail-value">${lastDayOfWorking}</span>
        </div>
        
        ${reason ? `
        <div class="detail-row">
          <span class="detail-label">Reason:</span>
          <span class="detail-value">${reason}</span>
        </div>
        ` : ''}
      </div>

      <div class="cta-box">
        Please review the resignation request and take appropriate action. Click the button below to approve or reject this request.
      </div>

      <div class="button-container">
        <a 
          class="button approve-button" 
          href="${approvalLink}" 
          target="_blank"
          style="color: white; font-weight: 600; display: inline-block; margin-right: 10px;"
        >
          Review & Take Action
        </a>
      </div>

      <p style="margin-top: 25px; font-size: 14px; color: #666;">
        <strong>Note:</strong> This resignation request requires your immediate attention. Please log in to the system to review the complete details and make your decision.
      </p>
    `;
  } else if (resignationRejected) {
    const {
      reason,
      lastDayOfWorking,
      rejectedBy,
      rejectionReason
    } = resignationDetails;

    mainContent = `
      <p>We regret to inform you that your resignation request has been rejected.</p>
      
      <div class="leave-details-card">
        <h3 style="color: #dc3545; margin-bottom: 15px; font-size: 18px;">Rejected Resignation Request Details</h3>
        
        <div class="detail-row">
          <span class="detail-label">Last Working Day:</span>
          <span class="detail-value">${lastDayOfWorking}</span>
        </div>
        
        ${reason ? `
        <div class="detail-row">
          <span class="detail-label">Reason for Resignation:</span>
          <span class="detail-value">${reason}</span>
        </div>
        ` : ''}
        
        <div class="detail-row">
          <span class="detail-label">Rejected By:</span>
          <span class="detail-value">${rejectedBy}</span>
        </div>
        
        <div class="detail-row">
          <span class="detail-label">Rejection Reason:</span>
          <span class="detail-value">${rejectionReason}</span>
        </div>
      </div>

      <div class="cta-box" style="background-color: #f8d7da; border-color: #f5c6cb; color: #721c24;">
        Please review the rejection reason. If you have any questions, contact your manager or HR department for clarification.
      </div>

      <p style="margin-top: 20px; font-size: 14px; color: #666;">
        Your resignation request has been reviewed and not approved at this time. Please reach out to your manager for further discussion.
      </p>
    `;
  } else if (resignationApproved) {
    const {
      reason,
      lastDayOfWorking,
      finalApprovedBy
    } = resignationDetails;

    mainContent = `
      <p>Your resignation request has been approved.</p>
      
      <div class="leave-details-card">
        <h3 style="color: #28a745; margin-bottom: 15px; font-size: 18px;">Approved Resignation Request Details</h3>
        
        <div class="detail-row">
          <span class="detail-label">Last Working Day:</span>
          <span class="detail-value">${lastDayOfWorking}</span>
        </div>
        
        ${reason ? `
        <div class="detail-row">
          <span class="detail-label">Reason for Resignation:</span>
          <span class="detail-value">${reason}</span>
        </div>
        ` : ''}
        
        <div class="detail-row">
          <span class="detail-label">Approved By:</span>
          <span class="detail-value">${finalApprovedBy}</span>
        </div>
      </div>

      <div class="cta-box" style="background-color: #d4edda; border-color: #c3e6cb; color: #155724;">
        Your resignation request has been successfully approved. HR will reach out to you regarding the exit process and formalities.
      </div>

      <p style="margin-top: 20px; font-size: 14px; color: #666;">
        Thank you for your service. We wish you all the best in your future endeavors. If you have any questions, please contact your manager or HR department.
      </p>
    `;
  }
  else if (documentUpload) {
    mainContent = `
      <p>Thank you for moving forward in the hiring process. Please upload your required documents using the link below.</p>
      <div class="cta-box">
        Kindly ensure all documents are uploaded at the earliest to avoid any delays.
      </div>
      <a 
        class="button" 
        href="${testLink}" 
        target="_blank"
        style="color: white; font-weight: 600; display: inline-block;"
      >
        Upload Documents
      </a>
    `;
  } else if (isFeedback) {
    mainContent = `
      <p>Thank you for attending the interview. Please provide your feedback at the link below.</p>
      <a 
        class="button" 
        href="${testLink}" 
        target="_blank"
        style="color: white; font-weight: 600; display: inline-block;"
      >
        Give Feedback
      </a>
    `;
  } else if (Onboarding) {
    mainContent = `
    <p>Welcome to the team! We're excited to have you on board. Please complete your onboarding process using the link below.</p>
    <div class="cta-box">
      This will help us get everything ready for your first day. Kindly complete the onboarding steps as soon as possible.
    </div>
    <a 
      class="button" 
      href="${testLink}" 
      target="_blank"
      style="color: white; font-weight: 600; display: inline-block;"
    >
      Start Onboarding
    </a>
  `;
  }
  
  else if (documentUploadTemplateHR) {
     mainContent = `
    
    <p>This is to inform you that the candidate <strong>${name}</strong> has successfully uploaded the required onboarding documents.</p>
    <p>Please verify the submitted documents at your earliest convenience.</p>
    <p>
      <strong>Candidate Name:</strong> ${name}<br/>
      <strong>Email:</strong> ${email}<br/>
      <strong>Candidate ID:</strong> ${id}
    </p>
    <div class="cta-box" style="margin-top: 16px; padding: 10px; background-color: #f0f0f0; border-left: 4px solid #007bff;">
      Kindly ensure that the documents are reviewed to proceed with the next steps in the hiring process.
    </div>
  `;
    
  }
  
  else {
    mainContent = `
      <p>We're excited to invite you to take the next step in your application process by completing a short psychometric assessment.</p>
      <div class="cta-box">
        Your assessment is ready — please complete it at your earliest convenience.
      </div>
      <p>The test helps us better understand your strengths and suitability for the role. It should take approximately 15–20 minutes to complete.</p>
      <a 
        class="button" 
        href="${testLink}" 
        target="_blank"
        style="color: white; font-weight: 600; display: inline-block;"
      >
        Start Assessment
      </a>
    `;
  }

  return `<!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>${
        credentialsEmail ? 'Your Vihanga Login Credentials' :
        taskAssigned ? 'Task Assigned to You' :
        leaveApproval ? 'Leave Approval Required' : 
        leaveRejected ? 'Leave Request Rejected' : 
        leaveApproved ? 'Leave Request Approved' : 
        timeEntryApproval ? 'Time Entry Approval Required' : 
        timeEntryApproved ? 'Time Entry Approved' : 
        timeEntryRejected ? 'Time Entry Rejected' : 
        resignationApproval ? 'Resignation Approval Required' :
        resignationRejected ? 'Resignation Request Rejected' :
        resignationApproved ? 'Resignation Request Approved' :
        'Notification'
      }</title>
      <style>
        body {
          font-family: 'Helvetica Neue', 'Segoe UI', sans-serif;
          background-color: #f4f6f8;
          margin: 0;
          padding: 0;
          color: #333;
        }

        .container {
          max-width: 600px;
          margin: 40px auto;
          background-color: #ffffff;
          padding: 40px;
          border-radius: 10px;
          box-shadow: 0 4px 14px rgba(0, 0, 0, 0.08);
        }

        .logo {
          text-align: center;
          margin-bottom: 30px;
        }

        .logo img {
          height: 60px;
        }

        h2 {
          font-size: 22px;
          margin-bottom: 10px;
          color: #1a1a1a;
        }

        p {
          font-size: 16px;
          line-height: 1.6;
        }

        .cta-box {
          background-color: #f0f8ff;
          border-left: 4px solid #0073e6;
          padding: 18px 20px;
          margin: 20px 0;
          font-size: 16px;
          font-weight: 500;
          color: #1a1a1a;
        }

        .leave-details-card {
          background-color: #f8f9fa;
          border: 1px solid #e9ecef;
          border-radius: 8px;
          padding: 20px;
          margin: 20px 0;
        }

        .detail-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 12px;
          padding: 8px 0;
          border-bottom: 1px solid #e9ecef;
        }

        .detail-row:last-child {
          border-bottom: none;
          margin-bottom: 0;
        }

        .detail-label {
          font-weight: 600;
          color: #495057;
          min-width: 120px;
        }

        .detail-value {
          color: #212529;
          text-align: right;
          flex: 1;
        }

        /* Table layout for better cross-client alignment */
        .details-table { width: 100%; border-collapse: collapse; }
        .details-label { font-weight: 600; color: #495057; padding: 8px 0; width: 45%; }
        .details-sep { width: 10px; color: #adb5bd; }
        .details-value { color: #212529; padding: 8px 0; }

        .button {
          display: inline-block;
          margin-top: 25px;
          padding: 12px 28px;
          background-color: #0073e6;
          color: #ffffff;
          text-decoration: none;
          border-radius: 6px;
          font-size: 16px;
        }

        .button-container {
          text-align: center;
          margin: 25px 0;
        }

        .approve-button {
          background-color: #28a745;
          margin-top: 0;
        }

        .approve-button:hover {
          background-color: #218838;
        }

        .footer {
          margin-top: 40px;
          text-align: center;
          font-size: 13px;
          color: #888;
        }

        @media only screen and (max-width: 600px) {
          .container {
            padding: 20px;
          }

          .detail-row {
            flex-direction: column;
            align-items: flex-start;
          }

          .detail-value {
            text-align: left;
            margin-top: 4px;
          }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="logo">
  
           <img src="https://vihanga.talentspotifyapp.com/static/media/AppNewLogo.659d36d1492d4ee0455a.png" alt="Vihanga Logo" />
        </div>
        <h2>${heading}</h2>
        ${mainContent}
        <div class="footer">
           © ${currentYear} Vihanga. All rights reserved.
        </div>
      </div>
    </body>
  </html>`;
};

module.exports = {
  statusUpdateTemplate,
};
