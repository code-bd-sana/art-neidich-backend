const { z } = require("zod");

const { mongoIdSchema } = require("../common/mongoId");

/**
 * Validation schema for creating a Report
 * Accepts either newly uploaded images (buffer/stream) or existing image objects
 * Minimum 1 image, Maximum 2 images
 */
const uploadedImageSchema = z
  .object({
    imageLabel: z.string().min(1, "imageLabel is required"),
    fileName: z.string().min(1).optional(),
    alt: z.string().optional(),
    mimeType: z.string().min(1).optional(),
    size: z.number().int().nonnegative().optional(),
    noteForAdmin: z.string().optional(),
    buffer: z.any().optional(),
    stream: z.any().optional(),
  })
  .refine((o) => !!(o.buffer || o.stream), {
    message: "Uploaded image must include buffer or stream",
  });

const existingImageSchema = z.object({
  imageLabel: z.string().min(1, "imageLabel is required"),
  url: z.string().url({ message: "Invalid URL" }),
  key: z.string().min(1),
  fileName: z.string().min(1),
  alt: z.string().optional(),
  mimeType: z.string().min(1),
  size: z.number().int().nonnegative(),
  noteForAdmin: z.string().optional(),
});

const imageEntrySchema = z.union([uploadedImageSchema, existingImageSchema]);

const createReportSchema = z
  .object({
    job: mongoIdSchema.shape.id,
    images: z
      .array(imageEntrySchema)
      .min(1, "At least 1 image is required")
      .max(30, "Maximum 30 images allowed per report"),
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
