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
    role: z.coerce
      .number()
      .int()
      .refine((val) => [0, 1, 2].includes(val), {
        message: "Role must be 0 (Super Admin), 1 (Admin), or 2 (Inspector)",
      })
      .optional(),
    isSuspended: z.coerce.boolean().optional(),
    isApproved: z.coerce.boolean().optional(),
  })
  .strict();

module.exports = { userSearchAndPaginationSchema };
