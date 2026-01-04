const { z } = require("zod");

/**
 * Validation schema for user change password
 *
 * @type {import("zod").ZodObject}
 */
const changePasswordSchema = z
  .object({
    currentPassword: z
      .string()
      .min(6, "Current password must be at least 6 characters"),
    newPassword: z
      .string()
      .min(6, "New password must be at least 6 characters"),
  })
  .strict();

module.exports = { changePasswordSchema };
