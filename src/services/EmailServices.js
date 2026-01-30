const { sendMail } = require("../utils/mailer");

/**
 * Handle support request sent by an inspector
 *
 * @param {object} payload - Should include:
 *   - inspector: { firstName, lastName, userId, email }
 *   - message: string
 * @returns {Promise<void>}
 */
async function emailSupport(payload) {
  // Destructure payload
  const { inspector, message } = payload;

  // Construct the HTML email content
  const emailHtml = `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Support Request - Property Inspector Pro</title>
<style>
  body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f8f9fa; }
  .container { max-width: 600px; margin: 0 auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
  .header { background: linear-gradient(135deg, #1a3a5f 0%, #2c5282 100%); color: white; padding: 30px 20px; text-align: center; }
  .header h1 { margin: 0; font-size: 24px; font-weight: 600; }
  .header .subtitle { margin-top: 8px; opacity: 0.9; font-size: 14px; }
  .content { padding: 40px 30px; }
  .icon-section { text-align: center; margin-bottom: 30px; }
  .icon { font-size: 48px; color: #2c5282; margin-bottom: 15px; }
  .icon-badge { display: inline-block; background: #e6f2ff; padding: 15px; border-radius: 50%; }
  .message { font-size: 16px; line-height: 1.8; color: #4a5568; margin-bottom: 30px; }
  .footer { background: #f8f9fa; padding: 25px 30px; text-align: center; font-size: 14px; color: #718096; border-top: 1px solid #e2e8f0; }
  @media (max-width: 600px) { .content { padding: 30px 20px; } .header { padding: 25px 15px; } .header h1 { font-size: 22px; } }
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <h1>Support Request</h1>
    <div class="subtitle">Property Inspector Pro System</div>
  </div>

  <div class="content">
    <div class="icon-section">
      <div class="icon-badge">
        <div class="icon">🏠</div>
      </div>
      <h2 style="color: #2c5282; margin-bottom: 5px;">Support request from Inspector ${inspector.firstName} ${inspector.lastName}</h2>
      <p style="color: #718096; margin-top: 5px;">Email: ${inspector.email}</p>
    </div>

    <div class="message">
      <p><strong>Message:</strong></p>
      <p>${message}</p>
    </div>
  </div>

  <div class="footer">
    <p>© ${new Date().getFullYear()} Property Inspector Pro. All rights reserved.</p>
    <p>Professional Real Estate Inspection Management System</p>
    <p style="margin-top: 15px; font-size: 12px; color: #a0aec0;">
      This is an automated message. Please do not reply to this email.
    </p>
  </div>
</div>
</body>
</html>
  `;

  // Send the email to support/admin
  await sendMail({
    to: process.env.MAIL_USER, // support email
    from: inspector.email, // sender = inspector
    subject: `Support request from Inspector - ${inspector.firstName} ${inspector.lastName}`,
    html: emailHtml,
  });
}

module.exports = { emailSupport };
