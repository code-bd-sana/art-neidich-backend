const dotenv = require("dotenv");
const admin = require("firebase-admin");
const mongoose = require("mongoose");

const NotificationModel = require("../models/NotificationModel");
const NotificationToken = require("../models/NotificationTokenModel");
const PushToken = require("../models/PushToken");

dotenv.config();

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
    // Build service account from individual env variables
    const serviceAccount = {
      type: process.env.FIREBASE_TYPE,
      project_id: process.env.FIREBASE_PROJECT_ID,
      private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
      private_key: process.env.FIREBASE_PRIVATE_KEY,
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      client_id: process.env.FIREBASE_CLIENT_ID,
      auth_uri: process.env.FIREBASE_AUTH_URI,
      token_uri: process.env.FIREBASE_TOKEN_URI,
      auth_provider_x509_cert_url:
        process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL,
      client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL,
      universe_domain: process.env.FIREBASE_UNIVERSE_DOMAIN,
    };

    if (!serviceAccount.project_id) {
      throw new Error("Firebase credentials not found in .env");
    }

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id,
    });
    initialized = true;
    console.log(
      "[NotificationService] initFirebase: initialized with .env service account",
    );
  } catch (err) {
    console.warn(
      "[NotificationService] initFirebase: failed to initialize with .env, trying Application Default Credentials",
      err?.message,
    );
    try {
      admin.initializeApp();
      initialized = true;
      console.log(
        "[NotificationService] initFirebase: initialized with default credentials",
      );
    } catch (e) {
      console.error(
        "[NotificationService] initFirebase: failed to initialize firebase",
        e?.message || e,
      );
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
      {
        recipients: {
          $in: [new mongoose.Types.ObjectId(userId)],
        },
      },
      { recipient: new mongoose.Types.ObjectId(userId) },
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
 * Get user notification state for a specific device
 *
 * @param {string} userId User ID
 * @param {string} deviceId Device ID
 * @returns {object} Notification state object
 */
async function getNotificationState(userId, deviceId) {
  // Convert userId to ObjectId
  const userObjectId = new mongoose.Types.ObjectId(userId);

  const result = await NotificationToken.aggregate([
    // Match by device
    {
      $match: {
        deviceId: deviceId,
        "users.user": userObjectId,
      },
    },
    // Unwind users array
    {
      $unwind: "$users",
    },
    // Match only the required user
    {
      $match: {
        "users.user": userObjectId,
      },
    },
    // Project only required fields
    {
      $project: {
        _id: 0,
        deviceId: 1,
        notificationActive: "$users.notificationActive",
      },
    },
  ]);

  // If not found, throw error
  if (!result || result.length === 0) {
    const err = new Error("Notification state not found");
    err.status = 404;
    err.code = "NOTIFICATION_STATE_NOT_FOUND";
    throw err;
  }

  return result[0];
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
      {
        recipients: {
          $in: [new mongoose.Types.ObjectId(userId)],
        },
      },
      { recipient: new mongoose.Types.ObjectId(userId) },
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

    return {
      deviceId: updated.deviceId,
      notificationActive: !currentStatus,
    };
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
  getNotificationState,
  getNotificationById,
  activeOrInactivePushNotification,
};
