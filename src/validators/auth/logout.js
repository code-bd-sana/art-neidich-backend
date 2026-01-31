const { z } = require("zod");

/**
 * Validation schema for user logout
 *
 * @type {import("zod").ZodObject}
 */
const logoutSchema = z
  .object({
    deviceId: z
      .string({
        invalid_type_error: "Device ID must be a string",
      })
      .max(100, { message: "Device ID must not exceed 100 characters" })
      .trim(),
  })
  .strict();

module.exports = { logoutSchema };
