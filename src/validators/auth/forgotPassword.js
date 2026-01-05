const { z } = require("zod");

/**
 * Validation schema for user forget password request
 *
 * @type {import("zod").ZodObject}
 */
const forgotPasswordSchema = z
  .object({
    email: z.string().email("Invalid email address").trim(),
    webRequest: z.boolean().optional(),
    mobileRequest: z.boolean().optional(),
  })
  .strict()
  .refine((data) => data.webRequest || data.mobileRequest, {
    message: "Either webRequest or mobileRequest must be provided",
  })
  .refine((data) => !(data.webRequest && data.mobileRequest), {
    message:
      "webRequest and mobileRequest cannot both be true at the same time",
  });

module.exports = { forgotPasswordSchema };
