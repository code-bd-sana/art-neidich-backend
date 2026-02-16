const mongoose = require("mongoose");

/**
 * Terms and Conditions Schema
 * Stores the text, version, and status of the terms.
 */
const termsSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      default: "Terms and Conditions",
    },
    version: {
      type: String,
      required: true,
      default: "1.0",
    },
    content: {
      type: String,
      required: true,
      trim: true,
    },
    effectiveDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true, versionKey: false },
);

module.exports = mongoose.model("Terms", termsSchema);
