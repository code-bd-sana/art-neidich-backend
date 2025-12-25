const { z } = require("zod");

/**
 * Validation schema for update user details
 *
 * @type {import("zod").ZodObject}
 */
const updateUserSchema = z
  .object({
    firstName: z.string().min(1, "First name is required").optional(),
    lastName: z.string().min(1, "Last name is required").optional(),
    email: z.string().email("Invalid email address").optional(),
  })
  .strict();

module.exports = { updateUserSchema };
