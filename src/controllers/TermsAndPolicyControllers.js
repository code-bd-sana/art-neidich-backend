const mongoose = require("mongoose");

const { createTermsAndPolicy } = require("../services/TermsAndPolicyServices");

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

module.exports = {
  createTermsAndPolicyController,
};
