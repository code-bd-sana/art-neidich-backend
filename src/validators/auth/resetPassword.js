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
const resetPasswordSchema = z
  .object({
    email: z.string().email("Invalid email address"),
    token: z.string().uuid("Invalid reset token").optional(),
    otp: z.string().length(6, "OTP must be 6 digits").optional(),
    newPassword: z.string().min(8, "Password must be at least 8 characters"),
  })
  .strict()
  .refine(
    (data) => {
      // exactly one of token or otp must be present
      return (data.token && !data.otp) || (!data.token && data.otp);
    },
    {
      message: "Must provide exactly one of: token (web) or otp (mobile)",
      path: [], // or ["token"] / ["otp"] depending on preference
    },
  )
  .refine((data) => Boolean(data.token || data.otp), {
    message: "Either token or otp is required",
    path: [],
  });

module.exports = { resetPasswordSchema };
