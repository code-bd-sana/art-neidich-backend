const mongoose = require("mongoose");

const UserModel = require("../models/UserModel");
const { sendMail } = require("../utils/mailer");

/**
 * Get user profile
 *
 * @param {string} userId
 * @returns {Promise<Object>}
 */
async function getProfile(userId) {
  const result = await UserModel.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(userId),
      },
    },
    {
      $project: {
        password: 0, // remove password
      },
    },
    {
      $addFields: {
        role: {
          $switch: {
            branches: [
              { case: { $eq: ["$role", 0] }, then: "Super Admin" },
              { case: { $eq: ["$role", 1] }, then: "Admin" },
              { case: { $eq: ["$role", 2] }, then: "Inspector" },
            ],
            default: "Unknown",
          },
        },
      },
    },
  ]);

  return result[0] || null;
}

/**
 * Update user profile (role is NOT updatable)
 *
 * @param {string} userId
 * @param {Object} updateData
 * @returns {Promise<Object>}
 */
async function updateProfile(userId, updateData) {
  const result = await UserModel.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(userId),
      },
    },
    {
      $set: updateData,
    },
    {
      $addFields: {
        role: {
          $switch: {
            branches: [
              { case: { $eq: ["$role", 0] }, then: "Super Admin" },
              { case: { $eq: ["$role", 1] }, then: "Admin" },
              { case: { $eq: ["$role", 2] }, then: "Inspector" },
            ],
            default: "Unknown",
          },
        },
      },
    },
    {
      $project: {
        password: 0,
      },
    },
  ]);

  if (result.length === 0) {
    const err = new Error("User not found");
    err.status = 404;
    err.code = "USER_NOT_FOUND";
    throw err;
  }

  return result[0] || null;
}

/**
 * Retrieves a paginated list of users with optional search filtering.
 *
 * Supports searching by first name, last name, email, or user ID.
 * Returns both the user list and pagination metadata.
 *
 * @param {Object} query - Query parameters for filtering and pagination
 * @param {number} [query.page=1] - Page number for pagination
 * @param {number} [query.limit=10] - Number of users per page
 * @param {string} [query.search] - Search keyword to filter users
 * @returns {Promise<{
 *   users: Array<Object>,
 *   metaData: {
 *     page: number,
 *     limit: number,
 *     totalUser: number,
 *     totalPage: number
 *   }
 * }>}
 */
async function getUsers(query = {}) {
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 10;
  const skip = (page - 1) * limit;
  const search = query.search?.trim();
  const role = query.role !== undefined ? Number(query.role) : undefined;

  const pipeline = [];

  // Filter by role if provided
  if (role !== undefined) {
    pipeline.push({ $match: { role: role } });
  }

  // Search filter if provided
  if (search) {
    const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const searchMatch = {
      $match: {
        $or: [
          { firstName: { $regex: escapedSearch, $options: "i" } },
          { lastName: { $regex: escapedSearch, $options: "i" } },
          { email: { $regex: escapedSearch, $options: "i" } },
          { userId: { $regex: escapedSearch, $options: "i" } },
        ],
      },
    };

    // If we already have a role match, we need to combine with $and
    if (pipeline.length > 0 && pipeline[pipeline.length - 1].$match) {
      const existingMatch = pipeline[pipeline.length - 1].$match;
      pipeline[pipeline.length - 1] = {
        $match: {
          $and: [existingMatch, searchMatch.$match],
        },
      };
    } else {
      pipeline.push(searchMatch);
    }
  }

  // Add role label while preserving original role value
  pipeline.push({
    $addFields: {
      roleLabel: {
        $switch: {
          branches: [
            { case: { $eq: ["$role", 0] }, then: "Super Admin" },
            { case: { $eq: ["$role", 1] }, then: "Admin" },
            { case: { $eq: ["$role", 2] }, then: "Inspector" },
          ],
          default: "Unknown",
        },
      },
    },
  });

  // Facet for pagination and counting
  pipeline.push({
    $facet: {
      users: [
        { $skip: skip },
        { $limit: limit },
        {
          $project: {
            password: 0,
            resetToken: 0,
            resetTokenExpiry: 0,
          },
        },
      ],
      metaData: [{ $count: "totalUser" }],
    },
  });

  const result = await UserModel.aggregate(pipeline);

  const users = result[0]?.users || [];
  const totalUser = result[0]?.metaData[0]?.totalUser || 0;

  return {
    users,
    metaData: {
      page,
      limit,
      totalUser,
      totalPage: Math.ceil(totalUser / limit),
    },
  };
}

/**
 * Get user by ID
 *
 * @param {string} userId
 * @returns {Promise<Object>}
 */
