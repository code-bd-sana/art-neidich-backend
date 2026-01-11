const mongoose = require("mongoose");

const { generateReportPdf } = require("../services/ReportPdfService");
const {
  createReport,
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
    payload.inspector = new mongoose.Types.ObjectId(req.user?._id);
    payload.job = new mongoose.Types.ObjectId(req.params.job);
    const report = await createReport(payload);
    return res.status(201).json({
      success: true,
      message: "Report created successfully",
      data: report,
      code: 201,
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * Get all reports with optional search and pagination
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function getReportsController(req, res, next) {
  try {
    const { reports, metaData } = await getAllReports(req.query);
    return res.status(200).json({
      success: true,
      message: "Reports fetched successfully",
      data: reports,
      metaData,
      code: 200,
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
      code: 200,
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * Stream a PDF version of the report
 */
async function getReportPdfController(req, res, next) {
  try {
    const report = await getReportById(req.params.id);
    const pdfBuffer = await generateReportPdf(report);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="report-${report._id}.pdf"`
    );
    return res.send(pdfBuffer);
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
      code: 200,
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
      .json({
        success: true,
        message: "Report deleted successfully",
        code: 200,
      });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  createReportController,
  getReportsController,
  getReportByIdController,
  deleteReportController,
  updateReportStatusController,
  getReportPdfController,
};
