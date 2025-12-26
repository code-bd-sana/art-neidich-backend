const { z } = require("zod");

/**
 * Validation schema for updating a Job
 *
 * @type {import('zod').ZodObject}
 */
const updateJobSchema = z
  .object({
    inspectorId: z.string().optional(),
    formType: z
      .enum(["RCI Residential Building Code Inspection", "UnKnown"])
      .optional(),
    feeStatus: z
      .enum([
        "Standard",
        "Rush Order",
        "Occupied Fee",
        "Modified Fee",
        "Long Distance Fee",
      ])
      .optional(),
    agreedFee: z.number().int().nonnegative().optional(),
    fhaCaseDetailsNo: z.string().optional(),
    orderId: z.string().optional(),
    streetAddress: z.string().optional(),
    developmentName: z.string().optional(),
    siteContactName: z.string().optional(),
    siteContactPhone: z.string().optional(),
    siteContactEmail: z.string().email().optional(),
    dueDate: z.string().optional(),
    specialNotesForInspector: z.string().optional(),
    specialNoteForApOrAr: z.string().optional(),
  })
  .strict();

module.exports = { updateJobSchema };
