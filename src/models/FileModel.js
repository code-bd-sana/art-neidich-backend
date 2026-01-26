const mongoose = require("mongoose");

// models/ReportModel.js
const reportSchema = new mongoose.Schema(
  {
    image: {
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
    images: [
      {
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
  },
  { timestamps: true, versionKey: false },
);

module.exports = mongoose.model("File", reportSchema);
