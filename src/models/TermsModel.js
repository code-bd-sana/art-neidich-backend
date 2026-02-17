const mongoose = require("mongoose");

/**
 * Terms and Conditions Schema
 * Stores the text, version, and status of the terms.
 */
const termsSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["TERMS", "PRIVACY"],
      required: true,
    },
    version: { type: Number, required: true }, // auto-incremented version
    content: { type: String, required: true }, // HTML/Markdown/JSON text
    isActive: { type: Boolean, default: false }, // current active version
    effectiveFrom: { type: Date, default: Date.now },
  },
  { timestamps: true, versionKey: false },
);

module.exports = mongoose.model("Terms", termsSchema);
