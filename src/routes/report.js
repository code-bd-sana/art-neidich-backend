const express = require("express");
const multer = require("multer");

const router = express.Router();

const {
  getArchivedReportsController,
  restoreArchivedReportsController,
  permanentlyDeleteArchivedReportsController,
} = require("../controllers/ReportArchiveControllers");
const {
  createReportController,
  getReportsController,
  getReportByIdController,
  deleteReportController,
  updateReportStatusController,
  getReportPdfController,
  resubmitReportController,
} = require("../controllers/ReportControllers");
const { authenticate, authorizeRoles } = require("../middleware/auth");
const { validate } = require("../utils/validator");
const { mongoIdSchema } = require("../validators/common/mongoId");
const {
  restoreArchiveSchema,
  permanentDeleteSchema,
} = require("../validators/report/archive");
const {
  createReportSchema,
  updateReportStatusSchema,
  resubmitReportSchema,
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

router.patch(
  "/:id/resubmit",
  authenticate,
  authorizeRoles(2),
  upload.array("images"),
  handleGroupedImages,
  validate(resubmitReportSchema, { target: "body" }),
  resubmitReportController,
);

// router.post(
//   "/",
//   authenticate,
//   authorizeRoles(2),
//   upload.array("images"),
//   handleGroupedImages,
//   validate(createReportSchema, { target: "body" }),
//   createReportController,
// );

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

/**
 * Archive Management Routes
 * ========================
 */

/**
 * Get archived reports with pagination and search
 *
 * @route GET /api/v1/report/archive/list
 * Private route - only root (0) and admin (1) can view archived reports
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
router.get(
  "/archive/list",
  authorizeRoles(0, 1),
  validate(reportPaginationSchema, { target: "query" }),
  getArchivedReportsController,
);

/**
 * Restore archived reports
 *
 * @route POST /api/v1/report/archive/restore
 * Private route - only root (0) and admin (1) can restore reports
 *
 * @param {Object} req.body - { reportIds: ["id1", "id2", ...] }
 * @returns {Object} - { restoredCount, reportIds }
 */
router.post(
  "/archive/restore",
  authorizeRoles(0, 1),
  validate(restoreArchiveSchema, { target: "body" }),
  restoreArchivedReportsController,
);

/**
 * Permanently delete archived reports
 *
 * @route DELETE /api/v1/report/archive/permanent
 * Private route - only root (0) and admin (1) can permanently delete reports
 *
 * @param {Object} req.body - { reportIds: ["id1", "id2", ...] }
 * @returns {Object} - { deletedCount, reportIds }
 */
router.delete(
  "/archive/permanent",
  authorizeRoles(0, 1),
  validate(permanentDeleteSchema, { target: "body" }),
  permanentlyDeleteArchivedReportsController,
);

module.exports = router;
