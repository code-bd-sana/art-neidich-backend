const { z } = require("zod");

const { mongoIdSchema } = require("../common/mongoId");

/**
 * Validation schema for creating a Report
 * Minimum 1 image, Maximum 2 images
 */
const createReportSchema = z
  .object({
    job: mongoIdSchema.shape.id,
    images: z
      .array(
        z.object({
          imageLabel: mongoIdSchema.shape.id,
          fileName: z
            .string({ required_error: "File name is required" })
            .min(1),
          alt: z.string().optional(),
          mimeType: z
            .string({ required_error: "MIME type is required" })
            .min(1),
          size: z
            .number({ required_error: "File size is required" })
            .int()
            .nonnegative(),
          noteForAdmin: z.string().optional(),
          buffer: z.any().optional(), // for AWS upload if using buffer
          stream: z.any().optional(), // for AWS upload if using stream
        })
      )
      .refine((arr) => arr.length >= 1 && arr.length <= 2, {
        message: "You must provide 1 or 2 images",
      }),
  })
  .strict();

/**
 * Validation schema for search report with the status field
 */
const reportStatusSchema = z
  .object({
    status: z
      .enum(["in_progress", "in_review", "completed", "rejected"])
      .optional(),
  })
  .strict();

/**
 * Validation schema for updating report status
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
  reportStatusSchema,
  updateReportStatusSchema,
};
