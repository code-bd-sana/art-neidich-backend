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
const handleGroupedImages = (req, res, next) => {
  console.log("=== handleGroupedImages started ===");
  console.log("request body:", req.body);
  console.log(
    "request files:",
    req.files?.map((f) => f.originalname),
  );

  if (!req.files?.length) {
    console.log("No files → skipping");
    return next();
  }

  let groups = [];
  if (req.body.images) {
    try {
      const cleaned = req.body.images.trim().replace(/\n\s*/g, " ");
      groups = JSON.parse(cleaned);
      console.log("Parsed groups:", groups);
    } catch (e) {
      console.error("JSON parse error:", e.message);
      return res
        .status(400)
        .json({ success: false, message: "Invalid JSON in 'images'" });
    }
  }

  if (!Array.isArray(groups) || groups.length === 0) {
    return res
      .status(400)
      .json({ success: false, message: "'images' must be non-empty array" });
  }

  const files = req.files || [];
  let fileIndex = 0;
  const processedImages = []; // ← final array

  for (const group of groups) {
    const labelId = group.imageLabel;
    const expectedCount = Number(group.images?.length || 0);

    console.log(`Group: ${labelId}, expected: ${expectedCount}`);

    if (expectedCount > 2) {
      return res.status(400).json({
        success: false,
        message: `Max 2 images per group (label: ${labelId})`,
      });
    }

    const groupFiles = files.slice(fileIndex, fileIndex + expectedCount);
    fileIndex += expectedCount;

    if (groupFiles.length !== expectedCount) {
      return res.status(400).json({
        success: false,
        message: `File count mismatch for ${labelId} (exp ${expectedCount}, got ${groupFiles.length})`,
      });
    }

    groupFiles.forEach((file) => {
      processedImages.push({
        imageLabel: labelId,
        fileName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        buffer: file.buffer,
      });
    });
  }

  if (fileIndex !== files.length) {
    return res
      .status(400)
      .json({ success: false, message: "Extra unmapped files" });
  }

  // Store under a DIFFERENT name!
  req.body.imageEntries = processedImages; // ← new name

  // Clean up original JSON field
  delete req.body.images;

  console.log("Processed count:", processedImages.length);
  console.log("=== handleGroupedImages finished ===");

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
