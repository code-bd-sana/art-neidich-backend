const mongoose = require("mongoose");

const {
  createImageLabel,
  getImageLabels,
  getImageLabel,
  updateImageLabel,
  deleteImageLabel,
} = require("../services/ImageLabelServices");

/**
 * Create a new image label
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function createImageLabelController(req, res, next) {
  try {
    // Get validated payload
    const payload = req.validated;

    // Attach createdBy and lastUpdatedBy
    payload.createdBy = new mongoose.Types.ObjectId(req.user?._id);
    payload.lastUpdatedBy = new mongoose.Types.ObjectId(req.user?._id);

    // Call service
    const label = await createImageLabel(payload);
    return res.status(201).json({
      success: true,
      message: "Image label created successfully",
      data: label,
      code: 201,
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * Get list of image labels
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function getImageLabelsController(req, res, next) {
  try {
    // Call service
    const { labels, metaData } = await getImageLabels(req.query);

    return res.status(200).json({
      success: true,
      message: "Image labels fetched successfully",
      data: labels,
      metaData: metaData,
      code: 200,
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * Get single image label by id
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function getImageLabelController(req, res, next) {
  try {
    // Call service
    const label = await getImageLabel(req.params.id);

    return res.status(200).json({
      success: true,
      message: "Image label fetched successfully",
      data: label,
      code: 200,
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * Update image label
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function updateImageLabelController(req, res, next) {
  try {
    // Get validated payload
    const payload = req.validated;

    // Attach lastUpdatedBy
    payload.lastUpdatedBy = new mongoose.Types.ObjectId(req.user?._id);

    // Call service
    const updated = await updateImageLabel(req.params.id, payload);

    return res.status(200).json({
      success: true,
      message: "Image label updated successfully",
      data: updated,
      code: 200,
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * Delete image label
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function deleteImageLabelController(req, res, next) {
  try {
    await deleteImageLabel(req.params.id, req.user);
    return res.status(200).json({
      success: true,
      message: "Image label deleted successfully",
      code: 200,
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  createImageLabel: createImageLabelController,
  getImageLabels: getImageLabelsController,
  getImageLabel: getImageLabelController,
  updateImageLabel: updateImageLabelController,
  deleteImageLabel: deleteImageLabelController,
};
