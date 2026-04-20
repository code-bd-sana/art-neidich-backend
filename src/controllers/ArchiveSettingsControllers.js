const {
  getArchiveSettings,
  updateArchiveSettings,
} = require("../services/ArchiveSettingsServices");

/**
 * Get archive settings
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function getArchiveSettingsController(req, res, next) {
  try {
    const settings = await getArchiveSettings();

    return res.status(200).json({
      success: true,
      message: "Archive settings retrieved successfully",
      data: settings,
      code: 200,
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * Update archive settings
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function updateArchiveSettingsController(req, res, next) {
  try {
    // Get validated payload
    const payload = req.validated;

    // Call service
    const settings = await updateArchiveSettings(payload);

    return res.status(200).json({
      success: true,
      message: "Archive settings updated successfully",
      data: settings,
      code: 200,
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  getArchiveSettingsController,
  updateArchiveSettingsController,
};
