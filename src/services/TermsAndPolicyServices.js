const TermsModel = require("../models/TermsModel");
const UserTermsAcceptanceModel = require("../models/UserTermsAcceptanceModel");

/**
 * Create a new terms and policy version
 *
 * @param {Object} payload - The data for the new terms and policy
 * @returns {Promise<Object>} The created terms and policy document
 */
async function createTermsAndPolicy(payload) {
  // Get the latest version for the given type and increment it
  const lastVersion = await TermsModel.findOne({ type: payload.type }).sort({
    version: -1,
  });
  payload.version = lastVersion ? lastVersion.version + 1 : 1;

  // If the new version is set to active, deactivate all other versions of the same type
  return await TermsModel.create(payload);
}

/**
 * Activate a specific terms and policy version by ID
 *
 * @param {string} id - The ID of the terms and policy version to activate
 * @param {string} type - The type of the terms and policy (TERMS or PRIVACY)
 * @returns {Promise<Object>} The updated terms and policy document
 */
async function activeTermsAndPolicy(id, type) {
  // Deactivate all other versions of the same type
  await TermsModel.updateMany(
    { _id: { $ne: id }, type },
    { $set: { isActive: false } },
  );

  // Activate the specified version
  const updated = await TermsModel.findOneAndUpdate(
    { _id: id, type },
    { $set: { isActive: true } },
    { new: true },
  );

  if (!updated) {
    const err = new Error("Associated terms and policy not found");
    err.code = 404;
    throw err;
  }

  return updated;
}

/**
 * Get the currently active terms and policy for a given type
 *
 * @param {string} type - The type of the terms and policy (TERMS or PRIVACY)
 * @returns {Promise<Object>} The active terms and policy document
 */
async function getActiveTermsAndPolicy(type) {
  return await TermsModel.findOne({ type, isActive: true });
}

/**
 * Get a specific terms and policy version by ID
 *
 * @param {string} id - The ID of the terms and policy version to retrieve
 * @returns {Promise<Object>} The terms and policy document
 */
async function getTermsAndPolicyById(id) {
  const terms = await TermsModel.findById(id);
  if (!terms) {
    const err = new Error("Terms and policy not found");
    err.code = 404;
    throw err;
  }
  return terms;
}

/**
 * Get a paginated list of terms and policy versions, optionally filtered by type
 *
 * @param {Object} options - The options for retrieving terms and policies
 * @param {string} [options.type] - The type of terms and policy to filter by (TERMS or PRIVACY)
 * @param {Object} [options.query] - The query parameters for pagination (page, limit)
 * @returns {Promise<Object>} An object containing the list of terms and policies and pagination metadata
 */
async function getTermsAndPolicies({ type, query = {} }) {
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 10;
  const skip = (page - 1) * limit;

  if (type) {
    query.type = type;
  }

  const [total, data] = await Promise.all([
    TermsModel.countDocuments(query),
    TermsModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
  ]);

  return {
    termsPolicies: data,
    metaData: {
      page,
      limit,
      totalTermsPolicies: total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * Update a specific terms and policy version by ID
 *
 * @param {string} id - The ID of the terms and policy version to update
 * @param {Object} payload - The data to update the terms and policy with
 * @return {Promise<Object>} The updated terms and policy document
 */
async function updateTermsAndPolicy(id, payload) {
  const updated = await TermsModel.findByIdAndUpdate(id, payload, {
    new: true,
  });
  if (!updated) {
    const err = new Error("Terms and policy not found");
    err.code = 404;
    throw err;
  }
  return updated;
}

/**
 * Get the acceptance status of the currently active terms and policy for a specific user
 *
 * @param {string} userId - The ID of the user to check acceptance status for
 * @returns {Promise<Array>} An array of objects containing the type, latest version, accepted version, and acceptance status for each active terms and policy
 */
async function getMyAcceptedTermsAndPolicyStatus(userId) {
  // Get all active terms/policies
  const activeTermsPolicies = await TermsModel.find({ isActive: true })
    .select("type version")
    .lean();

  if (!activeTermsPolicies.length) return [];

  // Get all user acceptances for those types in ONE query
  const types = activeTermsPolicies.map((tp) => tp.type);

  const userAcceptances = await UserTermsAcceptanceModel.find({
    userId,
    termsType: { $in: types },
  })
    .select("termsType acceptedVersion")
    .lean();

  // Convert acceptances to Map for easy lookup
  const acceptanceMap = new Map();
  userAcceptances.forEach((acc) => {
    acceptanceMap.set(acc.termsType, acc.acceptedVersion);
  });

  // Build response
  return activeTermsPolicies.map((tp) => {
    const acceptedVersion = acceptanceMap.get(tp.type) ?? null;

    return {
      type: tp.type,
      latestVersion: tp.version,
      acceptedVersion,
      accepted: acceptedVersion === tp.version,
    };
  });
}

module.exports = {
  createTermsAndPolicy,
  activeTermsAndPolicy,
  getActiveTermsAndPolicy,
  getTermsAndPolicyById,
  getTermsAndPolicies,
  updateTermsAndPolicy,
  getMyAcceptedTermsAndPolicyStatus,
};
