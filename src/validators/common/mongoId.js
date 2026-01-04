const { z } = require("zod");

/**
 * Validation schema for mongoId
 *
 * @type {import("zod").ZodObject}
 */
const mongoIdSchema = z
  .object({
    id: z
      .string()
      .regex(/^[0-9a-fA-F]{24}$/, { message: "Invalid MongoDB ObjectId" }),
  })
  .strict();

module.exports = { mongoIdSchema };
