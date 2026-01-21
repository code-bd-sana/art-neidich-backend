const path = require("path");

const admin = require("firebase-admin");

const PushToken = require("../models/PushToken");

// Initialize firebase-admin once
let initialized = false;
function initFirebase() {
  if (initialized) return;
  try {
    // Try to load local service account JSON in repo root
    const saPath = path.resolve(
      process.cwd(),
      "testing-project-20a99-firebase-adminsdk-fbsvc-17c0fcd65c.json",
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

async function sendToDevice(deviceToken, payload = {}) {
  if (!deviceToken) throw new Error("deviceToken is required");
  const message = buildMessage(deviceToken, payload);
  return admin.messaging().send(message);
}

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

async function sendToUser(userId, payload = {}) {
  if (!userId) throw new Error("userId is required");
  // find active tokens for user
  const docs = await PushToken.find({ user: userId, active: true }).select(
    "token -_id",
  );
  const tokens = (docs || []).map((d) => d.token).filter(Boolean);
  if (!tokens.length) return { warning: "no-tokens-for-user" };
  return sendToMany(tokens, payload);
}

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

module.exports = {
  sendToDevice,
  sendToMany,
  sendToUser,
};
