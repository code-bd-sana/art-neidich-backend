const { z } = require("zod");

/**
 * Validation schema for update user details
 *
 * @type {import("zod").ZodObject}
 */
const updateUserSchema = z
  .object({
    firstName: z.string().min(1, "First name is required").trim().optional(),
    lastName: z.string().min(1, "Last name is required").trim().optional(),
    email: z.string().email("Invalid email address").trim().optional(),
  })
  .strict();

module.exports = { updateUserSchema };
