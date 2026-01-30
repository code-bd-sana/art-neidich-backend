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
    // Prefer local service account file
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
      "[NotificationService] initFirebase: service account not found, trying Application Default Credentials",
    );

    try {
      admin.initializeApp(); // Uses ADC (e.g. on GCP, or GOOGLE_APPLICATION_CREDENTIALS env var)
      initialized = true;
      console.log(
        "[NotificationService] initFirebase: initialized with default credentials",
      );
    } catch (e) {
      console.error(
        "[NotificationService] initFirebase: failed to initialize firebase",
        e?.message || e,
      );
      // Continue — callers will receive errors when sending
    }
  }
}

initFirebase();

// ────────────────────────────────────────────────
// Logging helpers
// ────────────────────────────────────────────────
const LOG_PREFIX = "[NotificationService]";
const log = (...args) => console.log(LOG_PREFIX, ...args);
const logError = (...args) => console.error(LOG_PREFIX, ...args);
const debug = (...args) => {
  if (process.env.DEBUG === "true") console.debug(LOG_PREFIX, ...args);
};

// ────────────────────────────────────────────────
// Core send functions
// ────────────────────────────────────────────────

/**
 * Send notification to a single device
 * @param {string} deviceToken
 * @param {object} payload
 */
async function sendToDevice(deviceToken, payload = {}) {
  log("sendToDevice: called", { hasToken: !!deviceToken });

  if (!deviceToken) {
    const err = new Error("Device token is required");
    err.status = 404;
    err.code = "DEVICE_TOKEN_NOT_FOUND";
    logError("sendToDevice: missing deviceToken");
    throw err;
  }

  const message = buildMessage(deviceToken, payload);

  try {
    const response = await admin.messaging().send(message);
    log("sendToDevice: success", { messageId: response });
    return response;
  } catch (err) {
    logError("sendToDevice: failed", err?.message || err);
    throw err;
  }
}

/**
 * Send notification to multiple devices (main modern entry point)
 * @param {string[]} deviceTokens
 * @param {object} payload
 * @returns {Promise<{successCount: number, failureCount: number, responses: any[]}>}
 */
async function sendToMany(deviceTokens = [], payload = {}) {
  log("sendToMany: called", {
    tokensReceived: Array.isArray(deviceTokens) ? deviceTokens.length : 1,
  });

  // Normalize input
  const tokens = Array.isArray(deviceTokens)
    ? deviceTokens.filter(Boolean)
    : [deviceTokens].filter(Boolean);

  if (tokens.length === 0) {
    log("sendToMany: no valid tokens provided");
    return {
      successCount: 0,
      failureCount: 0,
      responses: [],
      warning: "no-tokens",
    };
  }

  const results = {
    successCount: 0,
    failureCount: 0,
    responses: [],
  };

  const chunkSize = 500; // Safe conservative limit

  for (let i = 0; i < tokens.length; i += chunkSize) {
    const chunk = tokens.slice(i, i + chunkSize);
    const multicastMessage = buildMulticast(chunk, payload);

    try {
      const resp = await admin
        .messaging()
        .sendEachForMulticast(multicastMessage);

      log("sendToMany: chunk sent", {
        chunkIndex: Math.floor(i / chunkSize),
        chunkTokens: chunk.length,
        success: resp.successCount,
        failure: resp.failureCount,
      });

      results.successCount += resp.successCount;
      results.failureCount += resp.failureCount;
      results.responses.push(resp);

      // Optional: Clean up invalid tokens
      resp.responses.forEach((r, idx) => {
        if (
          !r.success &&
          r.error?.code === "messaging/registration-token-not-registered"
        ) {
          const badToken = chunk[idx];
          PushToken.deleteOne({ token: badToken })
            .then(() => log("Removed unregistered token:", badToken))
            .catch((e) =>
              logError("Failed to remove bad token", badToken, e?.message),
            );
        }
      });
    } catch (err) {
      logError("sendToMany: chunk failed", {
        chunkIndex: Math.floor(i / chunkSize),
        error: err?.message || err,
      });
      results.failureCount += chunk.length;
      results.responses.push({ error: err });
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
 * Send to all active tokens of a user
 * @param {string} userId
 * @param {object} payload
 */
async function sendToUser(userId, payload = {}) {
  log("sendToUser: called", { userId });

  if (!userId) {
    const err = new Error("User ID is required");
    err.status = 400;
    err.code = "USER_ID_REQUIRED";
    logError("sendToUser: missing userId");
    throw err;
  }

  const docs = await PushToken.find({
    user: new mongoose.Types.ObjectId(userId),
    active: true,
  })
    .select("token -_id")
    .lean();

  const tokens = docs.map((d) => d.token).filter(Boolean);

  log("sendToUser: tokens found", { userId, count: tokens.length });

  if (tokens.length === 0) {
    log("sendToUser: no active tokens found");
    return { successCount: 0, failureCount: 0, warning: "no-tokens-for-user" };
  }

  return sendToMany(tokens, payload);
}

// ────────────────────────────────────────────────
// Message builders
// ────────────────────────────────────────────────

function buildMessage(token, payload = {}) {
  const { title, body, data, imageUrl } = payload;

  const message = {
    token,
    notification: {},
  };

  if (title) message.notification.title = title;
  if (body) message.notification.body = body;
  if (imageUrl) message.notification.imageUrl = imageUrl;

  if (data && typeof data === "object") {
    message.data = Object.fromEntries(
      Object.entries(data).map(([k, v]) => [k, String(v)]),
    );
  }

  debug("buildMessage", { title, bodyLength: body?.length || 0 });
  return message;
}

function buildMulticast(tokens, payload = {}) {
  const { title, body, data, imageUrl } = payload;

  const message = {
    tokens,
    notification: {},
  };

  if (title) message.notification.title = title;
  if (body) message.notification.body = body;
  if (imageUrl) message.notification.imageUrl = imageUrl;

  if (data && typeof data === "object") {
    message.data = Object.fromEntries(
      Object.entries(data).map(([k, v]) => [k, String(v)]),
    );
  }

  debug("buildMulticast", { tokenCount: tokens.length, title });
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
