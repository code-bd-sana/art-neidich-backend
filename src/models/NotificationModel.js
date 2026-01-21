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

/**
 * Mongoose schema for in-app / push / email notifications.
 * Tracks events such as report submissions, job assignments, status changes,
 * role promotions, and account status changes (suspend/unsuspend).
 *
 * @property {ObjectId} recipient      - User who should see this notification
 * @property {ObjectId} [actor]        - User who triggered the action (null for system events)
 * @property {String}   type           - Kind of notification (must match notificationTypes)
 * @property {String}   message        - Human-readable message (used in UI, email, push)
 * @property {ObjectId} [relatedId]    - ID of the related document (report/job/user)
 * @property {String}   [relatedModel] - Model name for dynamic population ("Report", "Job", "User")
 * @property {Boolean}  isRead         - Whether the recipient has viewed it
 * @property {String[]} channels       - Delivery channels this notification should use
 * @property {Object}   metadata       - Flexible extra data (status changes, report title, etc.)
 */
const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Recipient user is required"],
      index: true,
    },

    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    type: {
      type: String,
      enum: Object.values(notificationTypes),
      required: [true, "Notification type is required"],
      index: true,
    },

    message: {
      type: String,
      required: [true, "Notification message is required"],
      trim: true,
      maxlength: [280, "Message cannot exceed 280 characters"],
    },

    relatedId: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: "relatedModel",
      default: null,
    },

    relatedModel: {
      type: String,
      enum: ["Report", "Job", "User", null],
      default: null,
    },

    isRead: {
      type: Boolean,
      default: false,
      index: true, // helps quickly filter unread notifications
    },

    channels: {
      type: [
        {
          type: String,
          enum: ["in_app", "email", "push"],
        },
      ],
      default: ["in_app"],
    },

    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
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
