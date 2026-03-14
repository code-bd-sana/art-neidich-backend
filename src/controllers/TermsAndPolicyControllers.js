const mongoose = require("mongoose");

const {
  getInspectorAcknowledgement,
} = require("../services/TermsAndPolicyServices");

/**
 * Handle get active terms and condition
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function getInspectorAcknowledgementController(req, res, next) {
  try {
    const result = await getInspectorAcknowledgement();
    return res.status(200).json({
      success: true,
      message: "Inspector acknowledgement retrieved successfully",
      code: 200,
      data: result,
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  getInspectorAcknowledgementController,
};
