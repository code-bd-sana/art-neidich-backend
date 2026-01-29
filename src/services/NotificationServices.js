const path = require("path");

const admin = require("firebase-admin");
const mongoose = require("mongoose");

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
  if (!deviceToken) throw new Error("deviceToken is required");
  const message = buildMessage(deviceToken, payload);
  return admin.messaging().send(message);
}

/**
 * Send a push notification to multiple devices
 * @param {string[]} deviceTokens Array of FCM device tokens
 * @param {object} payload Notification payload
 */
async function sendToMany(deviceTokens = [], payload = {}) {
  if (!Array.isArray(deviceTokens)) deviceTokens = [deviceTokens];
  const tokens = deviceTokens.filter(Boolean);
  if (!tokens.length) return { warning: "no-tokens" };

  // FCM sendMulticast supports up to 500 tokens per request
  const chunkSize = 500;
  const results = {
    successCount: 0,
    failureCount: 0,
    responses: [],
  };

  for (let i = 0; i < tokens.length; i += chunkSize) {
    const chunk = tokens.slice(i, i + chunkSize);
    const multicast = buildMulticast(chunk, payload);
    const resp = await admin.messaging().sendMulticast(multicast);
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
  if (!userId) throw new Error("userId is required");
  // find active tokens for user
  const docs = await PushToken.find({
    user: new mongoose.Types.ObjectId(userId),
    active: true,
  }).select("token -_id");
  const tokens = (docs || []).map((d) => d.token).filter(Boolean);
  if (!tokens.length) return { warning: "no-tokens-for-user" };
  return sendToMany(tokens, payload);
}

/**
 * Build a message object for a single device
 * @param {string} deviceToken FCM device token
 * @param {object} payload Notification payload
 */
function buildMessage(deviceToken, payload) {
  const { title, body, data } = payload || {};
  const message = {
    token: deviceToken,
    notification: {},
  };
  if (title) message.notification.title = title;
  if (body) message.notification.body = body;
  if (data && typeof data === "object") {
    // FCM data values must be strings
    message.data = Object.fromEntries(
      Object.entries(data).map(([k, v]) => [k, String(v)]),
    );
  }
  return message;
}

/**
 * Build a multicast message object for multiple devices
 * @param {string[]} tokens Array of FCM device tokens
 * @param {object} payload Notification payload
 */
function buildMulticast(tokens, payload) {
  const { title, body, data } = payload || {};
  const message = {
    tokens,
    notification: {},
  };
  if (title) message.notification.title = title;
  if (body) message.notification.body = body;
  if (data && typeof data === "object") {
    message.data = Object.fromEntries(
      Object.entries(data).map(([k, v]) => [k, String(v)]),
    );
  }
  return message;
}

/**
 * Register or update a push token for a user
 * Handles multiple devices per user by using upsert logic
 * @param {string} userId User ID
 * @param {string} token FCM device token
 * @param {string} platform Platform: "android", "ios", or "web"
 * @param {string} deviceInfo Optional device information
 */
async function registerToken(userId, token, platform, deviceInfo = null) {
  const result = await PushToken.findOneAndUpdate(
    { token }, // Find by token
    {
      $set: {
        user: new mongoose.Types.ObjectId(userId),
        platform,
        deviceInfo,
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
 * Active or Inactive a specific push token
 * @param {string} token FCM device token
 */
async function activeOrInactivePushToken(token) {
  const currentToken = await PushToken.findOne({ token });
  if (!currentToken) {
    const err = new Error("Push token not found");
    err.status = 404;
    err.code = "PUSH_TOKEN_NOT_FOUND";
    throw err;
  }
  const currentActiveState = currentToken.active;
  const result = await PushToken.findOneAndUpdate(
    { token },
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
  return await PushToken.find({
    user: new mongoose.Types.ObjectId(userId),
    active: true,
  });
}

module.exports = {
  sendToDevice,
  sendToMany,
  sendToUser,
  registerToken,
  activeOrInactivePushToken,
  getUserTokens,
};
