const express = require("express");
const multer = require("multer");

const router = express.Router();

const {
  createReportController,
  getReportsController,
  getReportByIdController,
  deleteReportController,
  updateReportStatusController,
  getReportPdfController,
} = require("../controllers/ReportControllers");
const { authenticate, authorizeRoles } = require("../middleware/auth");
const { validate } = require("../utils/validator");
const { mongoIdSchema } = require("../validators/common/mongoId");
const {
  createReportSchema,
  updateReportSchema,
  updateReportStatusSchema,
  reportStatusSchema,
  reportPaginationSchema,
  handleGroupedImages,
} = require("../validators/report/report");

// Multer setup for in-memory upload
const storage = multer.memoryStorage();
const upload = multer({ storage });

// All report routes require authentication
router.use(authenticate);

/**
 * Create a new report
 *
 * @route POST /api/v1/report
 * Private route — only inspector (2) can create reports
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
router.post(
  "/",
  authenticate,
  authorizeRoles(2),
  upload.array("images"),
  handleGroupedImages,
  validate(createReportSchema, { target: "body" }),
  createReportController,
);

/**
 * Get all reports with optional search and pagination
 *
 * @route GET /api/v1/report
 * Private route
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
router.get(
  "/",
  authorizeRoles(0, 1),
  validate(reportPaginationSchema, { target: "query" }),
  getReportsController,
);

/**
 * Get a single report by id
 *
 * @route GET /api/v1/report/:id
 * Private route
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
router.get(
  "/:id",
  authorizeRoles(0, 1),
  validate(mongoIdSchema, { target: "params" }),
  getReportByIdController,
);

/**
 * Update only the status of a report
 *
 * @route PATCH /api/v1/report/:id/status
 * Private route - only root (0) and admin (1) can update status
 */
router.patch(
  "/:id/status",
  authorizeRoles(0, 1),
  validate(mongoIdSchema, { target: "params" }),
  validate(updateReportStatusSchema, { target: "body" }),
  updateReportStatusController,
);

/**
 * Delete a report
 *
 * @route DELETE /api/v1/report/:id
 * Private route — only root (0) and admin (1) can delete reports
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
router.delete(
  "/:id",
  authorizeRoles(0, 1),
  validate(mongoIdSchema, { target: "params" }),
  deleteReportController,
);

module.exports = router;
