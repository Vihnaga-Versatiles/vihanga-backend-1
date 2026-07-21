const approvalNotificationTemplate = (data) => {
  const {
    recipientName,
    employeeName,
    
    status,
    formLink,
    reviewPeriod,
    currentDate,
    notificationType,
    companyName
  } = data;

  // Different messages based on status and notification type
  let subject, actionRequired, message, buttonText;

  switch (status) {
    case 'Manager Review':
      if (notificationType === 'manager') {
        subject = `Action Required: Review Form Ready for Manager Review - ${employeeName}`;
        actionRequired = `Please review and provide feedback for ${employeeName}'s performance review.`;
        message = `${employeeName} has submitted their review form and it's now ready for your review and feedback.`;
        buttonText = 'Review Form';
      }
      break;

    case 'HR Review':
      if (notificationType === 'hr') {
        subject = `Action Required: Review Form Ready for HR Review - ${employeeName}`;
        actionRequired = `Please review the completed performance review for ${employeeName}.`;
        message = `The manager has completed the review for ${employeeName} and it's now ready for HR review.`;
        buttonText = 'Review Form';
      }
      break;

    case 'Manager SignOff':
      if (notificationType === 'manager') {
        subject = `Action Required: Manager Sign-Off Needed - ${employeeName}`;
        actionRequired = `Please provide your final sign-off for ${employeeName}'s performance review.`;
        message = `The performance review for ${employeeName} has been processed and requires your final sign-off.`;
        buttonText = 'Sign Off';
      }
      break;

    case 'Employee SignOff':
      if (notificationType === 'employee') {
        subject = `Action Required: Your Performance Review Sign-Off`;
        actionRequired = `Please review and sign-off on your completed performance review.`;
        message = `Your performance review has been completed by your manager and HR. Please review the feedback and provide your sign-off.`;
        buttonText = 'Sign Off';
      }
      break;

    case 'Completed':
      if (notificationType === 'employee') {
        subject = `Performance Review Completed - ${reviewPeriod}`;
        actionRequired = `Your performance review has been successfully completed.`;
        message = `Congratulations! Your performance review for ${reviewPeriod} has been completed and finalized.`;
        buttonText = 'View Review';
      } else if (notificationType === 'hr') {
        subject = `Performance Review Completed - ${employeeName}`;
        actionRequired = `The performance review for ${employeeName} has been completed.`;
        message = `The performance review process for ${employeeName} has been successfully completed and finalized.`;
        buttonText = 'View Review';
      }
      break;

    default:
      subject = `Review Form Update - ${employeeName}`;
      actionRequired = `Please check the review form for updates.`;
      message = `The review form for ${employeeName} has been updated.`;
      buttonText = 'View Form';
  }

  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${subject}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Arial', sans-serif;
            background-color: #f5f5f5;
            color: #333333;
            line-height: 1.6;
        }
        
        .email-container {
            max-width: 600px;
            margin: 20px auto;
            background-color: #ffffff;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
            overflow: hidden;
        }
        
        .email-header {
            background-color: #ffffff;
            padding: 30px 40px 20px;
            text-align: center;
            border-bottom: 1px solid #e9ecef;
        }
        
        .logo {
            margin-bottom: 20px;
        }
        
        .logo img {
            height: 50px;
            width: auto;
        }
        
        .email-header h1 {
            font-size: 24px;
            font-weight: 600;
            margin-bottom: 8px;
            color: #2c3e50;
        }
        
        .email-header p {
            font-size: 16px;
            color: #6c757d;
        }
        
        .email-content {
            padding: 40px;
        }
        
        .greeting {
            font-size: 18px;
            color: #2c3e50;
            margin-bottom: 20px;
            font-weight: 500;
        }
        
        .message {
            font-size: 16px;
            color: #555555;
            margin-bottom: 30px;
            line-height: 1.6;
        }
        
        .action-required {
            background-color: #f8f9fa;
            border: 1px solid #dee2e6;
            border-left: 4px solid #007bff;
            border-radius: 6px;
            padding: 20px;
            margin: 30px 0;
        }
        
        .action-required h3 {
            color: #007bff;
            margin-bottom: 10px;
            font-size: 16px;
            font-weight: 600;
        }
        
        .action-required p {
            color: #495057;
            margin: 0;
            font-size: 14px;
        }
        
        .review-details {
            background-color: #f8f9fa;
            border-radius: 6px;
            padding: 25px;
            margin: 30px 0;
        }
        
        .review-details h3 {
            color: #2c3e50;
            margin-bottom: 20px;
            font-size: 16px;
            font-weight: 600;
        }
        
        .detail-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px 0;
            border-bottom: 1px solid #dee2e6;
        }
        
        .detail-row:last-child {
            border-bottom: none;
        }
        
        .detail-label {
            font-weight: 600;
            color: #6c757d;
            font-size: 14px;
        }
        
        .detail-value {
            color: #2c3e50;
            font-size: 14px;
            text-align: right;
        }
        
        .status-badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 500;
            text-transform: uppercase;
            background-color: #007bff;
            color: white;
        }
        
        .cta-container {
            text-align: center;
            margin: 40px 0;
        }
        
        .cta-button {
            display: inline-block;
            background-color: #007bff;
            color: white;
            text-decoration: none;
            padding: 14px 30px;
            border-radius: 6px;
            font-weight: 600;
            font-size: 16px;
            transition: background-color 0.3s ease;
        }
        
        .cta-button:hover {
            background-color: #0056b3;
            text-decoration: none;
            color: white;
        }
        
        .note {
            font-size: 14px;
            color: #6c757d;
            margin-top: 30px;
            text-align: center;
        }
        
        .footer-note {
            background-color: #f8f9fa;
            padding: 25px;
            text-align: center;
            border-top: 1px solid #dee2e6;
        }
        
        .footer-note p {
            color: #6c757d;
            font-size: 13px;
            margin: 5px 0;
        }
        
        .footer-note .company-name {
            font-weight: 600;
            color: #2c3e50;
        }
        
        @media (max-width: 600px) {
            .email-container {
                margin: 10px;
                border-radius: 6px;
            }
            
            .email-header,
            .email-content {
                padding: 25px 20px;
            }
            
            .email-header h1 {
                font-size: 22px;
            }
            
            .logo img {
                height: 40px;
            }
            
            .cta-button {
                padding: 12px 25px;
                font-size: 15px;
            }
            
            .detail-row {
                flex-direction: column;
                align-items: flex-start;
                gap: 5px;
            }
            
            .detail-value {
                text-align: left;
            }
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="email-header">
            <div class="logo">
                <img src="https://vihanga.talentspotifyapp.com/static/media/AppNewLogo.659d36d1492d4ee0455a.png" alt="Vihanga Logo" />
            </div>
            <h1>Performance Review Update</h1>
            <p>Action Required for Review Process</p>
        </div>
        
        <div class="email-content">
            <div class="greeting">
                Hello ${recipientName},
            </div>
            
            <div class="message">
                ${message}
            </div>
            
            <div class="action-required">
                <h3>Action Required</h3>
                <p>${actionRequired}</p>
            </div>
            
            <div class="review-details">
                <h3>Review Details</h3>
                <div class="detail-row">
                    <span class="detail-label">Employee:</span>
                    <span class="detail-value">${employeeName} </span>
                </div>
                
                <div class="detail-row">
                    <span class="detail-label">Review Period:</span>
                    <span class="detail-value">${reviewPeriod}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Current Status:</span>
                    <span class="detail-value">
                        <span class="status-badge">${status}</span>
                    </span>
                </div>
               
            </div>
            
            <div class="cta-container">
                <a href="${formLink}" class="cta-button">
                    ${buttonText}
                </a>
            </div>
            
            <div class="note">
                Please complete this action at your earliest convenience. If you have any questions or need assistance, 
                please contact your HR department.
            </div>
        </div>
        
        <div class="footer-note">
            <p>This is an automated notification from <span class="company-name">${companyName || 'Vihanga'}</span></p>
            <p>Sent on ${currentDate}</p>
            <p style="margin-top: 15px;">
                Please do not reply to this email. This mailbox is not monitored.
            </p>
        </div>
    </div>
</body>
</html>`;
};

module.exports = { approvalNotificationTemplate };
