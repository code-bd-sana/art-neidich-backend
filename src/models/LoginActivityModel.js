const mongoose = require("mongoose");

// models/ReportModel.js
const LoginActivitySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    deviceId: {
      type: String,
      required: true,
    },
    loggedInStatus: {
      type: Boolean,
      default: null,
    }, // track if user is logged in on this device
    lastLoggedInAt: {
      type: Date,
      default: null,
    }, // timestamp of last login status update
    lastLoggedOutAt: {
      type: Date,
      default: null,
    }, // timestamp of last logout status update
  },
  { timestamps: true, versionKey: false },
);

module.exports = mongoose.model("LoginActivity", LoginActivitySchema);
