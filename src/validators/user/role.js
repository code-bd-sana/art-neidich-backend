const { z } = require("zod");

/**
 * Validation schema for user search and pagination.
 *
 * @type {import("zod").ZodObject}
 */
const userSearchAndPaginationSchema = z
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
    role: z.enum([0, 1, 2], {
      required_error: "Role is required",
      invalid_type_error:
        "Role must be one of the following values: 0 (root), 1 (admin), 2 (inspector)",
    }),
  })
  .strict();

module.exports = { userSearchAndPaginationSchema };
