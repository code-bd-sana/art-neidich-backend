const { z } = require("zod");

/**
 * Validation schema for user reset password
 * Supports three modes:
 * - Web token flow: { email, token, newPassword }
 * - Direct OTP flow: { email, otp, newPassword }
 * - Mobile verified flow: { email, newPassword } (after verify-otp)
 *
 * @type {import("zod").ZodUnion}
 */
const resetPasswordSchema = z.union([
  // Web token mode
  z
    .object({
      email: z.string().email("Invalid email address"),
      token: z.string().uuid("Invalid or malformed reset token"),
      newPassword: z
        .string()
        .min(6, "New password must be at least 6 characters"),
    })
    .strict(),
  // Direct OTP mode
  z
    .object({
      email: z.string().email("Invalid email address"),
      otp: z.string().length(6, "OTP must be 6 characters long"),
      newPassword: z
        .string()
        .min(6, "New password must be at least 6 characters"),
    })
    .strict(),
  // Mobile verified mode (email + newPassword)
  z
    .object({
      email: z.string().email("Invalid email address"),
      newPassword: z
        .string()
        .min(6, "New password must be at least 6 characters"),
    })
    .strict(),
]);

module.exports = { resetPasswordSchema };
