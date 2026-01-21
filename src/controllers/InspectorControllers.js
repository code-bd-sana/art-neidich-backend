const mongoose = require("mongoose");

const { inspectorOverview } = require("../services/InspectorServices");

/**
 * Handle inspector overview
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function overview(req, res, next) {
  try {
    const inspector = new mongoose.Types.ObjectId(req.user?._id);

    const result = await inspectorOverview(inspector);
    return res.status(200).json({
      success: true,
      message: "Inspector overview retrieved successfully",
      code: 200,
      data: result,
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  inspectorOverview: overview,
};
