const mongoose = require("mongoose");

/**
 * Enum-like object for all supported notification types.
 * Used both for schema validation (enum) and for creating notifications safely.
 */
const notificationTypes = {
  REPORT_SUBMITTED: "report_submitted",
  JOB_ASSIGNED: "job_assigned",
  REPORT_STATUS_UPDATED: "report_status_updated",
  REGISTERED_AS_ADMIN: "registered_as_admin",
  REGISTERED_AS_INSPECTOR: "registered_as_inspector",
  ACCOUNT_SUSPENDED: "account_suspended",
  ACCOUNT_UNSUSPENDED: "account_unsuspended",
};

const notificationSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    body: { type: String },
    // arbitrary payload for deeper linking or metadata
    data: { type: mongoose.Schema.Types.Mixed, default: {} },

    // Type of notification (use `notificationTypes` constant where possible)
    type: {
      type: String,
      enum: Object.values(notificationTypes).concat(["custom"]),
      default: "custom",
    },

    // Author / creator of the notification (optional)
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

    // For backwards-compatibility we support either a single `recipient`
    // (one-document-per-user) or a `recipients` array (one document for many users).
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    recipients: [
      { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    ],

    // Device tokens targeted (if any) - stored as strings
    deviceTokens: [{ type: String }],

    // Delivery tracking
    status: {
      type: String,
      enum: ["pending", "sent", "failed"],
      default: "pending",
    },
    // Result of the send attempt (FCM response, error message, etc.)
    result: { type: mongoose.Schema.Types.Mixed },
    sentAt: { type: Date },

    // Track which users have read this notification. For single-recipient docs
    // this will be either empty or contain that single user id.
    readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  },
  {
    timestamps: true, // automatically adds createdAt & updatedAt
    versionKey: false, // removes __v field
  },
);

/**
 * Compound index for the most frequent query pattern:
 *   - Fetch notifications for a specific user
 *   - Sorted by newest first
 *   - Filter by read/unread status
 */
// Indexes optimised for the common access patterns:
//  - find notifications for a single recipient
//  - find notifications where recipients include a user
//  - sort by newest first
notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ recipients: 1, createdAt: -1 });
notificationSchema.index({ readBy: 1, createdAt: -1 });

/**
 * Marks this notification as read and saves it.
 * @returns {Promise<void>}
 */
/**
 * Mark this notification as read.
 * - If `userId` is provided, it will be added to `readBy` (useful when a
 *   single document represents multiple recipients).
 * - If no `userId` is provided and the document has a `recipient` field, the
 *   `readBy` array will be set to contain that recipient.
 */
notificationSchema.methods.markAsRead = async function (userId) {
  // If caller specified which user read it, add to readBy if not present
  if (userId) {
    const uidStr = String(userId);
    const already = (this.readBy || []).some((r) => String(r) === uidStr);
    if (!already) {
      this.readBy = this.readBy || [];
      this.readBy.push(userId);
      await this.save();
    }
    return;
  }

  // Fallback behaviour for single-recipient documents
  if (this.recipient) {
    const uidStr = String(this.recipient);
    const already = (this.readBy || []).some((r) => String(r) === uidStr);
    if (!already) {
      this.readBy = this.readBy || [];
      this.readBy.push(this.recipient);
      await this.save();
    }
  }
};

/**
 * Main Notification model
 * @type {mongoose.Model}
 */
const Notification = mongoose.model("Notification", notificationSchema);

// Export the model directly for backwards-compatibility with existing
// controllers (they `require('../models/NotificationModel')` and call
// model methods). Also attach the `notificationTypes` as a property.
module.exports = Notification;
module.exports.notificationTypes = notificationTypes;
