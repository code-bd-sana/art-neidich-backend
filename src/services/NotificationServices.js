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
  console.log("[NotificationService] initFirebase: starting initialization");
  try {
    // Try to load local service account JSON in repo root
    const saPath = path.resolve(process.cwd(), "fhainspectorapp.json");
    const serviceAccount = require(saPath);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    initialized = true;
    console.log(
      "[NotificationService] initFirebase: initialized with service account",
    );
  } catch (err) {
    console.warn(
      "[NotificationService] initFirebase: service account not found, trying default credentials",
    );
    // Fallback: initialize with default credentials (if hosting provides them)
    try {
      admin.initializeApp();
      initialized = true;
      console.log(
        "[NotificationService] initFirebase: initialized with default credentials",
      );
    } catch (e) {
      console.error(
        "[NotificationService] initFirebase: failed to initialize firebase",
        e && e.message ? e.message : e,
      );
      // swallow; callers will get errors when trying to send
    }
  }
}

initFirebase();

// Simple prefixed log helpers to keep console output consistent
const LOG_PREFIX = "[NotificationService]";
const log = (...args) => console.log(LOG_PREFIX, ...args);
const debug = (...args) => {
  if (process.env.DEBUG) console.debug(LOG_PREFIX, ...args);
};
const logError = (...args) => console.error(LOG_PREFIX, ...args);

/**
 * Send a push notification to a single device
 * @param {string} deviceToken FCM device token
 * @param {object} payload Notification payload
 */
async function sendToDevice(deviceToken, payload = {}) {
  log("sendToDevice: called", { hasToken: !!deviceToken });

  // Validate input
  if (!deviceToken) {
    const err = new Error("Device token is required");
    err.status = 404;
    err.code = "DEVICE_TOKEN_NOT_FOUND";
    logError("sendToDevice: missing deviceToken");
    throw err;
  }

  // Build message
  const message = buildMessage(deviceToken, payload);

  debug("sendToDevice: built message", {
    title: payload && payload.title,
    bodyLength: payload && payload.body ? payload.body.length : 0,
  });

  // Send message
  try {
    const res = await admin.messaging().send(message);
    log("sendToDevice: send success", res);
    return res;
  } catch (err) {
    logError(
      "sendToDevice: send failed",
      err && err.message ? err.message : err,
    );
    throw err;
  }
}

/**
 * Send a push notification to multiple devices
 * @param {string[]} deviceTokens Array of FCM device tokens
 * @param {object} payload Notification payload
 */
async function sendToMany(deviceTokens = [], payload = {}) {
  log("sendToMany: called", {
    tokensReceived: Array.isArray(deviceTokens) ? deviceTokens.length : 1,
  });
  // Validate input
  if (!Array.isArray(deviceTokens)) deviceTokens = [deviceTokens];

  // Filter out invalid tokens
  const tokens = deviceTokens.filter(Boolean);

  // Return warning if no valid tokens
  if (!tokens.length) {
    log("sendToMany: no valid tokens provided");
    return { warning: "no-tokens" };
  }

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
    try {
      const messaging = admin.messaging();
      let resp;
      if (typeof messaging.sendMulticast === "function") {
        // Preferred: send a multicast message when available
        resp = await messaging.sendMulticast(multicast);
      } else {
        // Fallback: some admin SDK versions don't expose sendMulticast.
        // Use sendAll by mapping tokens to individual messages.
        const messages = chunk.map((t) => buildMessage(t, payload));
        resp = await messaging.sendAll(messages);
      }

      log("sendToMany: chunk sent", {
        chunkIndex: i / chunkSize,
        chunkSize: chunk.length,
        successCount: resp.successCount,
        failureCount: resp.failureCount,
      });
      results.successCount += resp.successCount || 0;
      results.failureCount += resp.failureCount || 0;
      results.responses.push(resp);
    } catch (err) {
      logError("sendToMany: chunk send failed", {
        chunkIndex: i / chunkSize,
        error: err && err.message ? err.message : err,
      });
      results.responses.push({ error: err });
      results.failureCount += chunk.length;
    }
  }

  log("sendToMany: finished", {
    total: tokens.length,
    successCount: results.successCount,
    failureCount: results.failureCount,
  });
  return results;
}

