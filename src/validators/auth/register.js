const { z } = require("zod");

/**
 * Validation schema for user registration
 *
 * @type {import("zod").ZodObject}
 */
const registerSchema = z
  .object({
    firstName: z.string().min(1, "First name is required").trim(),
    lastName: z.string().min(1, "Last name is required").trim(),
    email: z.string().email("Invalid email address").trim(),
    password: z.string().min(6, "Password must be at least 6 characters"),
    role: z.union([z.literal(1), z.literal(2)], {
      errorMap: () => ({
        message:
          "Role must be one of the following values: 1 (admin), 2 (inspector)",
      }),
    }),
    // push notification token
    pushToken: z.string(),
    platform: z.union([
      z.literal("android"),
      z.literal("ios"),
      z.literal("web"),
    ]),
    deviceInfo: z
      .string({
        message:
          'Device information must be a string.(e.g, Samsung Galaxy S23", "iPhone 15 Pro", etc.)',
      })
      .optional(),
  })
  .strict();

module.exports = { registerSchema };
