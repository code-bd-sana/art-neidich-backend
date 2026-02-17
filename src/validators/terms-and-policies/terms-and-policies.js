const { z } = require("zod");

const { mongoIdSchema } = require("../common/mongoId");

/**
 * Validation schema for creating terms and policies
 *
 * @type {import("zod").ZodObject}
 */
const createTermsAndPolicySchema = z
  .object({
    type: z.enum(["TERMS", "PRIVACY"], {
      message: "Type must be either 'TERMS' or 'PRIVACY'",
    }),
    version: z.number().optional(), // version will be auto-incremented in the service
    content: z.string().min(1, "Content is required"),
    isActive: z.boolean().optional(), // Optional field to set the terms as active or not
    effectiveDate: z
      .string()
      .refine(
        (val) => !isNaN(Date.parse(val)) && Date.parse(val) > Date.now(),
        {
          message: "Effective date must be a valid future date string",
        },
      ), // Effective date should have to to be valid future date UTC date string
  })
  .strict();

/**
 * Validation schema for updating terms and policies
 *
 * - All fields are optional
 *
 * @type {import("zod").ZodObject}
 */
const updateTermsAndPolicySchema = createTermsAndPolicySchema
  .partial()
  .strict();

const searchTermsAndPolicySchema = z
  .object({
    type: z
      .enum(["TERMS", "PRIVACY"], {
        message: "Type must be either 'TERMS' or 'PRIVACY'",
      })
      .optional(),
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
  createTermsAndPolicySchema,
  updateTermsAndPolicySchema,
  searchTermsAndPolicySchema,
};
