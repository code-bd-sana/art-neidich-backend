const mongoose = require("mongoose");

const { emailSupport } = require("../services/EmailServices");

/**
 * Handle email support
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function support(req, res, next) {
  try {
    const payload = req.validated;
    payload.inspector = req.user;
    const result = await emailSupport(payload);
    return res.status(200).json({
      success: true,
      message: "Support mail sent successfully",
      code: 200,
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  support,
};
