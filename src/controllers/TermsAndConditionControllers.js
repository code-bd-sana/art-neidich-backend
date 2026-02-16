const mongoose = require("mongoose");

const {
  createTermsAndCondition,
  getActiveTermsAndCondition,
  getTermsAndConditionById,
  updateTermsAndCondition,
  deleteTermsAndCondition,
  getAllTermsAndCondition,
} = require("../services/TermsAndConditionServices");

/**
 * Handle create terms and condition
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function createTermsAndConditionController(req, res, next) {
  try {
    // Get validated payload
    const payload = req.validated;

    // Call service
    const result = await createTermsAndCondition(payload);

    return res.status(200).json({
      success: true,
      message: "Terms and condition created successfully",
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
    const result = await getActiveTermsAndCondition();
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
 * Handle get all terms and condition with pagination
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function getAllTermsAndConditionController(req, res, next) {
  try {
    // Get validated query
    const query = req.validated;

    const { totalTerms, metaData } = await getAllTermsAndCondition(query);
    return res.status(200).json({
      success: true,
      code: 200,
      message: "Terms and conditions retrieved successfully",
      data: totalTerms,
      metaData,
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * Handle get terms and condition by ID
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function getTermsAndConditionByIdController(req, res, next) {
  try {
    const { id } = req.params;
    const result = await getTermsAndConditionById(id);
    if (!result) {
      return res.status(404).json({
        success: false,
        message: "Terms and condition not found",
        code: 404,
      });
    }
    return res.status(200).json({
      success: true,
      message: "Terms and condition retrieved successfully",
      code: 200,
      data: result,
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * Handle update terms and condition by ID
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function updateTermsAndConditionController(req, res, next) {
  try {
    const { id } = req.params;
    const payload = req.validated;

    const result = await updateTermsAndCondition(id, payload);
    return res.status(200).json({
      success: true,
      message: "Terms and condition updated successfully",
      code: 200,
      data: result,
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * Handle delete terms and condition by ID
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function deleteTermsAndConditionController(req, res, next) {
  try {
    const { id } = req.params;
    const result = await deleteTermsAndCondition(id);
    if (!result) {
      return res.status(404).json({
        success: false,
        message: "Terms and condition not found",
        code: 404,
      });
    }
    return res.status(200).json({
      success: true,
      message: "Terms and condition deleted successfully",
      code: 200,
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  createTermsAndConditionController,
  getActiveTermsAndConditionController,
  getTermsAndConditionByIdController,
  updateTermsAndConditionController,
  deleteTermsAndConditionController,
  getAllTermsAndConditionController,
};
