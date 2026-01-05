const { z } = require("zod");

/**
 * Validation schema for user reset password
 *
 * @type {import("zod").ZodUnion}
 */
const resetPasswordSchema = z.union([
  // OTP mode
  z
    .object({
      email: z.string().email("Invalid email address"),
      otp: z.string().length(6, "OTP must be 6 characters long"),
      newPassword: z
        .string()
        .min(6, "New password must be at least 6 characters"),
    })
    .strict(),
  // Token mode
  z
    .object({
      email: z.string().email("Invalid email address"),
      token: z.string().uuid("Invalid or malformed reset token"),
      newPassword: z
        .string()
        .min(6, "New password must be at least 6 characters"),
    })
    .strict(),
]);

module.exports = { resetPasswordSchema };
