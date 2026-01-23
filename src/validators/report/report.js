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

module.exports = {
  createReportSchema,
  reportPaginationSchema,
  updateReportStatusSchema,
};
