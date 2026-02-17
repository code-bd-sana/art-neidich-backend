const mongoose = require("mongoose");

const {
  createTermsAndPolicy,
  getActiveTermsAndPolicy,
  getTermsAndPolicyById,
  getTermsAndPolicies,
  updateTermsAndPolicy,
  getMyAcceptedTermsAndPolicyStatus,
} = require("../services/TermsAndPolicyServices");

/**
 * Handle create terms and policies
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function createTermsAndPolicyController(req, res, next) {
  try {
    // Get validated payload
    const payload = req.validated;

    // Call service
    const result = await createTermsAndPolicy(payload);

    return res.status(200).json({
      success: true,
      message: "Terms and policy created successfully",
      code: 200,
      data: result,
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * Handle get active terms and condition
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function getActiveTermsAndConditionController(req, res, next) {
  try {
    const result = await getActiveTermsAndPolicy("TERMS");
    return res.status(200).json({
      success: true,
      message: "Active terms and condition retrieved successfully",
      code: 200,
      data: result,
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * Handle get active privacy policy
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function getActivePrivacyPolicyController(req, res, next) {
  try {
    const result = await getActiveTermsAndPolicy("PRIVACY");
    return res.status(200).json({
      success: true,
      message: "Active privacy policy retrieved successfully",
      code: 200,
      data: result,
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * Handle get terms and policy by id
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function getTermsAndConditionByIdController(req, res, next) {
  try {
    const { id } = req.params;
    const result = await getTermsAndPolicyById(id);
    return res.status(200).json({
      success: true,
      message: "Terms and policy retrieved successfully",
      code: 200,
      data: result,
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * Handle get all terms and policies with pagination and filtering
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function getAllTermsAndConditionController(req, res, next) {
  try {
    // Get validated query
    const query = req.validated;

    const { termsPolicies, metaData } = await getTermsAndPolicies(query);

    return res.status(200).json({
      success: true,
      message: "All terms and policies retrieved successfully",
      code: 200,
      data: termsPolicies,
      metaData,
    });
  } catch (err) {
    return next(err);
  }
}

async function updateTermsAndPolicyController(req, res, next) {
  try {
    const { id } = req.params;
    const payload = req.validated;
    const result = await updateTermsAndPolicy(id, payload);
    return res.status(200).json({
      success: true,
      message: "Terms and policy updated successfully",
      code: 200,
      data: result,
    });
  } catch (err) {
    return next(err);
  }
}

async function getMyTermsAndPolicyStatusController(req, res, next) {
  try {
    const userId = req.user._id;
    const result = await getMyAcceptedTermsAndPolicyStatus(userId);
    return res.status(200).json({
      success: true,
      message: "User's accepted terms and policy status retrieved successfully",
      code: 200,
      data: result,
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  createTermsAndPolicyController,
  getActiveTermsAndConditionController,
  getActivePrivacyPolicyController,
  getTermsAndConditionByIdController,
  getAllTermsAndConditionController,
  updateTermsAndPolicyController,
  getMyTermsAndPolicyStatusController,
};
