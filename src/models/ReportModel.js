const mongoose = require("mongoose");

// models/ReportModel.js
const reportSchema = new mongoose.Schema(
  {
    inspector: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    job: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Job",
      required: true,
    },
    images: [
      {
        imageLabel: {
          type: String, // String (e.g. "front", "roof_left", "damage_1")
          required: true,
        },
        url: { type: String, required: true },
        key: { type: String, required: true },
        fileName: { type: String, required: true },
        alt: { type: String, default: "" },
        uploadedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        mimeType: { type: String, required: true },
        size: { type: Number, required: true },
      },
    ],
    status: {
      type: String,
      enum: ["submitted", "completed", "rejected"],
      default: "submitted",
    },
    noteForAdmin: { type: String, default: "" },
  },
  { timestamps: true, versionKey: false },
);

module.exports = mongoose.model("Report", reportSchema);
