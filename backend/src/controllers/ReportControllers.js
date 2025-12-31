const {
  createReport,
  updateReport,
  getReportById,
  getAllReports,
  deleteReport,
  updateReportStatus,
} = require("../services/ReportServices");

/**
 * Create a new report
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function createReportController(req, res, next) {
  try {
    const payload = req.validated;
    const report = await createReport(payload, req.files, req.user);
    return res.status(201).json({
      success: true,
      message: "Report created successfully",
      data: report,
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * Get a single report by id
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function getReportByIdController(req, res, next) {
  try {
    const report = await getReportById(req.params.id);
    return res.status(200).json({
      success: true,
      message: "Report fetched successfully",
      data: report,
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * Get list of reports with optional search & pagination
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function getReportsController(req, res, next) {
  try {
    const result = await getAllReports(req.query);
    return res.status(200).json({
      success: true,
      message: "Reports fetched successfully",
      data: result.reports,
      metaData: result.metaData,
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * Update only the status of a report
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function updateReportStatusController(req, res, next) {
  try {
    const payload = req.validated;
    payload.lastUpdatedBy = req.user?._id;
    const updated = await updateReportStatus(req.params.id, payload);
    return res.status(200).json({
      success: true,
      message: "Report status updated successfully",
      data: updated,
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * Delete a report by id
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function deleteReportController(req, res, next) {
  try {
    await deleteReport(req.params.id);
    return res
      .status(200)
      .json({ success: true, message: "Report deleted successfully" });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  createReportController,
  getReportByIdController,
  getReportsController,
  deleteReportController,
  updateReportStatusController,
};
