const { z } = require("zod");

/**
 * Validation schema for notification settings
 *
 * @type {import("zod").ZodObject}
 */
const notificationSchema = z
  .object({
    enable: z
      .boolean({
        invalid_type_error: "EnableNotifications must be a boolean value",
      })
      .refine(
        (val) => typeof val === "boolean",
        "EnableNotifications must be a boolean value",
      ),
  })
  .strict();

/**
 * Validation for notification and pagination
 *
 * @type {import("zod").ZodObject}
 */
const notificationPaginationSchema = z
  .object({
    page: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 1))
      .refine((val) => val > 0, { message: "Page must be a positive integer" }),
    limit: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 50))
      .refine((val) => val > 0, {
        message: "Limit must be a positive integer",
      }),
  })
  .strict();

module.exports = {
  notificationSchema,
  notificationPaginationSchema,
};
