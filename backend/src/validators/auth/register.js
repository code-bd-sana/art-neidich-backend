const { z } = require("zod");

/**
 * Validation schema for user registration
 *
 * @type {import("zod").ZodObject}
 */
const registerSchema = z
  .object({
    firstName: z.string().min(1, "First name is required"),
    lastName: z.string().min(1, "Last name is required"),
    email: z.string().email("Invalid email address"),
    password: z.string().min(6, "Password must be at least 6 characters"),
  })
  .strict();

module.exports = { registerSchema };