/**
 * Send a push notification to all active devices for a user
 * @param {string} userId User ID
 * @param {object} payload Notification payload
 */
async function sendToUser(userId, payload = {}) {
  log("sendToUser: called", { userId });

  // Validate input
  if (!userId) {
    const err = new Error("User ID is required");
    err.status = 400;
    err.code = "USER_ID_REQUIRED";
    logError("sendToUser: missing userId");
    throw err;
  }

  // find active tokens for user
  const docs = await PushToken.find({
    user: new mongoose.Types.ObjectId(userId),
    active: true,
  }).select("token -_id");

  // Extract tokens
  const tokens = (docs || []).map((d) => d.token).filter(Boolean);

  log("sendToUser: tokens found for user", {
    userId,
    tokenCount: tokens.length,
  });

  // Return warning if no tokens
  if (!tokens.length) {
    log("sendToUser: no-tokens-for-user", { userId });
    return { warning: "no-tokens-for-user" };
  }

  // Send to all tokens
  try {
    const result = await sendToMany(tokens, payload);
    log("sendToUser: sendToMany result", {
      userId,
      resultSummary: {
        success: result.successCount,
        failure: result.failureCount,
      },
    });
    return result;
  } catch (err) {
    logError(
      "sendToUser: sendToMany failed",
      err && err.message ? err.message : err,
    );
    throw err;
  }
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
  debug("buildMessage: returning message", {
    title,
    bodyLength: body ? body.length : 0,
    dataKeys: data && typeof data === "object" ? Object.keys(data) : [],
  });
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
  debug("buildMulticast: returning multicast", {
    tokenCount: Array.isArray(tokens) ? tokens.length : 0,
    title,
    bodyLength: body ? body.length : 0,
  });
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

  log("listNotifications: called", { query, userId });

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

  log("listNotifications: fetched", {
    returned: notifications.length,
    totalNotifications,
  });

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
  log("getNotificationById: called", { notificationId, userId });

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
    logError("getNotificationById: not found", { notificationId, userId });
    const err = new Error("Notification not found");
    err.status = 404;
    err.code = "NOTIFICATION_NOT_FOUND";
    throw err;
  }

  log("getNotificationById: found", { notificationId });
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
  log("registerToken: called", { userId, platform, deviceId, deviceName });
  try {
    // Upsert the push details
    const result = await PushToken.findOneAndUpdate(
      { deviceId }, // Find by deviceId
      {
        $set: {
          user: new mongoose.Types.ObjectId(userId),
          platform,
          token,
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

    log("registerToken: upsert successful", {
      deviceId,
      id: result && result._id,
    });
    return result;
  } catch (err) {
    logError(
      "registerToken: upsert failed",
      err && err.message ? err.message : err,
    );
    throw err;
  }
}

/**
 * Active or Inactive a specific push notification for a device
 * @param {string} deviceId Device ID
 */
async function activeOrInactivePushNotification(deviceId) {
  log("activeOrInactivePushNotification: called", { deviceId });

  // Find the token by deviceId
  const currentToken = await PushToken.findOne({ deviceId });

  // If not found, throw error
  if (!currentToken) {
    logError("activeOrInactivePushNotification: not found", { deviceId });
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

  log("activeOrInactivePushNotification: toggled", {
    deviceId,
    previous: currentActiveState,
    now: result.active,
  });
  return result;
}

/**
 * Get all active tokens for a user
 * @param {string} userId User ID
 */
async function getUserTokens(userId) {
  log("getUserTokens: called", { userId });
  // Find active tokens for user
  const tokens = await PushToken.find({
    user: new mongoose.Types.ObjectId(userId),
    active: true,
  });
  log("getUserTokens: found", { userId, count: tokens.length });
  return tokens;
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
