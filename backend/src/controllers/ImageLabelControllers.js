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
    const payload = req.validated;
    const label = await createImageLabel(payload, req.user);
    return res.status(201).json({
      success: true,
      message: "Image label created successfully",
      data: label,
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
    const { labels, metaData } = await getImageLabels(req.query);

    return res.status(200).json({
      success: true,
      message: "Image labels fetched successfully",
      data: labels,
      metaData: metaData,
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
    const label = await getImageLabel(req.params.id);
    return res.status(200).json({
      success: true,
      message: "Image label fetched successfully",
      data: label,
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
    const payload = req.validated;
    const updated = await updateImageLabel(req.params.id, payload, req.user);
    return res.status(200).json({
      success: true,
      message: "Image label updated successfully",
      data: updated,
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
