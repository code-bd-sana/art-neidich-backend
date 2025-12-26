const mongoose = require("mongoose");

const jobSchema = new mongoose.Schema(
  {
    inspectorId: {
      type: mongoose.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // RCI Residential Building Code Inspection, UnKnown(TODO: this will change)
    formType: {
      type: String,
      enum: ["RCI Residential Building Code Inspection", "UnKnown"],
      required: true,
    },
    feeStatus: {
      type: String,
      enum: [
        "Standard",
        "Rush Order",
        "Occupied Fee",
        "Modified Fee",
        "Long Distance Fee",
      ],
      required: true,
    },
    agreedFee: {
      type: Number,
      required: true,
    },
    fhaCaseDetailsNo: {
      type: String,
      required: true,
    },
    orderId: {
      type: String,
      required: true,
    },
    streetAddress: {
      type: String,
      required: true,
    },
    developmentName: {
      type: String, // Area name
      required: true,
    },
    siteContactName: {
      type: String,
      required: true,
    },
    siteContactPhone: {
      type: String,
      required: true,
    },
    siteContactEmail: {
      type: String,
      default: "",
    },
    dueDate: {
      type: Date,
      required: true,
    },
    specialNotesForInspector: {
      type: String,
      default: "",
      maxLength: 1250,
    },
    specialNoteForApOrAr: {
      type: String,
      default: "",
      maxLength: 1250,
    },
    createdBy: {
      type: mongoose.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true, versionKey: false }
);

const JobModel = mongoose.model("Job", jobSchema);

module.exports = JobModel;
