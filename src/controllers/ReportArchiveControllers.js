const mongoose = require("mongoose");

const {
  getArchivedReports,
  restoreArchivedReports,
  permanentlyDeleteArchivedReports,
} = require("../services/reportArchiveManagement.service");

/**
 * Get list of archived reports with pagination
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function getArchivedReportsController(req, res, next) {
  try {
    // Call service
    const { reports, metaData } = await getArchivedReports(req.query);

    return res.status(200).json({
      success: true,
      message: "Archived reports fetched successfully",
      data: reports,
      metaData,
      code: 200,
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * Restore archived reports
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function restoreArchivedReportsController(req, res, next) {
  try {
    // Get validated payload
    const { reportIds } = req.validated;

    // Call service
    const result = await restoreArchivedReports(reportIds);

    return res.status(200).json({
      success: true,
      message: result.message,
      data: {
        restoredCount: result.restoredCount,
        reportIds: result.reportIds,
      },
      code: 200,
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * Permanently delete archived reports
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function permanentlyDeleteArchivedReportsController(req, res, next) {
  try {
    // Get validated payload
    const { reportIds } = req.validated;

    // Call service
    const result = await permanentlyDeleteArchivedReports(reportIds);

    return res.status(200).json({
      success: true,
      message: result.message,
      data: {
        deletedCount: result.deletedCount,
        deletedImages: result.deletedImages,
        reportIds: result.reportIds,
      },
      code: 200,
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  getArchivedReportsController,
  restoreArchivedReportsController,
  permanentlyDeleteArchivedReportsController,
};
