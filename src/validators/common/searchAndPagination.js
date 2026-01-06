const { z } = require("zod");

/**
 * Validation schema for search and pagination
 *
 * @type {import("zod").ZodObject}
 */
const searchAndPaginationSchema = z
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
  })
  .strict();

module.exports = { searchAndPaginationSchema };
