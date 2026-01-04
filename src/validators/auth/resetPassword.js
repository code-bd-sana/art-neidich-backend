const { z } = require("zod");

/**
 * Validation schema for user reset password
 *
 * @type {import("zod").ZodObject}
 */
const resetPasswordSchema = z
  .object({
    email: z.string().email("Invalid email address"),
    token: z.string().uuid("Invalid or malformed reset token"),
    newPassword: z
      .string()
      .min(6, "New password must be at least 6 characters"),
  })
  .strict();

module.exports = { resetPasswordSchema };
