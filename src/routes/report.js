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
} = require("../validators/report/report");

// Multer setup for in-memory upload
const storage = multer.memoryStorage();
const upload = multer({ storage });

// All report routes require authentication
router.use(authenticate);

// Merge multer files into req.body.images before validation
const mergeFilesWithBody = (req, res, next) => {
  console.log("request body before merge:", req.body);
  console.log(
    "request files:",
    req.files?.map((f) => f.originalname),
  );

  if (!req.files?.length) return next();

  let meta = req.body.imagesMeta || req.body.images || "[]";
  let parsedMeta = [];

  if (typeof meta === "string") {
    try {
      // Handle multiline / formatted JSON better
      const cleaned = meta.trim().replace(/\n\s*/g, " ");
      parsedMeta = JSON.parse(cleaned);
    } catch (e) {
      console.error(
        "JSON parse error on imagesMeta:",
        e.message,
        meta.substring(0, 100),
      );
      parsedMeta = [];
    }
  } else if (Array.isArray(meta)) {
    parsedMeta = meta;
  }

  // Build images array
  req.body.images = req.files.map((file, idx) => ({
    fileName: file.originalname,
    mimeType: file.mimetype,
    size: file.size,
    buffer: file.buffer,
    ...(parsedMeta[idx] || {}), // attach metadata
  }));

  // IMPORTANT: only delete the original meta field — NEVER delete images!
  delete req.body.imagesMeta; // safe to delete
  // Do NOT do this → delete req.body.images;  ← remove or comment this line

  console.log("Sanitized body:", {
    job: req.body.job,
    imagesCount: req.body.images?.length || 0,
    firstImageLabel: req.body.images?.[0]?.imageLabel,
  });

  next();
};

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
  authorizeRoles(2),
  upload.array("images"), // no limit on number of images
  mergeFilesWithBody,
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

// Stream PDF for a report
router.get(
  "/:id/pdf",
  authorizeRoles(0, 1),
  validate(mongoIdSchema, { target: "params" }),
  getReportPdfController,
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
