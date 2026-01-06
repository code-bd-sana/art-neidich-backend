// NotificationTokenModel.js
// Example Mongoose model for storing device tokens per user (optional, for reusability)
const mongoose = require("mongoose");

const NotificationTokenSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  deviceToken: { type: String, required: true },
  platform: { type: String, enum: ["android", "ios", "web"], required: true },
  createdAt: { type: Date, default: Date.now },
});

NotificationTokenSchema.index({ userId: 1, deviceToken: 1 }, { unique: true });

module.exports = mongoose.model("NotificationToken", NotificationTokenSchema);
