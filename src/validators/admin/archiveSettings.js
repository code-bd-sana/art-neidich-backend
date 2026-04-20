const { z } = require("zod");

/**
 * Validation schema for updating Archive Settings
 *
 * @type {import('zod').ZodObject}
 */
const updateArchiveSettingsSchema = z.object({
  autoArchiveDays: z
    .number({
      required_error: "autoArchiveDays is required",
      invalid_type_error: "autoArchiveDays must be a number",
    })
    .refine((val) => [7, 15, 30].includes(val), {
      message: "autoArchiveDays must be one of: 7, 15, 30",
    }),
});

module.exports = {
  updateArchiveSettingsSchema,
};
