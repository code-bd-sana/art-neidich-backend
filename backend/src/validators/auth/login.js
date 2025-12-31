const { z } = require("zod");

/**
 * Validation schema for user login
 *
 * @type {import("zod").ZodObject}
 */
const loginSchema = z
  .object({
    email: z.string().email("Invalid email address").trim(),
    password: z.string().min(6, "Password must be at least 6 characters"),
  })
  .strict();

module.exports = { loginSchema };
