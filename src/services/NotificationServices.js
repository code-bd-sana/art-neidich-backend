const path = require("path");

const admin = require("firebase-admin");
const mongoose = require("mongoose");

const NotificationModel = require("../models/NotificationModel");
const NotificationToken = require("../models/NotificationTokenModel");
const PushToken = require("../models/PushToken");

// ────────────────────────────────────────────────
// Firebase initialization
// ────────────────────────────────────────────────
let initialized = false;

/**
 * Initialize Firebase Admin SDK
 * @returns {void}
 */
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
    users: { $in: [new mongoose.Types.ObjectId(userId)] },
    active: true,
  })
    .select("token -_id")
    .lean();

  const tokens = (docs || []).map((d) => d.token);

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

/**
 * Build message for a single token
 * @param {string} token
 * @param {object} payload
 * @return {object} Message object
 */
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

/**
 * Build multicast message for multiple tokens
 * @param {string[]} tokens
 * @param {object} payload
 * @return {object} Multicast message
 */
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

// ────────────────────────────────────────────────
// Other services
// ────────────────────────────────────────────────

/**
 * List notifications for a user with pagination
 *
 * @param {object} query Query parameters
 * @param {number} query.page Page number (default: 1)
 * @param {number} query.limit Number of items per page (default: 10)
 * @param {string} userId User ID
 * @returns {object} Object containing notifications array and metaData
 */
async function allNotifications(query = {}, userId) {
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
    logError("getNotificationById: not found", { notificationId, userId });
    const err = new Error("Notification not found");
    err.status = 404;
    err.code = "NOTIFICATION_NOT_FOUND";
    throw err;
  }

  return notification;
}

/**
 * Register or update a device token for push notifications
 *
 * @param {string} userId User ID
 * @param {string} token FCM device token
 * @param {string} platform Platform: "android", "ios", or "web"
 * @param {string} deviceId Device ID
 * @param {string} deviceName Optional device information
 */
async function registerToken(
  userId,
  token,
  platform,
  deviceId,
  deviceName = null,
) {
  try {
    // Convert userId to ObjectId
    const userObjectId = new mongoose.Types.ObjectId(userId);

    // Check if a PushToken document already exists for this deviceId and user
    const existing = await PushToken.findOne({
      deviceId,
      "users.user": userObjectId,
    });

    // If already registered, skip
    if (existing) {
      console.log(
        `User ${userId} already registered on device ${deviceId} — skipping`,
      );
      return null;
    }

    // Upsert the PushToken document
    const result = await PushToken.findOneAndUpdate(
      { deviceId },
      {
        $set: {
          token,
          platform,
          deviceName,
          lastUsed: new Date(),
        },
        $setOnInsert: {
          createdAt: new Date(),
        },
        $addToSet: {
          users: {
            user: userObjectId,
            notificationActive: true,
          },
        },
      },
      {
        upsert: true,
        new: true,
        runValidators: true,
      },
    );

    return result;
  } catch (err) {
    console.error("registerToken error:", err);
    throw err;
  }
}

/**
 * Active or Inactive a specific push notification for specific device and user
 * @param {string} userId User ID
 * @param {string} deviceId Device ID
 */
async function activeOrInactivePushNotification(userId, deviceId) {
  try {
    // Convert userId to ObjectId
    const userObjectId = new mongoose.Types.ObjectId(userId);

    // Find the only the user sub document to get current status
    const tokenDoc = await PushToken.findOne(
      { deviceId, "users.user": userObjectId },
      { "users.$": 1 },
    );

    const currentStatus = tokenDoc?.users?.[0]?.notificationActive;

    if (!tokenDoc) {
      const err = new Error("Device not found for the user");
      err.status = 404;
      err.code = "DEVICE_OR_USER_NOT_FOUND";
      throw err;
    }

    // Update the notificationActive status for the specific user
    const updated = await PushToken.findOneAndUpdate(
      { deviceId, "users.user": userObjectId },
      { $set: { "users.$.notificationActive": !currentStatus } },
      { new: true },
    );

    if (!updated) {
      const err = new Error("Device or user not found");
      err.status = 404;
      err.code = "DEVICE_OR_USER_NOT_FOUND";
      throw err;
    }

    return updated;
  } catch (err) {
    console.error("toggle notification error:", err);
    throw err;
  }
}

module.exports = {
  sendToDevice,
  sendToMany,
  sendToUser,
  allNotifications,
  getNotificationById,
  registerToken,
  activeOrInactivePushNotification,
};
