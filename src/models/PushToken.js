// models/PushToken.js
const mongoose = require("mongoose");

const pushTokenSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    token: {
      type: String,
      required: true,
    },
    platform: {
      type: String,
      enum: ["android", "ios", "web"],
      required: true,
    },
    deviceId: {
      type: String,
      required: true,
    },
    deviceName: String, // optional: "Samsung Galaxy S23", "iPhone 15 Pro", etc.
    active: {
      type: Boolean,
      default: true,
    },
    lastUsed: Date, // track last usage
    createdAt: {
      type: Date,
      default: Date.now,
      // Optional: auto-remove very old/inactive tokens after 1 year
      // expires: 31536000
    },
  },
  { versionKey: false },
);

pushTokenSchema.index({ user: 1, active: 1 });

module.exports = mongoose.model("PushToken", pushTokenSchema);
