const objectiveApprovalTemplate = ({
    managerName,
    employeeName,
    objectiveTitle,
    weight,
    dueDate,
    viewUrl
}) => {
    const currentYear = new Date().getFullYear();

    return `<!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Objective Approval Required</title>
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

        .details-card {
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

        .button-container {
          text-align: center;
          margin: 25px 0;
        }

        .button {
          display: inline-block;
          padding: 12px 28px;
          background-color: #28a745;
          color: #ffffff;
          text-decoration: none;
          border-radius: 6px;
          font-size: 16px;
          font-weight: 600;
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
        <h2>Dear ${managerName},</h2>
        <p>This is to inform you that <strong>${employeeName}</strong> has submitted an objective for your approval.</p>

        <div class="details-card">
          <h3 style="color: #0073e6; margin-bottom: 15px; font-size: 18px;">Objective Details</h3>
          
          <div class="detail-row">
            <span class="detail-label">Objective:</span>
            <span class="detail-value">${objectiveTitle}</span>
          </div>
          
          <div class="detail-row">
            <span class="detail-label">Weight:</span>
            <span class="detail-value">${weight}%</span>
          </div>
          
          <div class="detail-row">
            <span class="detail-label">Due Date:</span>
            <span class="detail-value">${dueDate}</span>
          </div>
        </div>

        <div class="cta-box">
          Please review the objective and take appropriate action. Click the button below to view the approval dashboard.
        </div>

        <div class="button-container">
          <a class="button" href="${viewUrl}" target="_blank">Review & Approve</a>
        </div>

        <p style="margin-top: 25px; font-size: 14px; color: #666;">
          <strong>Note:</strong> This request requires your attention to ensure the employee's goals are aligned for the period.
        </p>

        <div class="footer">
           © ${currentYear} Vihanga. All rights reserved.
        </div>
      </div>
    </body>
  </html>`;
};

module.exports = {
    objectiveApprovalTemplate,
};
