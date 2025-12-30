const { z } = require("zod");

const { mongoIdSchema } = require("../common/mongoId");

/**
 * Validation schema for creating a Report
 *
 * @type {import('zod').ZodObject}
 */
const createReportSchema = z
  .object({
    inspectorId: mongoIdSchema.shape.id,
    jobId: mongoIdSchema.shape.id,
    images: z
      .array(
        z.object({
          imageLabel: z
            .string({}, { required_error: "Image label is required" })
            .min(1),
          url: z.string({}, { required_error: "Image URL is required" }).url(),
          key: z
            .string({}, { required_error: "S3 Object Key is required" })
            .min(1),
          fileName: z
            .string({}, { required_error: "File name is required" })
            .min(1),
          alt: z.string().optional(),
          uploadedBy: mongoIdSchema.shape.id,
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
 * Validation schema for updating a Report
 *
 * @type {import('zod').ZodObject}
 */
const updateReportSchema = createReportSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided for update",
  });

/**
 * Validation schema for updating report status
 *
 * @type {import('zod').ZodObject}
 */
const updateReportStatusSchema = z
  .object({
    status: z.enum(["Pending", "In Review", "Completed", "Rejected"], {
      required_error: "Status is required",
    }),
  })
  .strict();

module.exports = {
  createReportSchema,
  updateReportSchema,
  updateReportStatusSchema,
};
