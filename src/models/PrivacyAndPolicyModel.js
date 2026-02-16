const mongoose = require("mongoose");

/**
 * Privacy and Policy Schema
 * Stores the privacy policy content, version, and status
 */
const privacyPolicySchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      default: "Privacy Policy",
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

module.exports = mongoose.model("PrivacyAndPolicy", privacyPolicySchema);
