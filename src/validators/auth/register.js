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
    acceptTermsAndPolicy: z.boolean().refine((val) => val === true, {
      message: "You must accept the terms and policy to register",
    }),
  })
  .strict();

module.exports = { registerSchema };
