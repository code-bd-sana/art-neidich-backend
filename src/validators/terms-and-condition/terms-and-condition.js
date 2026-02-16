const { z } = require("zod");

const { mongoIdSchema } = require("../common/mongoId");

/**
 * Validation schema for creating terms and conditions
 *
 * @type {import("zod").ZodObject}
 */
const createTermsAndConditionSchema = z
  .object({
    content: z.string().min(1, "Content is required"),
    version: z.string().min(1, "Version is required"),
    effectiveDate: z
      .string()
      .refine(
        (val) => !isNaN(Date.parse(val)) && Date.parse(val) > Date.now(),
        {
          message: "Effective date must be a valid future date string",
        },
      ), // Effective date should have to to be valid future date UTC date string
    isActive: z.boolean().optional(), // Optional field to set the terms as active or not
  })
  .strict();

/**
 * Validation schema for updating terms and conditions
 *
 * - All fields are optional
 *
 * @type {import("zod").ZodObject}
 */
const updateTermsAndConditionSchema = createTermsAndConditionSchema
  .partial()
  .strict();

const searchTermsAndConditionSchema = z
  .object({
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
  })
  .strict();

module.exports = {
  createTermsAndConditionSchema,
  updateTermsAndConditionSchema,
  searchTermsAndConditionSchema,
};
