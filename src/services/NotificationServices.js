// NotificationServices.js
// Centralized service for sending push notifications
// Implements Firebase Cloud Messaging (FCM) when available and
// falls back to a dummy logger for development / missing deps.

const fs = require("fs");
let admin = null;
let hasFCM = false;
try {
  // try to require firebase-admin (optional dependency)
  admin = require("firebase-admin");
  // try to initialize using service account JSON if present in project root
  const svcPath = `${process.cwd()}/testing-project-20a99-firebase-adminsdk-fbsvc-17c0fcd65c.json`;
  if (fs.existsSync(svcPath)) {
    try {
      const serviceAccount = require(svcPath);
      if (!admin.apps.length) {
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
        });
      }
      hasFCM = true;
    } catch (e) {
      // initialization failed — keep hasFCM false but continue
      console.warn("FCM init failed:", e.message);
      hasFCM = !!admin.apps.length;
    }
  } else {
    // if no service account, check if an app is already initialized elsewhere
    hasFCM = !!admin.apps.length;
  }
} catch (e) {
  // firebase-admin not installed — we'll use dummy
  admin = null;
  hasFCM = false;
}

const NotificationToken = require("../models/NotificationTokenModel");

class NotificationServices {
  async sendToDevice(deviceToken, payload = {}) {
    if (!deviceToken) throw new Error("deviceToken is required");
    const message = buildMessageForToken(deviceToken, payload);
    if (hasFCM && admin && admin.messaging) {
      try {
        const resp = await admin.messaging().send(message);
        return { success: true, provider: "fcm", result: resp };
      } catch (err) {
        console.error("FCM sendToDevice error:", err.message || err);
        throw err;
      }
    }

    // Dummy fallback: log and return a mock response
    console.info(
      "[NotificationServices - mock] sendToDevice",
      deviceToken,
      payload
    );
    return {
      success: true,
      provider: "mock",
      result: { messageId: `mock-${Date.now()}` },
    };
  }

  async sendToMany(deviceTokens = [], payload = {}) {
    if (!Array.isArray(deviceTokens) || deviceTokens.length === 0) {
      throw new Error("deviceTokens must be a non-empty array");
    }

    if (hasFCM && admin && admin.messaging) {
      try {
        const messages = deviceTokens.map((token) =>
          buildMessageForToken(token, payload)
        );
        // use sendAll for batching
        const resp = await admin.messaging().sendAll(messages);
        return { success: true, provider: "fcm", result: resp };
      } catch (err) {
        console.error("FCM sendToMany error:", err.message || err);
        throw err;
      }
    }

    // Dummy fallback
    console.info(
      "[NotificationServices - mock] sendToMany",
      deviceTokens.length,
      "tokens",
      payload
    );
    const results = deviceTokens.map((t) => ({
      token: t,
      messageId: `mock-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    }));
    return {
      success: true,
      provider: "mock",
      result: { successCount: deviceTokens.length, results },
    };
  }

  async sendToUser(userId, payload = {}) {
    if (!userId) throw new Error("userId is required");
    // lookup tokens for the user (optional model). If model isn't present or no tokens, fallback to mock
    try {
      const tokens = await NotificationToken.find({ userId }).select(
        "deviceToken -_id"
      );
      const deviceTokens = (tokens || [])
        .map((t) => t.deviceToken)
        .filter(Boolean);
      if (deviceTokens.length === 0) {
        console.info(
          "No device tokens found for user, mocking sendToUser",
          userId,
          payload
        );
        return {
          success: true,
          provider: "mock",
          result: { message: "no-tokens" },
        };
      }
      return await this.sendToMany(deviceTokens, payload);
    } catch (err) {
      // If model lookup fails, still attempt mock
      console.warn(
        "Notification token lookup failed, falling back to mock:",
        err.message || err
      );
      return {
        success: true,
        provider: "mock",
        result: { message: "lookup-failed" },
      };
    }
  }
}

function buildMessageForToken(token, payload = {}) {
  const message = { token };
  const { title, body, data } = payload || {};
  if (title || body) {
    message.notification = { title: title || "", body: body || "" };
  }
  if (data && typeof data === "object") {
    // FCM data values must be strings
    message.data = Object.fromEntries(
      Object.entries(data).map(([k, v]) => [k, String(v)])
    );
  }
  return message;
}

module.exports = new NotificationServices();
