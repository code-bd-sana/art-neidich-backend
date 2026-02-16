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

function initFirebase() {
  if (initialized) return;

  const LOG_PREFIX = "[NotificationService][INIT]";
  console.log(`${LOG_PREFIX} Starting Firebase initialization`);

  // ─── Debug: Show exactly what we received ───────────────────────────────
  console.log(
    `${LOG_PREFIX} FIREBASE_PROJECT_ID:`,
    process.env.FIREBASE_PROJECT_ID || "MISSING",
  );
  console.log(
    `${LOG_PREFIX} FIREBASE_CLIENT_EMAIL:`,
    process.env.FIREBASE_CLIENT_EMAIL || "MISSING",
  );
  console.log(
    `${LOG_PREFIX} FIREBASE_PRIVATE_KEY length:`,
    process.env.FIREBASE_PRIVATE_KEY?.length || "MISSING",
  );
  console.log(
    `${LOG_PREFIX} FIREBASE_PRIVATE_KEY first 80 chars:`,
    process.env.FIREBASE_PRIVATE_KEY?.substring(0, 80) || "MISSING",
  );
  console.log(
    `${LOG_PREFIX} Contains literal \\n:`,
    process.env.FIREBASE_PRIVATE_KEY?.includes("\\n") || false,
  );
  console.log(
    `${LOG_PREFIX} Contains real newline:`,
    process.env.FIREBASE_PRIVATE_KEY?.includes("\n") || false,
  );
  console.log(
    `${LOG_PREFIX} Starts with {"key":`,
    process.env.FIREBASE_PRIVATE_KEY?.startsWith('{"key":') || false,
  );

  try {
    let privateKey = process.env.FIREBASE_PRIVATE_KEY || "";

    // Handle the JSON-wrapped format we recommended for Render
    if (privateKey.startsWith('{"key":')) {
      try {
        const parsed = JSON.parse(privateKey);
        privateKey = parsed.key;
        console.log(`${LOG_PREFIX} Successfully parsed JSON-wrapped key`);
      } catch (parseErr) {
        console.error(
          `${LOG_PREFIX} JSON parse failed for wrapped key:`,
          parseErr.message,
        );
        // continue with fallback cleaning anyway
      }
    }

    // Aggressive cleaning – covers most Render / platform issues
    privateKey = privateKey
      .replace(/\\n/g, "\n") // literal \n → real newline
      .replace(/\\r/g, "") // remove \r if present
      .replace(/\r/g, "") // just in case
      .replace(/^["']|["']$/g, "") // remove wrapping quotes if any
      .replace(/^key:/, "") // in case someone pasted "key:-----..."
      .trim();

    // Basic validation
    if (
      !privateKey.includes("-----BEGIN PRIVATE KEY-----") ||
      !privateKey.includes("-----END PRIVATE KEY-----")
    ) {
      throw new Error(
        "Private key does not contain valid PEM markers after cleaning",
      );
    }

    if (
      !process.env.FIREBASE_PROJECT_ID ||
      !process.env.FIREBASE_CLIENT_EMAIL
    ) {
      throw new Error("Missing projectId or clientEmail");
    }

    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: privateKey,
      }),
    });

    initialized = true;
    console.log(`${LOG_PREFIX} Firebase Admin SDK initialized SUCCESSFULLY`);
  } catch (err) {
    console.error(`${LOG_PREFIX} Initialization FAILED:`, err.message || err);
    console.error(
      `${LOG_PREFIX} Stack:`,
      err.stack?.substring(0, 300) || "no stack",
    );

    // Optional ADC fallback (only useful if deployed on Google Cloud)
    try {
      admin.initializeApp();
      initialized = true;
      console.log(
        `${LOG_PREFIX} Fallback to Application Default Credentials succeeded`,
      );
    } catch (fallbackErr) {
      console.error(
        `${LOG_PREFIX} ADC fallback also failed:`,
        fallbackErr.message,
      );
      console.error(
        "FIREBASE MESSAGING WILL NOT WORK UNTIL CREDENTIALS ARE FIXED",
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

async function sendToDevice(deviceToken, payload = {}) {
  if (!initialized)
    throw new Error("Firebase not initialized – cannot send notification");

  if (!deviceToken) {
    throw Object.assign(new Error("Device token is required"), {
      code: "DEVICE_TOKEN_REQUIRED",
    });
  }

  const message = buildMessage(deviceToken, payload);

  try {
    const response = await admin.messaging().send(message);
    log("sendToDevice success", { messageId: response });
    return response;
  } catch (err) {
    logError("sendToDevice failed", err.message || err);
    throw err;
  }
}

async function sendToMany(deviceTokens = [], payload = {}) {
  if (!initialized) {
    logError("sendToMany: Firebase not initialized");
    return {
      successCount: 0,
      failureCount: Array.isArray(deviceTokens) ? deviceTokens.length : 1,
      error: "firebase-not-initialized",
    };
  }

  const tokens = Array.isArray(deviceTokens)
    ? deviceTokens.filter(Boolean)
    : [deviceTokens].filter(Boolean);

  if (tokens.length === 0) {
    return { successCount: 0, failureCount: 0, warning: "no-valid-tokens" };
  }

  const results = { successCount: 0, failureCount: 0, responses: [] };
  const chunkSize = 500;

  for (let i = 0; i < tokens.length; i += chunkSize) {
    const chunk = tokens.slice(i, i + chunkSize);
    const multicastMessage = buildMulticast(chunk, payload);

    try {
      const resp = await admin
        .messaging()
        .sendEachForMulticast(multicastMessage);
      results.successCount += resp.successCount;
      results.failureCount += resp.failureCount;
      results.responses.push(resp);

      // Clean up unregistered tokens
      resp.responses.forEach((r, idx) => {
        if (
          !r.success &&
          r.error?.code === "messaging/registration-token-not-registered"
        ) {
          const badToken = chunk[idx];
          PushToken.deleteOne({ token: badToken }).catch((e) =>
            logError("Failed to delete invalid token", badToken, e.message),
          );
        }
      });
    } catch (err) {
      logError(
        `sendToMany chunk ${Math.floor(i / chunkSize)} failed`,
        err.message || err,
      );
      results.failureCount += chunk.length;
    }
  }

  log("sendToMany completed", {
    totalTokens: tokens.length,
    success: results.successCount,
    failed: results.failureCount,
  });

  return results;
}

async function sendToUser(userId, payload = {}) {
  if (!userId) throw new Error("User ID is required");

  const docs = await PushToken.find({
    users: { $in: [new mongoose.Types.ObjectId(userId)] },
    active: true,
  })
    .select("token -_id")
    .lean();

  const tokens = docs.map((d) => d.token);

  if (tokens.length === 0) {
    return {
      successCount: 0,
      failureCount: 0,
      warning: "no-active-tokens-for-user",
    };
  }

  return sendToMany(tokens, payload);
}

// ────────────────────────────────────────────────
// Message builders
// ────────────────────────────────────────────────

function buildMessage(token, payload = {}) {
  const { title, body, data, imageUrl } = payload;
  const message = { token, notification: {} };

  if (title) message.notification.title = title;
  if (body) message.notification.body = body;
  if (imageUrl) message.notification.image = imageUrl; // note: correct property is "image"

  if (data && typeof data === "object" && data !== null) {
    message.data = Object.fromEntries(
      Object.entries(data).map(([k, v]) => [k, String(v)]),
    );
  }

  return message;
}

function buildMulticast(tokens, payload = {}) {
  const { title, body, data, imageUrl } = payload;
  const message = { tokens, notification: {} };

  if (title) message.notification.title = title;
  if (body) message.notification.body = body;
  if (imageUrl) message.notification.image = imageUrl;

  if (data && typeof data === "object" && data !== null) {
    message.data = Object.fromEntries(
      Object.entries(data).map(([k, v]) => [k, String(v)]),
    );
  }

  return message;
}

// ────────────────────────────────────────────────
// Other functions (unchanged)
// ────────────────────────────────────────────────

async function allNotifications(query = {}, userId) {
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 10;

  const q = {
    $or: [
      { recipients: { $in: [new mongoose.Types.ObjectId(userId)] } },
      { recipient: new mongoose.Types.ObjectId(userId) },
      { authorId: new mongoose.Types.ObjectId(userId) },
    ],
  };

  const notifications = await NotificationModel.find(q)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .select("_id title body type data authorId createdAt");

  const total = await NotificationModel.countDocuments(q);

  return {
    notifications,
    metaData: {
      page,
      limit,
      totalNotifications: total,
      totalPage: Math.ceil(total / limit),
    },
  };
}

async function getNotificationState(userId, deviceId) {
  const userObjectId = new mongoose.Types.ObjectId(userId);

  const result = await NotificationToken.aggregate([
    { $match: { deviceId, "users.user": userObjectId } },
    { $unwind: "$users" },
    { $match: { "users.user": userObjectId } },
    {
      $project: {
        _id: 0,
        deviceId: 1,
        notificationActive: "$users.notificationActive",
      },
    },
  ]);

  if (result.length === 0) {
    throw Object.assign(new Error("Notification state not found"), {
      status: 404,
      code: "NOT_FOUND",
    });
  }

  return result[0];
}

async function getNotificationById(notificationId, userId) {
  const notification = await NotificationModel.findOne({
    _id: new mongoose.Types.ObjectId(notificationId),
    $or: [
      { recipients: { $in: [new mongoose.Types.ObjectId(userId)] } },
      { recipient: new mongoose.Types.ObjectId(userId) },
      { authorId: new mongoose.Types.ObjectId(userId) },
    ],
  }).select("_id title body type data createdAt");

  if (!notification) {
    throw Object.assign(new Error("Notification not found"), {
      status: 404,
      code: "NOT_FOUND",
    });
  }

  return notification;
}

async function activeOrInactivePushNotification(userId, deviceId) {
  const userObjectId = new mongoose.Types.ObjectId(userId);

  const tokenDoc = await PushToken.findOne(
    { deviceId, "users.user": userObjectId },
    { "users.$": 1 },
  );

  if (!tokenDoc?.users?.[0]) {
    throw Object.assign(new Error("Device/user not found"), { status: 404 });
  }

  const current = tokenDoc.users[0].notificationActive;

  const updated = await PushToken.findOneAndUpdate(
    { deviceId, "users.user": userObjectId },
    { $set: { "users.$.notificationActive": !current } },
    { new: true },
  );

  return {
    deviceId: updated.deviceId,
    notificationActive: !current,
  };
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
