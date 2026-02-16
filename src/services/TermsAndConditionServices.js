const AcknowledgeModel = require("../models/AcknowledgeModel");
const TermsAndCondition = require("../models/TermsAndConditionModel");

/**
 * Create a new terms and condition version
 *
 * @param {Object} payload - The data for the new terms and condition
 * @returns {Promise<Object>} The created terms and condition document
 */
async function createTermsAndCondition(payload) {
  // Deactivate existing active terms
  await TermsAndCondition.updateMany({ isActive: true }, { isActive: false });

  // Create new terms and condition
  const newTerms = new TermsAndCondition({
    title: payload.title,
    version: payload.version,
    content: payload.content,
    effectiveDate: payload.effectiveDate,
    isActive: payload.isActive !== undefined ? payload.isActive : true, // Default to active if not specified
  });

  return await newTerms.save();
}

/**
 * Get the currently active terms and condition
 *
 * @returns {Promise<Object|null>} The active terms and condition document or null if none found
 */
async function getActiveTermsAndCondition() {
  const activeTerms = await TermsAndCondition.findOne({
    $or: [
      { effectiveDate: { $exists: false } }, // If effectiveDate is not set, consider it active
      { effectiveDate: { $gte: new Date() } }, // If effectiveDate is in the future, consider it active
    ],
  }).sort({
    createdAt: -1,
  });

  // If no active terms found, return the last created terms as fallback
  if (!activeTerms) {
    return await TermsAndCondition.findOne().sort({ createdAt: -1 });
  }
}

/**
 * Get terms and condition by ID
 *
 * @param {String} id - The ID of the terms and condition to retrieve
 * @returns {Promise<Object|null>} The terms and condition document or null if not found
 */
async function getTermsAndConditionById(id) {
  return await TermsAndCondition.findById(id);
}

/**
 * Update an existing terms and condition by ID
 *
 * @param {String} id - The ID of the terms and condition to update
 * @param {Object} payload - The data to update the terms and condition with
 * @returns {Promise<Object>} The updated terms and condition document
 */
async function updateTermsAndCondition(id, payload) {
  // Find the terms and condition by ID
  const terms = await TermsAndCondition.findById(id);

  // If not found, throw an error
  if (!terms) {
    const err = new Error("Terms and condition not found");
    err.status = 404;
    err.code = "TERMS_NOT_FOUND";
    throw err;
  }

  // If this version is in acknowledgment, prevent update
  const isExistingAcknowledgment = await AcknowledgeModel.exists({
    termsId: id,
  });

  if (isExistingAcknowledgment) {
    const err = new Error(
      "Cannot update terms and condition that has been acknowledged by users",
    );
    err.status = 400;
    err.code = "TERMS_ACKNOWLEDGED";
    throw err;
  }

  // Update the fields
  terms.title = payload.title || terms.title;
  terms.version = payload.version || terms.version;
  terms.content = payload.content || terms.content;
  terms.effectiveDate = payload.effectiveDate || terms.effectiveDate;
  terms.isActive =
    payload.isActive !== undefined ? payload.isActive : terms.isActive;

  // Save the updated terms and condition
  return await terms.save();
}

/**
 * Delete a terms and condition by ID
 *
 * @param {String} id - The ID of the terms and condition to delete
 * @returns {Promise<Object>} The result of the delete operation
 */
async function deleteTermsAndCondition(id) {
  // Find the terms and condition by ID
  const terms = await TermsAndCondition.findById(id);

  if (!terms) {
    const err = new Error("Terms and condition not found");
    err.status = 404;
    err.code = "TERMS_NOT_FOUND";
    throw err;
  }

  // If this version is in acknowledgment, prevent deletion
  const isExistingAcknowledgment = await AcknowledgeModel.exists({
    termsId: id,
  });
  if (isExistingAcknowledgment) {
    const err = new Error(
      "Cannot delete terms and condition that has been acknowledged by users",
    );
    err.status = 400;
    err.code = "TERMS_ACKNOWLEDGED";
    throw err;
  }

  // Delete the terms and condition
  return await TermsAndCondition.deleteOne({ _id: id });
}

module.exports = {
  createTermsAndCondition,
  getActiveTermsAndCondition,
  getTermsAndConditionById,
  updateTermsAndCondition,
  deleteTermsAndCondition,
};
