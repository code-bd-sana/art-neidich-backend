const { z } = require("zod");

/**
 * Validation schema for search and pagination
 *
 * @type {import("zod").ZodObject}
 */
const roleSchema = z
  .object({
    role: z.enum([0, 1, 2], {
      required_error: "Role is required",
      invalid_type_error:
        "Role must be one of the following values: 0 (root), 1 (admin), 2 (inspector)",
    }),
  })
  .strict();

module.exports = { roleSchema };
