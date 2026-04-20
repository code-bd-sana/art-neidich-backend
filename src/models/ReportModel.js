const mongoose = require("mongoose");

const reportSchema = new mongoose.Schema(
  {
    inspector: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    job: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Job",
      required: true,
      index: true,
    },
    images: [
      {
        imageLabel: { type: String, required: true },
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
      enum: ["submitted", "completed", "rejected", "archived"],
      default: "submitted",
      index: true,
    },
    noteForAdmin: { type: String, trim: true, default: "" },
    completedAt: { type: Date, default: null, index: true },
  },
  { timestamps: true, versionKey: false },
);

reportSchema.index({ status: 1, completedAt: 1 });

module.exports = mongoose.model("Report", reportSchema);