async function getUserById(userId) {
  const result = await UserModel.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(userId),
      },
    },
    {
      $addFields: {
        role: {
          $switch: {
            branches: [
              { case: { $eq: ["$role", 0] }, then: "Super Admin" },
              { case: { $eq: ["$role", 1] }, then: "Admin" },
              { case: { $eq: ["$role", 2] }, then: "Inspector" },
            ],
            default: "Unknown",
          },
        },
      },
    },
    {
      $project: {
        password: 0,
        resetToken: 0,
        resetTokenExpiry: 0,
      },
    },
  ]);

  if (!result || result.length === 0) {
    const err = new Error("User not found");
    err.status = 404;
    err.code = "USER_NOT_FOUND";
    throw err;
  }

  return result[0] || null;
}

/**
 * Approve user account
 *
 * @param {string} userId
 * @returns {Promise<Object>}
 */
async function approveUser(userId) {
  const user = await UserModel.findById(userId);

  if (!user) {
    const err = new Error("User not found");
    err.status = 404;
    err.code = "USER_NOT_FOUND";
    throw err;
  }

  // Update user approval status
  user.isApproved = true;
  await user.save();

  // Email template for real estate admin/inspector approval notification
  const emailHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Account Approved</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            background-color: #f4f4f4;    
            margin: 0;
            padding: 0;
        }
        .container {
            max-width: 600px;
            margin: 30px auto;
            background-color: #ffffff;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
        .header {
            text-align: center;
            padding-bottom: 20px;
            border-bottom: 1px solid #e2e8f0;
        }
        .header h1 {
            margin: 0;
            color: #2c5282;
        }
        .content {  
            padding: 20px 0;
        }
        .content h2 {
            color: #2c5282;
        }
        .content p {
            font-size: 16px;
            line-height: 1.5;
            color: #4a5568;
        }
        .footer {
            text-align: center;
            padding-top: 20px;
            border-top: 1px solid #e2e8f0;
            font-size: 14px;
            color: #a0aec0;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Property Inspector Pro</h1>
        </div>
        <div class="content">
            <h2>🎉 Your Account Has Been Approved!</h2>
            <p>Dear User, ${user.firstName + " " + user.lastName}</p>
            <p>We are excited to inform you that your account has been approved. You can now log in and start using our services.</p>
            <p><strong>Login Here:</strong> <a href="${
              process.env.FRONTEND_URL
            }/login">${process.env.FRONTEND_URL}/login</a></p>
            <p>If you have any questions or need assistance, feel free to contact our support team.</p>
        </div>
        <div class="footer">
            <p>Thank you for choosing Property Inspector Pro!</p>
        </div>
    </div>
</body>
</html>
`;

  // Send approval email
  await sendMail({
    to: user.email,
    subject: "Your Account Has Been Approved!",
    html: emailHtml,
  });

  return;
}

/**
 * Suspend user account
 *
 * @param {string} userId
 * @param {Object} currentUser
 * @returns {Promise<Object>}
 */
async function suspendUser(userId, currentUser) {
  const user = await UserModel.findById(userId);
  if (user.role === 0) {
    const err = new Error("Cannot suspend a root user");
    err.status = 400;
    err.code = "CANNOT_SUSPEND_ROOT";
    throw err;
  }
  if (user.role === currentUser.role) {
    const err = new Error("Cannot suspend a user with same role as yours");
    err.status = 400;
    err.code = "CANNOT_SUSPEND_SAME_ROLE";
    throw err;
  }

  // Update user suspension status
  user.isSuspended = true;
  await user.save();

  // Email template for account suspension notification
  const emailHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Account Suspended</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            background-color: #f4f4f4;    
            margin: 0;
            padding: 0;
        }
        .container {
            max-width: 600px;
            margin: 30px auto;
            background-color: #ffffff;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
        .header {
            text-align: center;
            padding-bottom: 20px;
            border-bottom: 1px solid #e2e8f0;
        }
        .header h1 {
            margin: 0;
            color: #e53e3e;
        }
        .content {  
            padding: 20px 0;
        }
        .content h2 {
            color: #e53e3e;
        }
        .content p {
            font-size: 16px;
            line-height: 1.5;
            color: #4a5568;
        }
        .footer {
            text-align: center;
            padding-top: 20px;
            border-top: 1px solid #e2e8f0;
            font-size: 14px;
            color: #a0aec0;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">  
            <h1>Property Inspector Pro</h1>
        </div>
        <div class="content">
            <h2>⚠️ Your Account Has Been Suspended</h2>
            <p>Dear User, ${user.firstName + " " + user.lastName}</p>
            <p>We regret to inform you that your account has been suspended. If you believe this is a mistake or have any questions, please contact our support team for assistance.</p>
        </div>
        <div class="footer">
            <p>Thank you for your understanding.</p>
        </div>
    </div>
</body>
</html>
`;

  // Send suspension email
  await sendMail({
    to: user.email,
    subject: "Your Account Has Been Suspended",
    html: emailHtml,
  });

  return;
}

