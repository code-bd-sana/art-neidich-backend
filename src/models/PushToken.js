// models/PushToken.js
const mongoose = require("mongoose");

const pushTokenSchema = new mongoose.Schema(
  {
    users: [
      {
        // exclude _id for subdocuments
        _id: false,
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
          index: true,
        }, // reference to User model
        notificationActive: {
          type: Boolean,
          default: true,
        }, // toggle notifications per user
        loggedInStatus: {
          type: Boolean,
          default: true,
        }, // track if user is logged in on this device
        loggedInLastUpdated: {
          type: Date,
        }, // timestamp of last login status update
      },
    ],
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
      unique: true,
    },
    deviceName: String, // optional: "Samsung Galaxy S23", "iPhone 15 Pro", etc.
    lastUsed: Date, // track last usage
  },
  { timestamps: true, versionKey: false },
);

pushTokenSchema.index({ "users.user": 1, "users.notificationActive": 1 });

module.exports = mongoose.model("PushToken", pushTokenSchema);
