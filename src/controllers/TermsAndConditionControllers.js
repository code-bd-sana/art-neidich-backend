const mongoose = require("mongoose");

const {
  createTermsAndCondition,
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

module.exports = {
  createTermsAndConditionController,
};