/**
 * Un-suspend user account
 *
 * @param {string} userId
 * @param {Object} currentUser
 * @returns {Promise<Object>}
 */
async function unSuspendUser(userId, currentUser) {
  const user = await UserModel.findById(userId);
  if (user.role === 0) {
    const err = new Error("Cannot un-suspend a root user");
    err.status = 400;
    err.code = "CANNOT_UNSUSPEND_ROOT";
    throw err;
  }
  if (user.role === currentUser.role) {
    const err = new Error("Cannot un-suspend a user with same role as yours");
    err.status = 400;
    err.code = "CANNOT_UNSUSPEND_SAME_ROLE";
    throw err;
  }

  // Update user suspension status
  user.isSuspended = false;
  user.save();

  // Email template for account un-suspension notification
  const emailHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Account Reinstated</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            background-color: #f4f4f4;    
            margin: 0;
            padding: 0;
        }
        .container {
            max-width: 600px;
            margin: 30px auto;
            background-color: #ffffff;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
        .header {
            text-align: center;
            padding-bottom: 20px;
            border-bottom: 1px solid #e2e8f0;
        }
        .header h1 {
            margin: 0;
            color: #38a169;
        }
        .content {  
            padding: 20px 0;
        }
        .content h2 {
            color: #38a169;
        }
        .content p {
            font-size: 16px;
            line-height: 1.5;
            color: #4a5568;
        }
        .footer {
            text-align: center;
            padding-top: 20px;
            border-top: 1px solid #e2e8f0;
            font-size: 14px;
            color: #a0aec0;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Property Inspector Pro</h1>
        </div>
        <div class="content">
            <h2>✅ Your Account Has Been Reinstated!</h2>
            <p>Dear User, ${user.firstName + " " + user.lastName}</p>
            <p>We are pleased to inform you that your account has been reinstated. You can now log in and continue using our services.</p>
        </div>
        <div class="footer">
            <p>Thank you for being a valued member of Property Inspector Pro.</p>
        </div>
    </div>
</body>
</html>
`;

  // Send un-suspension email
  await sendMail({
    to: user.email,
    subject: "Your Account Has Been Reinstated",
    html: emailHtml,
  });

  return;
}

/**
 * Delete user account
 *
 * @param {string} userId
 * @returns {Promise<void>}
 */
async function deleteUser(userId, currentUser) {
  const user = await UserModel.findById(userId);
  if (user.role === 0) {
    const err = new Error("Cannot delete a root user");
    err.status = 400;
    err.code = "CANNOT_DELETE_ROOT";
    throw err;
  }
  if (user.role === currentUser.role) {
    const err = new Error("Cannot delete a user with same role as yours");
    err.status = 400;
    err.code = "CANNOT_DELETE_SAME_ROLE";
    throw err;
  }
  await UserModel.findByIdAndDelete(userId);

  // Email template for account deletion notification
  const emailHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Account Deleted</title>
    <style>
        body {
            font-family: Arial, sans-serif; 
            background-color: #f4f4f4;
            margin: 0;
            padding: 0;
        }
        .container {
            max-width: 600px;
            margin: 30px auto;
            background-color: #ffffff;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
        .header {
            text-align: center;
            padding-bottom: 20px;
            border-bottom: 1px solid #e2e8f0;
        }
        .header h1 {
            margin: 0;
            color: #e53e3e;
        }
        .content {
            padding: 20px 0;
        }
        .content h2 {
            color: #e53e3e;
        }
        .content p {
            font-size: 16px;  
            line-height: 1.5;
            color: #4a5568;
        }
        .footer {
            text-align: center;
            padding-top: 20px;
            border-top: 1px solid #e2e8f0;
            font-size: 14px;
            color: #a0aec0;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Property Inspector Pro</h1>
        </div>
        <div class="content">
            <h2>⚠️ Your Account Has Been Deleted</h2>
            <p>Dear User, ${user.firstName + " " + user.lastName}</p>
            <p>We regret to inform you that your account has been deleted from our system. If you believe this is a mistake or have any questions, please contact our support team for assistance.</p>
        </div>
        <div class="footer">
            <p>Thank you for your understanding.</p>
        </div>
    </div>
</body>
</html>
`;

  // Send deletion email
  await sendMail({
    to: user.email,
    subject: "Your Account Has Been Deleted",
    html: emailHtml,
  });

  return;
}

module.exports = {
  getProfile,
  updateProfile,
  getUsers,
  getUserById,
  approveUser,
  suspendUser,
  unSuspendUser,
  deleteUser,
};
