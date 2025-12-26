const mongoose = require("mongoose");

const reportSchema = new mongoose.Schema(
  {
    // Inspector who created the report
    inspector: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // Associated job
    job: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Job",
      required: true,
    },
    // Report content
    images: [
      {
        imageLabel: {
          type: String,
          required: true,
        },
        // Image file stored URL
        url: {
          type: String,
          required: true,
        },
        // Image file name
        fileName: {
          type: String,
          required: true,
        },
        alt: {
          type: String,
          default: "",
        },
        // who upload this image
        uploadedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        // file type like image/png, application/pdf etc
        mimeType: {
          type: String,
          required: true,
        },
        // file size in bytes
        size: {
          type: Number, // bytes
          required: true,
        },
        noteForAdmin: {
          type: String,
          default: "",
        },
      },
    ],
    // Report review status
    status: {
      type: String,
      enum: ["in_progress", "success", "rejected"],
      default: "in_progress",
    },
  },
  { timestamps: true, versionKey: false }
);

const ReportModel = mongoose.model("Report", reportSchema);

module.exports = ReportModel;
