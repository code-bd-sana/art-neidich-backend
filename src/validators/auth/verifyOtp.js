const { z } = require("zod");

/**
 * Validation schema for OTP verification (mobile)
 *
 * @type {import("zod").ZodObject}
 */
const verifyOtpSchema = z
  .object({
    email: z.string().email("Invalid email address"),
    otp: z.string().length(6, "OTP must be 6 characters long"),
  })
  .strict();

module.exports = { verifyOtpSchema };
