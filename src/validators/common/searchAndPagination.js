const { z } = require("zod");

/**
 * Validation schema for search, pagination & date filtering
 */
const searchAndPaginationSchema = z
  .object({
    search: z.string().trim().optional(),

    page: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 1))
      .refine((val) => val > 0, {
        message: "Page must be a positive integer",
      }),

    limit: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 10))
      .refine((val) => val > 0, {
        message: "Limit must be a positive integer",
      }),

    status: z
      .enum(["all", "in_progress", "submitted", "completed", "rejected"])
      .optional(),

    /**
     * Date filter type
     * - this_month
     * - previous_month
     * - custom
     */
    dateType: z.enum(["this_month", "previous_month", "custom"]).optional(),

    /**
     * Required only when dateType = custom
     */
    customDate: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.dateType === "custom") {
        return !!data.customDate;
      }
      return true;
    },
    {
      message: "customDate is required for custom date filter",
      path: ["customDate"],
    },
  )
  .strict();

module.exports = { searchAndPaginationSchema };
