const PrivacyAndPolicy = require("../models/PrivacyAndPolicyModel");

/**
 * Create a new privacy and policy version
 *
 * @param {Object} payload - The data for the new privacy and policy
 * @returns {Promise<Object>} The created privacy and policy document
 */
async function createPrivacyAndPolicy(payload) {
  // Deactivate existing active policies
  await PrivacyAndPolicy.updateMany({ isActive: true }, { isActive: false });

  // Create new privacy and policy
  const newPolicy = new PrivacyAndPolicy({
    title: payload.title,
    version: payload.version,
    content: payload.content,
    effectiveDate: payload.effectiveDate,
    isActive: payload.isActive !== undefined ? payload.isActive : true, // Default to active if not specified
  });

  return await newPolicy.save();
}

/**
 * Get the currently active privacy and policy
 *
 * @returns {Promise<Object|null>} The active privacy and policy document or null if none found
 */
async function getActivePrivacyAndPolicy() {
  const activePolicy = await PrivacyAndPolicy.findOne({
    $or: [
      { effectiveDate: { $exists: false } },
      { effectiveDate: { $gte: new Date() } },
    ],
  }).sort({ createdAt: -1 });

  if (!activePolicy) {
    return await PrivacyAndPolicy.findOne().sort({ createdAt: -1 });
  }

  return activePolicy;
}

/**
 * Get all privacy and policy with pagination and optional version filter
 *
 * @param {Object} query - Pagination and filter options
 * @returns {Promise<Object>} Paginated list of privacy and policy documents
 */
async function getAllPrivacyAndPolicy(query = {}) {
  const page = Math.max(Number(query.page) || 1, 1);
  const limit = Math.max(Number(query.limit) || 10, 1);
  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    PrivacyAndPolicy.find().sort({ createdAt: -1 }).skip(skip).limit(limit),
    PrivacyAndPolicy.countDocuments(),
  ]);

  return {
    data,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * Get privacy and policy by ID
 *
 * @param {string} id - The policy ID
 * @returns {Promise<Object|null>} The privacy and policy document or null
 */
async function getPrivacyAndPolicyById(id) {
  return PrivacyAndPolicy.findById(id);
}

/**
 * Update privacy and policy by ID
 *
 * @param {string} id - The policy ID
 * @param {Object} payload - The update data
 * @returns {Promise<Object|null>} The updated document or null
 */
async function updatePrivacyAndPolicy(id, payload) {
  const existingPolicy = await PrivacyAndPolicy.findById(id);
  if (!existingPolicy) {
    const err = new Error("Privacy and policy not found");
    err.status = 404;
    err.code = "PRIVACY_POLICY_NOT_FOUND";
    throw err;
  }
  existingPolicy.title = payload.title || existingPolicy.title;
  existingPolicy.content = payload.content || existingPolicy.content;
  existingPolicy.version = payload.version || existingPolicy.version;
  existingPolicy.effectiveDate =
    payload.effectiveDate || existingPolicy.effectiveDate;
  existingPolicy.isActive =
    payload.isActive !== undefined ? payload.isActive : existingPolicy.isActive;
  if (payload.isActive) {
    // Deactivate all other active policies
    await PrivacyAndPolicy.updateMany({ isActive: true }, { isActive: false });
  }

  return await existingPolicy.save();
}

/**
 * Delete privacy and policy by ID
 *
 * @param {string} id - The policy ID
 * @returns {Promise<Object|null>} The deleted document or null
 */
async function deletePrivacyAndPolicy(id) {
  return PrivacyAndPolicy.findByIdAndDelete(id);
}

module.exports = {
  createPrivacyAndPolicy,
  getActivePrivacyAndPolicy,
  getAllPrivacyAndPolicy,
  getPrivacyAndPolicyById,
  updatePrivacyAndPolicy,
  deletePrivacyAndPolicy,
};
