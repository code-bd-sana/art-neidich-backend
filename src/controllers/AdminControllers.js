const { adminOverview } = require("../services/AdminServices");

/**
 * Handle admin overview
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function overview(req, res, next) {
  try {
    const payload = req.validated;
    const result = await adminOverview(payload);
    return res.status(201).json({
      success: true,
      message: "Admin overview retrieved successfully",
      code: 200,
      data: result,
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  adminOverview: overview,
};
