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
  {},
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
notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });

/**
 * Marks this notification as read and saves it.
 * @returns {Promise<void>}
 */
notificationSchema.methods.markAsRead = async function () {
  if (!this.isRead) {
    this.isRead = true;
    await this.save();
  }
};

/**
 * Main Notification model
 * @type {mongoose.Model}
 */
const Notification = mongoose.model("Notification", notificationSchema);

// Export both the model and the types constant for safe usage across the app
module.exports = {
  Notification,
  notificationTypes,
};
