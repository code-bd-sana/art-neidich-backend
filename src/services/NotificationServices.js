const path = require("path");

const admin = require("firebase-admin");
const mongoose = require("mongoose");

const NotificationModel = require("../models/NotificationModel");
const NotificationToken = require("../models/NotificationTokenModel");
const PushToken = require("../models/PushToken");

// Initialize firebase-admin once
let initialized = false;
function initFirebase() {
  if (initialized) return;
  try {
    // Try to load local service account JSON in repo root
    const saPath = path.resolve(
      process.cwd(),
      "fhainspectorapp-61618-firebase-adminsdk-fbsvc-9ae5d44b88.json",
    );
    const serviceAccount = require(saPath);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    initialized = true;
  } catch (err) {
    // Fallback: initialize with default credentials (if hosting provides them)
    try {
      admin.initializeApp();
      initialized = true;
    } catch (e) {
      // swallow; callers will get errors when trying to send
    }
  }
}

initFirebase();

/**
 * Send a push notification to a single device
 * @param {string} deviceToken FCM device token
 * @param {object} payload Notification payload
 */
async function sendToDevice(deviceToken, payload = {}) {
  // Validate input
  if (!deviceToken) {
    const err = new Error("Device token is required");
    err.status = 404;
    err.code = "DEVICE_TOKEN_NOT_FOUND";
    throw err;
  }

  // Build message
  const message = buildMessage(deviceToken, payload);

  console.log("Send to the device notification sending............");

  // Send message
  return admin.messaging().send(message);
}

/**
 * Send a push notification to multiple devices
 * @param {string[]} deviceTokens Array of FCM device tokens
 * @param {object} payload Notification payload
 */
async function sendToMany(deviceTokens = [], payload = {}) {
  // Validate input
  if (!Array.isArray(deviceTokens)) deviceTokens = [deviceTokens];

  // Filter out invalid tokens
  const tokens = deviceTokens.filter(Boolean);

  // Return warning if no valid tokens
  if (!tokens.length) return { warning: "no-tokens" };

  // FCM sendMulticast supports up to 500 tokens per request
  const chunkSize = 500;

  const results = {
    successCount: 0,
    failureCount: 0,
    responses: [],
  };

  // Send in chunks
  for (let i = 0; i < tokens.length; i += chunkSize) {
    const chunk = tokens.slice(i, i + chunkSize);
    const multicast = buildMulticast(chunk, payload);
    const resp = await admin.messaging().sendMulticast(multicast);

    console.log("Notifications: ", resp);
    results.successCount += resp.successCount || 0;
    results.failureCount += resp.failureCount || 0;
    results.responses.push(resp);
  }

  return results;
}

/**
 * Send a push notification to all active devices for a user
 * @param {string} userId User ID
 * @param {object} payload Notification payload
 */
async function sendToUser(userId, payload = {}) {
  // Validate input
  if (!userId) {
    const err = new Error("User ID is required");
    err.status = 400;
    err.code = "USER_ID_REQUIRED";
    throw err;
  }

  // find active tokens for user
  const docs = await PushToken.find({
    user: new mongoose.Types.ObjectId(userId),
    active: true,
  }).select("token -_id");

  // Extract tokens
  const tokens = (docs || []).map((d) => d.token).filter(Boolean);

  // Return warning if no tokens
  if (!tokens.length) return { warning: "no-tokens-for-user" };

  // Send to all tokens
  return sendToMany(tokens, payload);
}

/**
 * Build a message object for a single device
 * @param {string} deviceToken FCM device token
 * @param {object} payload Notification payload
 */
function buildMessage(deviceToken, payload) {
  // Destructure payload
  const { title, body, data } = payload || {};

  // Build message
  const message = {
    token: deviceToken,
    notification: {},
  };

  // Add title and body if provided
  if (title) message.notification.title = title;
  if (body) message.notification.body = body;
  if (data && typeof data === "object") {
    // FCM data values must be strings
    message.data = Object.fromEntries(
      Object.entries(data).map(([k, v]) => [k, String(v)]),
    );
  }

  // Return the built message object
  return message;
}

/**
 * Build a multicast message object for multiple devices
 * @param {string[]} tokens Array of FCM device tokens
 * @param {object} payload Notification payload
 */
