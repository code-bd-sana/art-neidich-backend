const { z } = require("zod");

const { mongoIdSchema } = require("../common/mongoId");

/**
 * Validation schema for creating a Job
 *
 * @type {import('zod').ZodObject}
 */
const createJobSchema = z
  .object({
    inspector: mongoIdSchema.shape.id,
    formType: z.enum(["RCI Residential Building Code Inspection", "UnKnown"]),
    feeStatus: z.enum([
      "Standard",
      "Rush Order",
      "Occupied Fee",
      "Modified Fee",
      "Long Distance Fee",
    ]),
    agreedFee: z
      .number({}, { required_error: "Agreed fee is required" })
      .int()
      .nonnegative(),
    fhaCaseDetailsNo: z
      .string({}, { required_error: "FHA case details number is required" })
      .min(1),
    orderId: z.string({}, { required_error: "Order ID is required" }).min(1),
    streetAddress: z
      .string({}, { required_error: "Street address is required" })
      .min(1),
    developmentName: z
      .string({}, { required_error: "Development name is required" })
      .min(1),
    siteContactName: z
      .string({}, { required_error: "Site contact name is required" })
      .min(1),
    siteContactPhone: z
      .string({}, { required_error: "Site contact phone is required" })
      .min(1),
    siteContactEmail: z
      .string({}, { required_error: "Site contact email is required" })
      .email()
      .optional(),
    dueDate: z.coerce.date().min(new Date(), {
      message: "Due date cannot be in the past",
    }),
    // max 1250 characters
    specialNotesForInspector: z.string().max(1250).optional(),
    specialNoteForApOrAr: z.string().max(1250).optional(),
  })
  .strict();

/**
 * Validation schema for updating a Job
 *
 * @type {import('zod').ZodObject}
 */
const updateJobSchema = createJobSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided for update",
  });

module.exports = { createJobSchema, updateJobSchema };
