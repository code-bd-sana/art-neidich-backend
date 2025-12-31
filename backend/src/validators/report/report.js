const { z } = require("zod");

const { mongoIdSchema } = require("../common/mongoId");

/**
 * Validation schema for creating a Report
 *
 * @type {import('zod').ZodObject}
 */
const createReportSchema = z
  .object({
    jobId: mongoIdSchema.shape.id,
    images: z
      .array(
        z.object({
          imageLabel: mongoIdSchema.shape.id,
          fileName: z
            .string({}, { required_error: "File name is required" })
            .min(1),
          alt: z.string().optional(),
          mimeType: z
            .string({}, { required_error: "MIME type is required" })
            .min(1),
          size: z
            .number({}, { required_error: "File size is required" })
            .int()
            .nonnegative(),
          noteForAdmin: z.string().optional(),
        })
      )
      .min(1, { message: "At least one image is required" }),
  })
  .strict();

/**
 * Validation schema for updating report status
 *
 * @type {import('zod').ZodObject}
 */
const updateReportStatusSchema = z
  .object({
    status: z.enum(["in_progress", "in_review", "completed", "rejected"], {
      required_error: "Status is required",
    }),
  })
  .strict();

module.exports = {
  createReportSchema,
  updateReportStatusSchema,
};
