const mongoose = require("mongoose");

const NotificationModel = require("../../models/NotificationModel");
const PushToken = require("../../models/PushToken");
const UserModel = require("../../models/UserModel");
const {
  sendToMany,
  sendToUser,
} = require("../../services/NotificationServices");

/**
 * Fetch all active admin users (roles 0 and 1)
 * @returns {Promise<Array<Object>>} - Array of admin users with _id, firstName, lastName, email
 */
async function getActiveAdmins() {
  // Query for active admins
  return await UserModel.find({
    role: { $in: [0, 1] },
    isSuspended: false,
    isApproved: true,
  }).select("_id firstName lastName email");
}

/**
 * Convert user documents to ObjectId array
 * @param {Array<Object>} users - Array of user documents
 * @returns {Array<mongoose.Types.ObjectId>} - Array of ObjectIds
 */
function extractUserIds(users) {
  return (users || []).map((user) => new mongoose.Types.ObjectId(user._id));
}

/**
 * Fetch active push tokens for given user IDs
 * @param {Array<mongoose.Types.ObjectId>} userIds - Array of user IDs
 * @returns {Promise<Array<string>>} - Array of device token strings
 */
async function getActiveTokensForUsers(userIds) {
  // Query for active tokens linked to the specified users with notificationActive and loggedInStatus true
  const tokenDocs = await PushToken.find({
    "users.user": { $in: userIds },
    "users.notificationActive": true,
    "users.loggedInStatus": true,
  }).select("token");

  return (tokenDocs || []).map((t) => t.token);
}

/**
 * Fetch active admin users and their push tokens
 * @returns {Promise<{adminIds: Array<mongoose.Types.ObjectId>, deviceTokens: Array<string>}>}
 */
async function getAdminsAndTokens() {
  // Fetch active admins
  const admins = await getActiveAdmins();

  // Extract their user IDs
  const adminIds = extractUserIds(admins);

  // Fetch their active push tokens
  const deviceTokens = await getActiveTokensForUsers(adminIds);

  return { adminIds, deviceTokens };
}

/**
 * Fetch active push tokens for a specific user
 * @param {mongoose.Types.ObjectId|string} userId - User ID
 * @returns {Promise<Array<string>>} - Array of device token strings
 */
async function getTokensForUser(userId) {
  // Ensure userId is an ObjectId
  const objectId = new mongoose.Types.ObjectId(userId);

  // Fetch active tokens for the user
  return await getActiveTokensForUsers([objectId]);
}

/**
 * Send push notification with automatic fallback logic
 * Tries: sendToMany (tokens) → sendToUser (single user) → no-targets warning
 *
 * @param {Object} params
 * @param {Array<string>} params.deviceTokens - Array of device tokens
 * @param {Array<mongoose.Types.ObjectId>} params.userIds - Array of user IDs (for fallback)
 * @param {Object} params.notificationPayload - Notification content {title, body, data}
 * @returns {Promise<Object>} - Send result
 */
async function sendNotificationWithFallback({
  deviceTokens = [],
  userIds = [],
  notificationPayload,
}) {
  let sendResult = null;

  // Try sending to device tokens first
  if (deviceTokens.length > 0) {
    sendResult = await sendToMany(deviceTokens, notificationPayload);
  }
  // Fallback: send to single user if no tokens but one user ID
  else if (userIds.length === 1) {
    sendResult = await sendToUser(userIds[0], notificationPayload);
  }
  // No targets available
  else {
    sendResult = { warning: "no-targets" };
  }

  return sendResult;
}

/**
 * Create and send push notification with automatic status tracking
 *
 * @param {Object} params
 * @param {string} params.type - Notification type
 * @param {string} params.title - Notification title
 * @param {string} params.body - Notification body
 * @param {Object} params.data - Notification data payload
 * @param {mongoose.Types.ObjectId|null} [params.authorId] - Author user ID (optional)
 * @param {mongoose.Types.ObjectId} [params.recipient] - Single recipient (optional)
 * @param {Array<mongoose.Types.ObjectId>} [params.recipients] - Multiple recipients (optional)
 * @param {Array<string>} [params.deviceTokens] - Device tokens (optional)
 * @param {Array<mongoose.Types.ObjectId>} [params.userIds] - User IDs for fallback (optional)
 * @returns {Promise<Object>} - Created and sent notification document
 */
