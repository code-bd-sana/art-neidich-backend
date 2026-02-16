const mongoose = require("mongoose");

/**
 * Acknowledge Schema
 * Tracks which user has accepted which version of Terms and Conditions
 */
const acknowledgeSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    termsId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Terms",
      required: true,
    },
    acceptedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  { timestamps: true, versionKey: false },
);

module.exports = mongoose.model("Acknowledge", acknowledgeSchema);
