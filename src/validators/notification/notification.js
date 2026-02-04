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
 * Validation schema for deviceId parameter
 *
 * @type {import("zod").ZodObject}
 */
const deviceIdSchema = z
  .object({
    deviceId: z
      .string({
        invalid_type_error: "Device ID must be a string",
      })
      .max(100, { message: "Device ID must not exceed 100 characters" })
      .trim(),
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
    type: z
      .enum([
        "all",
        "report_submitted",
        "job_assigned",
        "report_status_updated",
        "registered_as_admin",
        "registered_as_inspector",
        "account_suspended",
        "account_unsuspend",
        "custom",
      ])
      .optional(),
  })
  .strict();

/**
 * Validation schema for registering a push token
 *
 * @type {import("zod").ZodObject}
 */
const registerPushTokenSchema = z
  .object({
    token: z
      .string({
        required_error: "Token is required",
        invalid_type_error: "Token must be a string",
      })
      .min(1, { message: "Token is required" })
      .trim(),
    platform: z.enum(["android", "ios", "web"], {
      required_error: "Platform is required",
      invalid_type_error: "Platform must be android, ios, or web",
    }),
    deviceId: z
      .string({
        invalid_type_error: "Device ID must be a string",
      })
      .max(100, { message: "Device ID must not exceed 100 characters" })
      .trim(),
    deviceName: z
      .string({
        invalid_type_error: "Device name must be a string",
      })
      .max(200, { message: "Device name must not exceed 200 characters" })
      .trim()
      .optional(),
  })
  .strict();

module.exports = {
  notificationSchema,
  deviceIdSchema,
  notificationPaginationSchema,
  registerPushTokenSchema,
};
