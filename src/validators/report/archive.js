const { z } = require("zod");

const { mongoIdSchema } = require("../common/mongoId");

/**
 * Validation schema for restoring archived reports
 *
 * @type {import('zod').ZodObject}
 */
const restoreArchiveSchema = z.object({
  reportIds: z
    .array(mongoIdSchema.shape.id, {
      required_error: "reportIds array is required",
    })
    .min(1, "At least one report ID is required"),
});

/**
 * Validation schema for permanently deleting archived reports
 *
 * @type {import('zod').ZodObject}
 */
const permanentDeleteSchema = z.object({
  reportIds: z
    .array(mongoIdSchema.shape.id, {
      required_error: "reportIds array is required",
    })
    .min(1, "At least one report ID is required"),
});

module.exports = {
  restoreArchiveSchema,
  permanentDeleteSchema,
};