function buildMulticast(tokens, payload) {
  // Destructure payload
  const { title, body, data } = payload || {};

  // Build message
  const message = {
    tokens,
    notification: {},
  };

  // Add title and body if provided
  if (title) message.notification.title = title;
  if (body) message.notification.body = body;
  if (data && typeof data === "object") {
    message.data = Object.fromEntries(
      Object.entries(data).map(([k, v]) => [k, String(v)]),
    );
  }

  // Return the built multicast message object
  return message;
}

/**
 * List notifications for a user with pagination
 *
 * @param {object} query Query parameters
 * @param {number} query.page Page number (default: 1)
 * @param {number} query.limit Number of items per page (default: 10)
 * @param {string} userId User ID
 * @returns {object} Object containing notifications array and metaData
 */
async function listNotifications(query = {}, userId) {
  // Pagination params
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 10;

  // Build query to fetch notifications for the user
  const q = {
    $or: [
      { recipients: new mongoose.Types.ObjectId(userId) },
      { authorId: new mongoose.Types.ObjectId(userId) },
    ],
  };

  // Fetch notifications with pagination
  const notifications = await NotificationModel.find(q)
    .sort({ createdAt: -1 })
    .skip((Number(page) - 1) * Number(limit))
    .limit(Number(limit))
    .select("_id title body type data authorId createdAt");

  // Get total count for pagination metadata
  const totalNotifications = await NotificationModel.countDocuments(q);

  return {
    notifications,
    metaData: {
      page: page,
      limit: limit,
      totalNotifications: totalNotifications,
      totalPage: Math.ceil(totalNotifications / limit),
    },
  };
}

/**
 * Get a single notification by ID for a user
 *
 * @param {string} notificationId Notification ID
 * @param {string} userId User ID
 * @returns {object} Notification document
 */
async function getNotificationById(notificationId, userId) {
  // Fetch notification ensuring the user is either a recipient or the author
  const notification = await NotificationModel.findOne({
    _id: new mongoose.Types.ObjectId(notificationId),
    $or: [
      { recipients: new mongoose.Types.ObjectId(userId) },
      { authorId: new mongoose.Types.ObjectId(userId) },
    ],
  }).select("_id title body type data createdAt");

  // If not found, throw error
  if (!notification) {
    const err = new Error("Notification not found");
    err.status = 404;
    err.code = "NOTIFICATION_NOT_FOUND";
    throw err;
  }

  return notification;
}

/**
 * Register or update a push token for a user
 * Handles multiple devices per user by using upsert logic
 * @param {string} userId User ID
 * @param {string} token FCM device token
 * @param {string} platform Platform: "android", "ios", or "web"
 * @param {string} deviceName Optional device information
 */
async function registerToken(
  userId,
  token,
  platform,
  deviceId,
  deviceName = null,
) {
  // Upsert the push details
  const result = await PushToken.findOneAndUpdate(
    { deviceId }, // Find by deviceId
    {
      $set: {
        user: new mongoose.Types.ObjectId(userId),
        platform,
        deviceId,
        deviceName,
        active: true,
        lastUsed: new Date(),
      },
      $setOnInsert: {
        createdAt: new Date(),
      },
    },
    {
      upsert: true, // Create if doesn't exist
      new: true, // Return updated document
      runValidators: true,
    },
  );

  return result;
}

/**
 * Active or Inactive a specific push notification for a device
 * @param {string} deviceId Device ID
 */
async function activeOrInactivePushNotification(deviceId) {
  // Find the token by deviceId
  const currentToken = await PushToken.findOne({ deviceId });

  // If not found, throw error
  if (!currentToken) {
    const err = new Error("Push token not found");
    err.status = 404;
    err.code = "PUSH_TOKEN_NOT_FOUND";
    throw err;
  }

  // Toggle the active state
  const currentActiveState = currentToken.active;

  // Update the active state
  const result = await PushToken.findOneAndUpdate(
    { deviceId },
    { $set: { active: !currentActiveState } },
    { new: true },
  );

  return result;
}

/**
 * Get all active tokens for a user
 * @param {string} userId User ID
 */
async function getUserTokens(userId) {
  // Find active tokens for user
  return await PushToken.find({
    user: new mongoose.Types.ObjectId(userId),
    active: true,
  });
}

module.exports = {
  sendToDevice,
  sendToMany,
  sendToUser,
  listNotifications,
  getNotificationById,
  registerToken,
  activeOrInactivePushNotification,
  getUserTokens,
};
