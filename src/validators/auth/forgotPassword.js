const { z } = require("zod");

/**
 * Validation schema for user forget password request
 *
 * @type {import("zod").ZodObject}
 */
const forgotPasswordSchema = z
  .object({
    email: z.string().email("Invalid email address").trim(),
  })
  .strict();

module.exports = { forgotPasswordSchema };
