// notification.js
// Notification controller for handling notification-related routes
const NotificationModel = require("../models/NotificationModel");
const NotificationToken = require("../models/NotificationTokenModel");
const NotificationServices = require("../services/NotificationServices");

const sendToDevice = async (req, res, next) => {
  try {
    const { deviceToken, payload } = req.body;
    const result = await NotificationServices.sendToDevice(
      deviceToken,
      payload
    );
    res.status(200).json({ message: "Notification sent to device", result });
  } catch (err) {
    next(err);
  }
};

const sendToMany = async (req, res, next) => {
  try {
    const { deviceTokens, payload } = req.body;
    const result = await NotificationServices.sendToMany(deviceTokens, payload);
    res.status(200).json({ message: "Notification sent to devices", result });
  } catch (err) {
    next(err);
  }
};

const sendToUser = async (req, res, next) => {
  try {
    const { userId, payload } = req.body;
    const result = await NotificationServices.sendToUser(userId, payload);
    res.status(200).json({ message: "Notification sent to user", result });
  } catch (err) {
    next(err);
  }
};

// Register or update a device token for a user
const registerToken = async (req, res, next) => {
  try {
    const { userId, deviceToken, platform } = req.body;
    if (!userId || !deviceToken)
      return res
        .status(400)
        .json({ message: "userId and deviceToken are required" });

    await NotificationToken.findOneAndUpdate(
      { userId, deviceToken },
      { userId, deviceToken, platform },
      { upsert: true, new: true }
    );

    res.json({ success: true, message: "token registered" });
  } catch (err) {
    next(err);
  }
};

// Create a notification record and attempt to send it
const createNotification = async (req, res, next) => {
  try {
    const {
      title,
      body,
      data,
      recipients = [],
      deviceTokens = [],
      type = "custom",
      authorId,
    } = req.body;
    if (!title) return res.status(400).json({ message: "title is required" });

    // Save notification to DB (status pending)
    const notification = await NotificationModel.create({
      title,
      body,
      data,
      type,
      authorId,
      recipients,
      deviceTokens,
      status: "pending",
    });

    // Resolve device tokens from recipient userIds
    let resolvedTokens = Array.isArray(deviceTokens) ? [...deviceTokens] : [];
    if (Array.isArray(recipients) && recipients.length) {
      const tokens = await NotificationToken.find({
        userId: { $in: recipients },
      }).select("deviceToken -_id");
      const fromUsers = (tokens || [])
        .map((t) => t.deviceToken)
        .filter(Boolean);
      resolvedTokens = resolvedTokens.concat(fromUsers);
    }

    // Deduplicate
    resolvedTokens = Array.from(new Set(resolvedTokens));

    // Attempt send
    let sendResult = null;
    try {
      if (resolvedTokens.length) {
        sendResult = await NotificationServices.sendToMany(resolvedTokens, {
          title,
          body,
          data,
        });
      } else if (Array.isArray(recipients) && recipients.length === 1) {
        // single recipient fallback
        sendResult = await NotificationServices.sendToUser(recipients[0], {
          title,
          body,
          data,
        });
      } else {
        // nothing to send
        sendResult = { warning: "no-targets" };
      }

      notification.status = "sent";
      notification.result = sendResult;
      notification.sentAt = new Date();
      await notification.save();
    } catch (sendErr) {
      notification.status = "failed";
      notification.result = { error: sendErr.message || String(sendErr) };
      await notification.save();
    }

    res.status(201).json({ success: true, notification });
  } catch (err) {
    next(err);
  }
};

// List notifications for a user (query param `userId`)
const listNotifications = async (req, res, next) => {
  try {
    const { userId, limit = 50, page = 1 } = req.query;
    if (!userId) return res.status(400).json({ message: "userId is required" });

    const q = {
      $or: [{ recipients: userId }, { authorId: userId }],
    };

    const docs = await NotificationModel.find(q)
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));

    res.json({ success: true, notifications: docs });
  } catch (err) {
    next(err);
  }
};

const getNotification = async (req, res, next) => {
  try {
    const { id } = req.params;
    const doc = await NotificationModel.findById(id);
    if (!doc) return res.status(404).json({ message: "not found" });
    res.json({ success: true, notification: doc });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  sendToDevice,
  sendToMany,
  sendToUser,
  registerToken,
  createNotification,
  listNotifications,
  getNotification,
};