async function createAndSendNotification({
  type,
  title,
  body,
  data,
  authorId = null,
  recipient = null,
  recipients = null,
  deviceTokens = [],
  userIds = [],
}) {
  // Build notification document
  const notificationDoc = {
    type,
    title,
    body,
    data,
    authorId,
    status: "pending",
  };

  // Add recipient(s)
  if (recipient) {
    notificationDoc.recipient = recipient;
  }
  if (recipients) {
    notificationDoc.recipients = recipients;
  }

  // Add device tokens if provided
  if (deviceTokens.length > 0) {
    notificationDoc.deviceTokens = deviceTokens;
  }

  // Create notification record
  const notification = await NotificationModel.create(notificationDoc);

  // Send notification
  try {
    const sendResult = await sendNotificationWithFallback({
      deviceTokens,
      userIds,
      notificationPayload: { title, body, data },
    });

    // Update notification as sent
    notification.status = "sent";
    notification.result = sendResult;
    notification.sentAt = new Date();
    await notification.save();

    return notification;
  } catch (sendErr) {
    // Update notification as failed
    notification.status = "failed";
    notification.result = { error: sendErr.message || String(sendErr) };
    await notification.save();

    // Re-throw to allow caller to handle if needed
    throw sendErr;
  }
}

/**
 * Create and send notification to admins
 * Convenience wrapper for common admin notification pattern
 *
 * @param {Object} params
 * @param {string} params.type - Notification type
 * @param {string} params.title - Notification title
 * @param {string} params.body - Notification body
 * @param {Object} params.data - Notification data payload
 * @param {mongoose.Types.ObjectId|null} [params.authorId] - Author user ID (optional)
 * @returns {Promise<Object|null>} - Created notification or null if failed
 */
async function notifyAdmins({ type, title, body, data, authorId = null }) {
  try {
    // Fetch admin IDs and their device tokens
    const { adminIds, deviceTokens } = await getAdminsAndTokens();

    // Create and send notification to admins
    return await createAndSendNotification({
      type,
      title,
      body,
      data,
      authorId,
      recipients: adminIds,
      deviceTokens,
      userIds: adminIds,
    });
  } catch (error) {
    console.error("Failed to notify admins:", error);
    return null;
  }
}

/**
 * Create and send notification to a specific user (e.g., inspector)
 *
 * @param {Object} params
 * @param {mongoose.Types.ObjectId|string} params.userId - User ID
 * @param {string} params.type - Notification type
 * @param {string} params.title - Notification title
 * @param {string} params.body - Notification body
 * @param {Object} params.data - Notification data payload
 * @param {mongoose.Types.ObjectId|null} [params.authorId] - Author user ID (optional)
 * @returns {Promise<Object|null>} - Created notification or null if failed
 */
async function notifyUser({
  userId,
  type,
  title,
  body,
  data,
  authorId = null,
}) {
  try {
    // Fetch device tokens for the user
    const userObjectId = new mongoose.Types.ObjectId(userId);

    // Get active tokens for the user
    const deviceTokens = await getTokensForUser(userObjectId);

    // Create and send notification to the user
    return await createAndSendNotification({
      type,
      title,
      body,
      data,
      authorId,
      recipient: userObjectId,
      deviceTokens,
      userIds: [userObjectId],
    });
  } catch (error) {
    console.error(`Failed to notify user ${userId}:`, error);
    return null;
  }
}

module.exports = {
  // Low-level helpers
  getActiveAdmins,
  extractUserIds,
  getActiveTokensForUsers,
  getAdminsAndTokens,
  getTokensForUser,
  sendNotificationWithFallback,
  createAndSendNotification,

  // High-level convenience functions
  notifyAdmins,
  notifyUser,
};
