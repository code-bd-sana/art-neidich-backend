const mongoose = require("mongoose");

const UserModel = require("../models/UserModel");

/**
 * Get user profile
 *
 * @param {string} userId
 * @returns {Promise<Object>}
 */
async function getProfile(userId) {
  return UserModel.findById(userId).select("-password");
}

/**
 * Update user profile
 *
 * @param {string} userId
 * @param {Object} updateData
 * @returns {Promise<Object>}
 */
async function updateProfile(userId, updateData) {
  return UserModel.findByIdAndUpdate(userId, updateData, { new: true }).select(
    "-password"
  );
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
 *
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
async function getUsers(query) {
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 10;
  const skip = (page - 1) * limit;
  const search = query.search?.trim();

  const result = await UserModel.aggregate([
    ...(search
      ? [
          {
            $match: {
              $or: [
                { firstName: { $regex: search, $options: "i" } },
                { lastName: { $regex: search, $options: "i" } },
                { email: { $regex: search, $options: "i" } },
                { userId: { $regex: search, $options: "i" } },
              ],
            },
          },
        ]
      : []),

    // Replace role value with label
    {
      $addFields: {
        role: {
          $switch: {
            branches: [
              { case: { $eq: ["$role", "0"] }, then: "Super Admin" },
              { case: { $eq: ["$role", "1"] }, then: "Admin" },
              { case: { $eq: ["$role", "2"] }, then: "Inspector" },
            ],
            default: "Unknown",
          },
        },
      },
    },

    {
      $facet: {
        users: [
          { $skip: skip },
          { $limit: limit },
          { $project: { password: 0 } },
        ],
        metaData: [{ $count: "totalUser" }],
      },
    },
  ]);

  const users = result[0].users;
  const totalUser = result[0].metaData[0]?.totalUser || 0;

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
  return UserModel.findById(userId);
}

/**
 * Approve user account
 *
 * @param {string} userId
 * @returns {Promise<Object>}
 */
async function approveUser(userId) {
  return UserModel.findAndUpdate(
    {
      _id: new mongoose.Types.ObjectId(userId),
      // can't be role = 0 (root)
      role: { $ne: 0 },
    },
    { isApproved: true },
    { new: true }
  ).select("-password");
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
  user.isSuspended = true;
  return user.save();
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

  user.isSuspended = false;
  return user.save();
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
