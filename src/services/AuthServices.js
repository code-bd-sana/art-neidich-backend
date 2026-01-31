const crypto = require("crypto");

const mongoose = require("mongoose");
const { v4 } = require("uuid");

const { generateToken } = require("../helpers/jwt/jwt-utils");
const {
  hashPassword,
  comparePassword,
} = require("../helpers/password/password-util");
const NotificationModel = require("../models/NotificationModel");
const PushToken = require("../models/PushToken");
const UserModel = require("../models/UserModel");
const { sendMail } = require("../utils/mailer");

const { sendToMany, sendToUser } = require("./NotificationServices");

/**
 * Register a new user
 *
 * @param {{firstName: string, lastName: string, email: string, password: string, role: number, pushToken?: string, platform?: "android" | "ios", deviceName?: string}} payload
 * @returns {Promise<void>}
 */
async function registerUser(payload) {
  // Destructure payload
  const { firstName, lastName, email, password, role } = payload;

  // Check if email already exists
  const existing = await UserModel.findOne({ email });

  // If exists, throw error
  if (existing) {
    const err = new Error("Email already in use");
    err.status = 400;
    err.code = "EMAIL_IN_USE";
    throw err;
  }

  // Hash password
  const hashed = await hashPassword(password);

  let newUser;

  try {
    // Create user
    newUser = await UserModel.create({
      firstName: firstName,
      lastName: lastName,
      email,
      password: hashed,
      role,
    });

    // Prepare welcome email HTML
    const roleNames = {
      1: "Administrator",
      2: "Inspector",
    };

    // Welcome email HTML template
    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Registration Successful - Property Inspector Pro</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            margin: 0;
            padding: 0;
            background-color: #f8f9fa;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            background: #ffffff;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }
        .header {
            background: linear-gradient(135deg, #1a3a5f 0%, #2c5282 100%);
            color: white;
            padding: 30px 20px;
            text-align: center;
        }
        .header h1 {
            margin: 0;
            font-size: 24px;
            font-weight: 600;
        }
        .badge {
            display: inline-block;
            background: #48bb78;
            color: white;
            padding: 6px 16px;
            border-radius: 20px;
            font-size: 14px;
            font-weight: 600;
            margin-top: 10px;
        }
        .content {
            padding: 40px 30px;
        }
        .welcome-section {
            text-align: center;
            margin-bottom: 30px;
        }
        .welcome-icon {
            font-size: 60px;
            color: #2c5282;
            margin-bottom: 20px;
        }
        .user-details {
            background: #f8f9fa;
            border-radius: 8px;
            padding: 25px;
            margin: 25px 0;
            border-left: 4px solid #2c5282;
        }
        .detail-row {
            display: flex;
            margin-bottom: 12px;
            padding-bottom: 12px;
            border-bottom: 1px solid #e2e8f0;
        }
        .detail-label {
            font-weight: 600;
            color: #4a5568;
            width: 120px;
            flex-shrink: 0;
        }
        .detail-value {
            color: #2c5282;
            font-weight: 500;
        }
        .status-card {
            background: #fff5e6;
            border: 1px solid #fed7aa;
            border-radius: 8px;
            padding: 20px;
            margin: 25px 0;
            text-align: center;
        }
        .status-card.pending {
            background: #e6fffa;
            border-color: #81e6d9;
        }
        .next-steps {
            margin: 30px 0;
        }
        .next-steps h3 {
            color: #2c5282;
            margin-bottom: 15px;
        }
        .step {
            display: flex;
            align-items: flex-start;
            margin-bottom: 15px;
        }
        .step-number {
            background: #2c5282;
            color: white;
            width: 28px;
            height: 28px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 600;
            margin-right: 15px;
            flex-shrink: 0;
        }
        .footer {
            background: #f8f9fa;
            padding: 25px 30px;
            text-align: center;
            font-size: 14px;
            color: #718096;
            border-top: 1px solid #e2e8f0;
        }
        .contact-info {
            background: #e6f2ff;
            padding: 20px;
            border-radius: 6px;
            margin: 20px 0;
        }
        @media (max-width: 600px) {
            .content {
                padding: 30px 20px;
            }
            .detail-row {
                flex-direction: column;
            }
            .detail-label {
                width: 100%;
                margin-bottom: 5px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🏠 Welcome to Property Inspector Pro!</h1>
            <div class="badge">${roleNames[role]}</div>
        </div>
        
        <div class="content">
            <div class="welcome-section">
                <div class="welcome-icon">👋</div>
                <h2 style="color: #2c5282; margin-bottom: 10px;">
                    Welcome, ${firstName} ${lastName}!
                </h2>
                <p style="color: #718096;">
                    Thank you for registering with Property Inspector Pro. Your account has been created successfully.
                </p>
            </div>
            
            <div class="user-details">
                <h3 style="color: #2c5282; margin-top: 0;">📋 Account Details</h3>
                <div class="detail-row">
                    <div class="detail-label">Name:</div>
                    <div class="detail-value">${firstName} ${lastName}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Email:</div>
                    <div class="detail-value">${email}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Role:</div>
                    <div class="detail-value">${roleNames[role]}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Registration Date:</div>
                    <div class="detail-value">${new Date().toLocaleDateString()}</div>
                </div>
            </div>
            
            <div class="status-card pending">
                <h3 style="margin-top: 0; color: #d69e2e;">⏳ Pending Approval</h3>
                <p>Your account is pending approval from an administrator. You will receive an email once your account is approved.</p>
                <p style="font-size: 14px; color: #718096; margin-top: 10px;">
                    <strong>Estimated approval time:</strong> 1-2 business days
                </p>
            </div>
            
            <div class="next-steps">
                <h3>📝 What Happens Next?</h3>
                <div class="step">
                    <div class="step-number">1</div>
                    <div>
                        <strong>Account Review</strong><br>
                        Our admin team will review your registration details.
                    </div>
                </div>
                <div class="step">
                    <div class="step-number">2</div>
                    <div>
                        <strong>Approval Notification</strong><br>
                        You'll receive an email once your account is approved.
                    </div>
                </div>
                <div class="step">
                    <div class="step-number">3</div>
                    <div>
                        <strong>Login & Access</strong><br>
                        After approval, you can login and access the system.
                    </div>
                </div>
            </div>
            
            <p style="text-align: center; color: #718096; font-size: 14px; margin-top: 30px;">
                This is an automated message. Please do not reply to this email.
            </p>
        </div>
        
        <div class="footer">
            <p>© ${new Date().getFullYear()} Property Inspector Pro. All rights reserved.</p>
            <p>Professional Real Estate Inspection Management System</p>
        </div>
    </div>
</body>
</html>
  `;

    // Send the welcome email
    const sendResult = await sendMail({
      to: email,
      subject: "🏠 Welcome to Property Inspector Pro - Registration Successful",
      html: emailHtml,
    });

    // Check if email was sent successfully
    if (!sendResult || !sendResult.messageId) {
      const err = new Error(
        "Failed to send welcome email. Registration aborted.",
      );
      err.status = 500;
      err.code = "WELCOME_EMAIL_FAILED";
      throw err;
    }

    // If this is an inspector or admin registration (role 1, 2), notify admins (role 0 and 1)
    try {
      if (role === 1 || role === 2) {
        // find admin users
        const admins = await UserModel.find({
          role: { $in: [0, 1] },
          isSuspended: false,
          isApproved: true,
        }).select("_id firstName lastName email");

        // extract admin IDs
        const adminIds = (admins || []).map(
          (a) => new mongoose.Types.ObjectId(a._id),
        );

        // resolve device tokens for admins to send push notifications
        const tokens = await PushToken.find({
          "users.user": { $in: adminIds },
          "users.notificationActive": true,
        }).select("token");

        // extract token strings
        const deviceTokens = (tokens || []).map((t) => t.token);

        // create notification record
        const types = NotificationModel.notificationTypes || {};

        // create notification
        const notif = await NotificationModel.create({
          title: `New ${roleNames === 1 ? "admin" : "inspector"} registration`,
          body: `${firstName} ${lastName} has registered as an ${role === 1 ? "admin" : "inspector"} and is awaiting approval.`,
          data: { userId: new mongoose.Types.ObjectId(newUser._id), role },
          type:
            role === 1
              ? types.REGISTERED_AS_ADMIN || "registered_as_admin"
              : types.REGISTERED_AS_INSPECTOR || "registered_as_inspector",
          authorId: new mongoose.Types.ObjectId(newUser._id),
          recipients: adminIds,
          deviceTokens,
          status: "pending",
        });

        // attempt to send push notifications
        try {
          // Send notifications to device tokens or individual admins
          let sendResult = null;
          if (deviceTokens.length > 0) {
            // send to many
            sendResult = await sendToMany(deviceTokens, {
              title: notif.title,
              body: notif.body,
              data: notif.data,
            });
          }

          // send to single user
          else if (adminIds.length === 1) {
            sendResult = await sendToUser(adminIds[0], {
              title: notif.title,
              body: notif.body,
              data: notif.data,
            });
          } else {
            sendResult = { warning: "no-targets" };
          }

          notif.status = "sent";
          notif.result = sendResult;
          notif.sentAt = new Date();
          // save notification result
          await notif.save();
        } catch (sendErr) {
          notif.status = "failed";
          notif.result = { error: sendErr.message || String(sendErr) };
          await notif.save();
        }
      }
    } catch (e) {
      // swallow notification errors to avoid blocking registration
      console.error("Notification send error:", e);
    }

    return {
      _id: newUser._id,
      firstName: newUser.firstName,
      lastName: newUser.lastName,
      email: newUser.email,
      role: newUser.role,
    };
  } catch (error) {
    // If anything fails after user creation (email, notifications, etc), delete the user
    if (newUser && newUser._id) {
      try {
        await UserModel.findByIdAndDelete(newUser._id);
        console.error(
          `User ${newUser._id} deleted due to registration failure:`,
          error.message,
        );
      } catch (deleteError) {
        console.error(
          `Failed to delete user ${newUser._id} after registration error:`,
          deleteError.message,
        );
      }
    }
    // Re-throw the original error so the controller can handle it
    throw error;
  }
}

/**
 * Authenticate user and return token
 *
 * @param {{email: string, password: string}} payload
 * @returns {Promise<string>} JWT token
 */
async function loginUser(payload) {
  // Destructure payload
  const { email, password } = payload;

  // Find user by email
  const user = await UserModel.findOne({ email });

  // If user not found, throw error
  if (!user) {
    const err = new Error("Invalid email or password");
    err.status = 401;
    err.code = "INVALID_CREDENTIALS";
    throw err;
  }

  // Guard against missing values before calling bcrypt.compare
  if (!password || typeof password !== "string" || !password.length) {
    const err = new Error("Invalid email or password");
    err.status = 401;
    err.code = "INVALID_CREDENTIALS";
    throw err;
  }

  // Guard against missing hashed password
  if (
    !user.password ||
    typeof user.password !== "string" ||
    !user.password.length
  ) {
    const err = new Error("Invalid email or password");
    err.status = 401;
    err.code = "INVALID_CREDENTIALS";
    throw err;
  }

  // New check for suspended users
  if (user.isSuspended) {
    const err = new Error("User account is suspended");
    err.status = 403;
    err.code = "USER_SUSPENDED";
    throw err;
  }

  // Check for approved users
  if (!user.isApproved) {
    const err = new Error("User account is not approved");
    err.status = 403;
    err.code = "USER_NOT_APPROVED";
    throw err;
  }

  // Compare passwords
  const match = await comparePassword(password, user.password);

  // If passwords do not match, throw error
  if (!match) {
    const err = new Error("Invalid email or password");
    err.status = 401;
    err.code = "INVALID_CREDENTIALS";
    throw err;
  }

  // Generate JWT token
  const token = await generateToken({
    id: user._id,
    userId: user.userId,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    role: user.role,
  });

  // Return user details and token
  const roleMap = {
    0: "Super Admin",
    1: "Admin",
    2: "Inspector",
  };

  return {
    user: {
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: roleMap[user.role],
    },
    token,
  };
}

/**
 * Initiate forgot password process
 *
 * @param {{email: string}} payload
 * @returns {Promise<void>}
 */
async function initiateForgotPassword(payload) {
  // Destructure payload
  const { email, webRequest, mobileRequest } = payload;

  // Find user by email
  const user = await UserModel.findOne({ email });

  // Do not reveal whether the email exists. Return early so controller
  // can respond with a generic success message.
  if (!user) {
    const err = new Error("User with this email does not exist");
    err.status = 401;
    err.code = "USER_NOT_FOUND";
    throw err;
  }

  // if webRequest is true then send this
  if (webRequest) {
    const resetToken = v4();
    const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

    user.resetToken = resetToken;
    user.resetTokenExpiry = resetTokenExpiry;

    await user.save();

    // Generate reset URL
    const resetUrl = `${
      process.env.FRONTEND_URL
    }/reset-password?token=${resetToken}&email=${encodeURIComponent(
      user.email,
    )}`;

    // Email template for real estate inspector
    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Password Reset - Property Inspector Pro</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            margin: 0;
            padding: 0;
            background-color: #f8f9fa;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            background: #ffffff;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }
        .header {
            background: linear-gradient(135deg, #1a3a5f 0%, #2c5282 100%);
            color: white;
            padding: 30px 20px;
            text-align: center;
        }
        .header h1 {
            margin: 0;
            font-size: 24px;
            font-weight: 600;
        }
        .header .subtitle {
            margin-top: 8px;
            opacity: 0.9;
            font-size: 14px;
        }
        .content {
            padding: 40px 30px;
        }
        .icon-section {
            text-align: center;
            margin-bottom: 30px;
        }
        .icon {
            font-size: 48px;
            color: #2c5282;
            margin-bottom: 15px;
        }
        .icon-badge {
            display: inline-block;
            background: #e6f2ff;
            padding: 15px;
            border-radius: 50%;
        }
        .message {
            font-size: 16px;
            line-height: 1.8;
            color: #4a5568;
            margin-bottom: 30px;
        }
        .reset-button {
            display: inline-block;
            background: #2c5282;
            color: white;
            text-decoration: none;
            padding: 16px 32px;
            border-radius: 6px;
            font-weight: 600;
            font-size: 16px;
            text-align: center;
            margin: 20px 0;
            transition: background-color 0.3s ease;
        }
        .reset-button:hover {
            background: #1a3a5f;
        }
        .reset-link {
            display: block;
            word-break: break-all;
            background: #f7fafc;
            padding: 15px;
            border-radius: 6px;
            border-left: 4px solid #2c5282;
            margin: 20px 0;
            font-size: 14px;
            color: #4a5568;
        }
        .details-box {
            background: #f8f9fa;
            border-radius: 6px;
            padding: 20px;
            margin: 25px 0;
            border-left: 4px solid #48bb78;
        }
        .details-box h3 {
            color: #2c5282;
            margin-top: 0;
            font-size: 16px;
        }
        .details-box ul {
            margin: 10px 0;
            padding-left: 20px;
        }
        .details-box li {
            margin-bottom: 8px;
        }
        .footer {
            background: #f8f9fa;
            padding: 25px 30px;
            text-align: center;
            font-size: 14px;
            color: #718096;
            border-top: 1px solid #e2e8f0;
        }
        .footer-links {
            margin-top: 15px;
        }
        .footer-links a {
            color: #2c5282;
            text-decoration: none;
            margin: 0 10px;
        }
        .footer-links a:hover {
            text-decoration: underline;
        }
        .warning {
            background: #fff5f5;
            border-left: 4px solid #f56565;
            padding: 15px;
            border-radius: 6px;
            margin: 20px 0;
            font-size: 14px;
        }
        .expiry-notice {
            color: #e53e3e;
            font-weight: 600;
            font-size: 14px;
            margin: 15px 0;
        }
        @media (max-width: 600px) {
            .content {
                padding: 30px 20px;
            }
            .header {
                padding: 25px 15px;
            }
            .header h1 {
                font-size: 22px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔐 Password Reset Request</h1>
            <div class="subtitle">Property Inspector Pro System</div>
        </div>
        
        <div class="content">
            <div class="icon-section">
                <div class="icon-badge">
                    <div class="icon">🏠</div>
                </div>
                <h2 style="color: #2c5282; margin-bottom: 5px;">Hello, Inspector ${
                  user.firstName
                } ${user.lastName}</h2>
                <p style="color: #718096; margin-top: 5px;">Account ID: ${
                  user.userId
                }</p>
            </div>
            
            <div class="message">
                <p>We received a request to reset your password for your <strong>Property Inspector Pro</strong> account. If you didn't make this request, you can safely ignore this email.</p>
                <p>To reset your password, click the button below:</p>
            </div>
            
            <div style="text-align: center;">
                <a href="${resetUrl}" class="reset-button">Reset My Password</a>
            </div>
            
            <div class="expiry-notice">
                ⏰ This link will expire in 1 hour for security reasons.
            </div>
            
            <div class="warning">
                <strong>⚠️ Security Notice:</strong> For your protection, never share your password or this reset link with anyone. Our support team will never ask for your password.
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

    // Send the email
    await sendMail({
      to: user.email,
      subject: "🔐 Password Reset - Property Inspector Pro",
      html: emailHtml,
    });
  }

  if (mobileRequest) {
    // Generate OTP
    // Use a cryptographically secure generator for the OTP
    const otp = crypto.randomInt(100000, 1000000).toString(); // 6-digit OTP
    const otpExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now
    user.resetPasswordOTP = otp;
    user.resetPasswordOTPExpiry = otpExpiry;
    await user.save();

    // Send OTP via email
    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Password Reset OTP - Property Inspector Pro</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            margin: 0;
            padding: 0;
            background-color: #f8f9fa;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            background: #ffffff;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }
        .header {
            background: linear-gradient(135deg, #1a3a5f 0%, #2c5282 100%);
            color: white;
            padding: 30px 20px;
            text-align: center;
        }
        .header h1 {
            margin: 0;
            font-size: 24px;
            font-weight: 600;
        }
        .content {
            padding: 40px 30px;
        }
        .otp-box {  
            background: #f8f9fa;
            border-radius: 6px;
            padding: 20px;
            text-align: center;
            font-size: 32px;
            letter-spacing: 8px;
            font-weight: 600;
            margin: 30px 0;
            border-left: 4px solid #2c5282;
        }
        .footer {
            background: #f8f9fa;
            padding: 25px 30px;
            text-align: center;
            font-size: 14px;
            color: #718096; 
            border-top: 1px solid #e2e8f0;
        }
        @media (max-width: 600px) {
            .content {
                padding: 30px 20px;
            }
            .header {   
                padding: 25px 15px;
            }
            .header h1 {
                font-size: 22px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔐 Password Reset OTP</h1>
        </div>
        <div class="content">
            <p>Dear ${user.firstName} ${user.lastName},</p>
            <p>We received a request to reset your password for your <strong>Property Inspector Pro</strong> account. Use the One-Time Password (OTP) below to proceed with resetting your password. If you didn't make this request, you can safely ignore this email.</p>
            <div class="otp-box">${otp}</div>
            <p>This OTP will expire in 1 hour.</p>
    `;

    // Send the email
    await sendMail({
      to: user.email,
      subject: "🔐 Password Reset OTP - Property Inspector Pro",
      html: emailHtml,
    });
  }

  return;
}

/**
 * Reset user password
 *
 * @param {{email: string, token: string, newPassword: string}} payload
 * @returns {Promise<void>}
 */
async function resetUserPassword(payload) {
  // Destructure payload
  const { email, otp, token, newPassword } = payload;

  // Cases supported:
  // 1. Web token flow: provide `email` + `token` + `newPassword`
  // 2. Direct OTP flow: provide `email` + `otp` + `newPassword`
  // 3. Mobile verified flow: after calling verifyOtp, provide `email` + `newPassword`

  if (token) {
    const user = await UserModel.findOne({ email, resetToken: token });

    // Validate token and expiry
    if (!user) {
      const err = new Error("Invalid or expired reset token");
      err.status = 400;
      err.code = "INVALID_RESET_TOKEN";
      throw err;
    }

    // Check expiry
    if (!user.resetTokenExpiry || Date.now() > user.resetTokenExpiry) {
      const err = new Error("Reset token has expired");
      err.status = 400;
      err.code = "RESET_TOKEN_EXPIRED";
      throw err;
    }

    // Update password
    const hashed = await hashPassword(newPassword);

    user.password = hashed;
    user.resetToken = null;
    user.resetTokenExpiry = null;
    user.resetPasswordOTP = null;
    user.resetPasswordOTPExpiry = null;
    user.resetPasswordVerified = null;
    user.resetPasswordVerifiedExpiry = null;

    await user.save();
    return;
  }

  if (otp) {
    const user = await UserModel.findOne({ email, resetPasswordOTP: otp });

    // Validate OTP and expiry
    if (!user) {
      const err = new Error("Invalid or expired OTP");
      err.status = 400;
      err.code = "INVALID_OTP";
      throw err;
    }

    // Check expiry
    if (
      !user.resetPasswordOTPExpiry ||
      Date.now() > user.resetPasswordOTPExpiry
    ) {
      const err = new Error("OTP has expired");
      err.status = 400;
      err.code = "OTP_EXPIRED";
      throw err;
    }

    // Update password
    const hashed = await hashPassword(newPassword);

    user.password = hashed;
    user.resetPasswordOTP = null;
    user.resetPasswordOTPExpiry = null;
    user.resetPasswordVerified = null;
    user.resetPasswordVerifiedExpiry = null;

    await user.save();
    return;
  }

  // Mobile verified flow: email + newPassword, but only allowed if user has
  // `resetPasswordVerified` flag set and not expired.
  const user = await UserModel.findOne({ email });
  if (!user || !user.resetPasswordVerified) {
    const err = new Error("Either reset token or OTP must be provided");
    err.status = 400;
    err.code = "MISSING_RESET_CREDENTIALS";
    throw err;
  }

  // Check expiry of verified flag
  if (
    !user.resetPasswordVerifiedExpiry ||
    Date.now() > user.resetPasswordVerifiedExpiry
  ) {
    const err = new Error("OTP verification has expired");
    err.status = 400;
    err.code = "VERIFICATION_EXPIRED";
    throw err;
  }

  // Update password
  const hashed = await hashPassword(newPassword);

  user.password = hashed;
  user.resetPasswordVerified = null;
  user.resetPasswordVerifiedExpiry = null;
  // ensure any lingering OTP fields are cleared
  user.resetPasswordOTP = null;
  user.resetPasswordOTPExpiry = null;

  await user.save();
  return;
}

/**
 * Change user password
 *
 * @param {{userId: string, currentPassword: string, newPassword: string}} payload
 * @returns {Promise<void>}
 */
async function changeUserPassword(userId, payload) {
  // Destructure payload
  const { currentPassword, newPassword } = payload;

  // Find user by ID
  const user = await UserModel.findById(userId);

  // If user not found, throw error
  if (!user) {
    const err = new Error("User not found");
    err.status = 404;
    err.code = "USER_NOT_FOUND";
    throw err;
  }

  // Compare current password
  const match = await comparePassword(currentPassword, user.password);

  // If passwords do not match, throw error
  if (!match) {
    const err = new Error("Current password is incorrect");
    err.status = 400;
    err.code = "INCORRECT_CURRENT_PASSWORD";
    throw err;
  }

  // Old password cannot be the same as new password
  if (currentPassword === newPassword) {
    const err = new Error(
      "New password must be different from current password",
    );
    err.status = 400;
    err.code = "SAME_PASSWORD";
    throw err;
  }

  // Update password
  const hashed = await hashPassword(newPassword);
  user.password = hashed;

  await user.save();
  return;
}

/**
 * Verify OTP (mobile flow)
 *
 * @param {{email: string, otp: string}} payload
 * @returns {Promise<void>}
 */
async function verifyOtp(payload) {
  // Destructure payload
  const { email, otp } = payload;

  // Find user by email
  const user = await UserModel.findOne({ email });

  const err = new Error("Invalid or expired OTP");
  err.status = 400;

  if (!user) {
    throw err;
  }

  // Expecting OTP fields to be stored as `resetOtp` and `resetOtpExpiry`
  if (!user.resetPasswordOTP || !user.resetPasswordOTPExpiry) {
    throw err;
  }

  // Check OTP match and expiry
  if (String(user.resetPasswordOTP) !== String(otp)) {
    throw err;
  }

  // Check expiry
  if (new Date(user.resetPasswordOTPExpiry) < new Date()) {
    throw err;
  }

  // Mark the account as verified for a short window where the mobile client
  // can submit the new password. We keep this separate from the OTP fields
  // so the client first calls verify-otp, then calls reset-mobile-password
  // with `email` + `newPassword`.
  user.resetPasswordVerified = true;
  user.resetPasswordVerifiedExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

  // Clear the OTP to prevent replay
  user.resetPasswordOTP = null;
  user.resetPasswordOTPExpiry = null;
  await user.save();

  return;
}

module.exports = {
  registerUser,
  loginUser,
  initiateForgotPassword,
  resetUserPassword,
  changeUserPassword,
  verifyOtp,
};
