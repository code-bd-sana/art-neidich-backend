// NotificationModel.js
const mongoose = require("mongoose");

const NotificationSchema = new mongoose.Schema({
  title: { type: String, required: true },
  body: { type: String },
  data: { type: Object },
  type: {
    type: String,
    enum: ["custom", "prestored", "system"],
    default: "custom",
  },
  authorId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  recipients: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  deviceTokens: [{ type: String }],
  status: {
    type: String,
    enum: ["pending", "sent", "failed"],
    default: "pending",
  },
  result: { type: Object },
  sentAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Notification", NotificationSchema);
