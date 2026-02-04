const { z } = require("zod");

/**
 * Validation schema for user login
 *
 * @type {import("zod").ZodObject}
 */
const loginSchema = z
  .object({
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
    token: z
      .string({
        required_error: "Token(Push Notification) is required",
        invalid_type_error: "Token(Push Notification) must be a string",
      })
      .min(1, { message: "Token(Push Notification) is required" })
      .trim(),
    platform: z.enum(["android", "ios", "web"], {
      required_error: "Platform is required",
      invalid_type_error: "Platform must be android, ios, or web",
    }),
    email: z.string().email("Invalid email address").trim(),
    password: z.string().min(6, "Password must be at least 6 characters"),
  })
  .strict();

module.exports = { loginSchema };
