const { z } = require("zod");

const { mongoIdSchema } = require("../common/mongoId");

/**
 * Validation schema for creating privacy and policy
 *
 * @type {import("zod").ZodObject}
 */
const createPrivacyAndPolicySchema = z
  .object({
    title: z.string().min(1, "Title is required"),
    content: z.string().min(1, "Content is required"),
    version: z.string().min(1, "Version is required"),
    effectiveDate: z
      .string()
      .refine(
        (val) => !isNaN(Date.parse(val)) && Date.parse(val) > Date.now(),
        {
          message: "Effective date must be a valid future date string",
        },
      ), // Effective date should be a valid future date UTC date string
    isActive: z.boolean().optional(), // Optional field to set the policy as active or not
  })
  .strict();

/**
 * Validation schema for updating privacy and policy
 *
 * - All fields are optional
 *
 * @type {import("zod").ZodObject}
 */
const updatePrivacyAndPolicySchema = createPrivacyAndPolicySchema
  .partial()
  .strict();

const searchPrivacyAndPolicySchema = z
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
    version: z.string().optional(),
  })
  .strict();

module.exports = {
  createPrivacyAndPolicySchema,
  updatePrivacyAndPolicySchema,
  searchPrivacyAndPolicySchema,
};
