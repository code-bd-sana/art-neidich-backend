const { z } = require("zod");

const { mongoIdSchema } = require("../common/mongoId");

/**
 * Validation schema for creating a report
 *
 * The schema expects:
 * - job: a valid MongoDB ObjectId as a string
 * - imageEntries: an array of objects, each containing:
 *    - imageLabel: a valid MongoDB ObjectId as a string
 *    - fileName: optional string for the image file name
 *    - mimeType: optional string for the image MIME type
 *    - size: optional number for the image file size
 *    - buffer: optional any type for the image file buffer
 *
 * The array must contain at least 1 .
 */
const createReportSchema = z
  .object({
    job: mongoIdSchema.shape.id,
    imageEntries: z
      .array(
        z.object({
          imageLabel: mongoIdSchema.shape.id,
          fileName: z.string().min(1).optional(),
          mimeType: z.string().optional(),
          size: z.number().optional(),
          buffer: z.any().optional(),
        }),
      )
      .min(1, "At least 1 image required"),
  })
  .strict();

/**
 * Validation schema for search report with the status field
 */
const reportPaginationSchema = z
  .object({
    search: z.string().trim().optional(),
    page: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 1))
      .refine((val) => val > 0, { message: "Page must be a positive integer" }),
    limit: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 10))
      .refine((val) => val > 0, {
        message: "Limit must be a positive integer",
      }),
    status: z.enum(["all", "submitted", "completed", "rejected"]).optional(),
  })
  .strict();

/**
 * Validation schema for updating report status
 */
const updateReportStatusSchema = z
  .object({
    status: z.enum(["submitted", "completed", "rejected"], {
      required_error: "Status is required",
    }),
  })
  .strict();

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
module.exports = {
  createReportSchema,
  reportPaginationSchema,
  updateReportStatusSchema,
  handleGroupedImages,
};
