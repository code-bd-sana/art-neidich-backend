const { z } = require("zod");

/**
 * Validation schema for creating a Job
 *
 * @type {import('zod').ZodObject}
 */
const createJobSchema = z
  .object({
    inspectorId: z.string().min(1, "Inspector ID is required"),
    formType: z.enum(["RCI Residential Building Code Inspection", "UnKnown"]),
    feeStatus: z.enum([
      "Standard",
      "Rush Order",
      "Occupied Fee",
      "Modified Fee",
      "Long Distance Fee",
    ]),
    agreedFee: z.number().int().nonnegative(),
    fhaCaseDetailsNo: z.string().min(1),
    orderId: z.string().min(1),
    streetAddress: z.string().min(1),
    developmentName: z.string().min(1),
    siteContactName: z.string().min(1),
    siteContactPhone: z.string().min(1),
    siteContactEmail: z.string().email().optional(),
    dueDate: z.string().min(1),
    specialNotesForInspector: z.string().optional(),
    specialNoteForApOrAr: z.string().optional(),
  })
  .strict();

module.exports = { createJobSchema };
