const { z } = require("zod");

/**
 * Validation schema for image label creation
 *
 * @type {import("zod").ZodObject}
 */
const supportSchema = z
  .object({
    message: z
      .string()
      .min(1, "Label must be at least 1 character")
      .trim()
      .max(250, "Support message must be at most 250 characters"),
  })
  .strict();

module.exports = {
  supportSchema,
};
