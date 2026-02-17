const mongoose = require("mongoose");

/**
 * User Terms Acceptance Schema
 * Tracks which user has accepted which version of Terms and Conditions
 */
const UserTermsAcceptanceSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    termsType: { type: String, enum: ["TERMS", "PRIVACY"], required: true },
    acceptedVersion: { type: Number, required: true },
    acceptedAt: { type: Date, default: Date.now },
  },
  { timestamps: true, versionKey: false },
);

module.exports = mongoose.model(
  "UserTermsAcceptance",
  UserTermsAcceptanceSchema,
);
