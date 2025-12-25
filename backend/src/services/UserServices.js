const UserModel = require("../models/UserModel");

/**
 * Get user profile
 *
 * @param {string} userId
 * @returns {Promise<Object>}
 */
async function getProfile(userId) {
  return UserModel.findById(userId);
}

/**
 * Update user profile
 *
 * @param {string} userId
 * @param {Object} updateData
 * @returns {Promise<Object>}
 */
async function updateProfile(userId, updateData) {
  return UserModel.findByIdAndUpdate(userId, updateData, { new: true });
}

/**
 * Get all users with optional filters
 *
 * @param {Object} query
 * @returns {Promise<Array>}
 */
async function getUsers(query) {
  const { page = 1, limit = 10, ...filters } = query;
  return UserModel.find(filters)
    .skip((page - 1) * limit)
    .limit(limit);
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
  return UserModel.findByIdAndUpdate(
    userId,
    { isApproved: true },
    { new: true }
  );
}

/**
 * Suspend user account
 *
 * @param {string} userId
 * @returns {Promise<Object>}
 */
async function suspendUser(userId) {
  return UserModel.findByIdAndUpdate(
    userId,
    { isSuspended: true },
    { new: true }
  );
}

/**
 * Un-suspend user account
 *
 * @param {string} userId
 * @returns {Promise<Object>}
 */
async function unSuspendUser(userId) {
  return UserModel.findByIdAndUpdate(
    userId,
    { isSuspended: false },
    { new: true }
  );
}

/**
 * Delete user account
 *
 * @param {string} userId
 * @returns {Promise<void>}
 */
async function deleteUser(userId) {
  await UserModel.findByIdAndDelete(userId);
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
