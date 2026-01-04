const { z } = require("zod");

/**
 * Validation schema for image label creation
 *
 * @type {import("zod").ZodObject}
 */
const createImageLabelSchema = z
  .object({
    label: z.string().min(1, "Label must be at least 1 character").trim(),
  })
  .strict();

/**
 * Validation schema for image label update
 *
 * - All fields are optional
 *
 * @type {import("zod").ZodObject}
 */
const updateImageLabelSchema = createImageLabelSchema.partial().strict();

module.exports = {
  createImageLabelSchema,
  updateImageLabelSchema,
};
