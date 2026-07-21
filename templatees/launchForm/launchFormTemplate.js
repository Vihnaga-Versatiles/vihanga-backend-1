const launchFormTemplate = ({
    employeeName,
    formType,
    templateName,
    launchDate,
    reviewPeriodStartDate,
    reviewPeriodEndDate,
    formLink
  }) => {
    console.log("emailData at launchFormTemplate", {
      employeeName,
      formType,
      templateName,
      launchDate,
      reviewPeriodStartDate,
      reviewPeriodEndDate,
      formLink
    });
    
    const currentYear = new Date().getFullYear();
    
    // Format the launch date
    const formattedLaunchDate = new Date(launchDate).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric"
    });
    
    // Format the review period dates with fallback for undefined/invalid dates
    const formattedStartDate = reviewPeriodStartDate 
      ? new Date(reviewPeriodStartDate).toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric"
        })
      : "Not specified";
    
    const formattedEndDate = reviewPeriodEndDate 
      ? new Date(reviewPeriodEndDate).toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric"
        })
      : "Not specified";
  
    // // Generate steps list - handle case where displaySteps is undefined or empty
    // let stepsList = "";
    // if (displaySteps && Array.isArray(displaySteps)) {
    //   stepsList = displaySteps
    //     .filter(step => step.isChecked)
    //     .map(step => `<li>${step.text || step.value}</li>`)
    //     .join("");
    // }
  
    return `<!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Performance Review Launch Notification</title>
        <style>
          body {
            font-family: "Helvetica Neue", "Segoe UI", sans-serif;
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
  
          .form-details-card {
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
            min-width: 140px;
          }
  
          .detail-value {
            color: #212529;
            text-align: right;
            flex: 1;
          }
  
          .steps-section {
            margin: 20px 0;
          }
  
          .steps-title {
            font-size: 18px;
            font-weight: 600;
            color: #0073e6;
            margin-bottom: 15px;
          }
  
          .steps-list {
            background-color: #f8f9fa;
            border: 1px solid #e9ecef;
            border-radius: 8px;
            padding: 15px;
            margin: 10px 0;
          }
  
          .steps-list ul {
            margin: 0;
            padding-left: 20px;
          }
  
          .steps-list li {
            margin-bottom: 8px;
            color: #495057;
          }
  
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
          <h2>Dear ${employeeName},</h2>
          
          <p>A new ${formType} form has been launched and you are required to participate in this review process.</p>
          
          <div class="form-details-card">
            <h3 style="color: #0073e6; margin-bottom: 15px; font-size: 18px;">Review Form Details</h3>
            
            <div class="detail-row">
              <span class="detail-label">Form Type:</span>
              <span class="detail-value">${formType}</span>
            </div>
            
            <div class="detail-row">
              <span class="detail-label">Template Name:</span>
              <span class="detail-value">${templateName}</span>
            </div>
            
            <div class="detail-row">
              <span class="detail-label">Launch Date:</span>
              <span class="detail-value">${formattedLaunchDate}</span>
            </div>
            
            <div class="detail-row">
              <span class="detail-label">Review Period:</span>
              <span class="detail-value">${formattedStartDate} - ${formattedEndDate}</span>
            </div>
          </div>
  
         
  
          <div class="cta-box">
            Please access the review form using the link below and complete your assigned steps within the specified timeline.
          </div>
  
          <div class="button-container">
            <a 
              class="button" 
              href="${formLink}" 
              target="_blank"
              style="color: white; font-weight: 600; display: inline-block;"
            >
              Access Review Form
            </a>
          </div>
  
          <p style="margin-top: 25px; font-size: 14px; color: #666;">
            <strong>Important:</strong> Please ensure you complete your assigned steps within the review period. If you have any questions or need assistance, please contact your manager or HR department.
          </p>
  
          <div class="footer">
             © ${currentYear} Vihanga. All rights reserved.
          </div>
        </div>
      </body>
    </html>`;
  };
  
  module.exports = {
    launchFormTemplate,
  };