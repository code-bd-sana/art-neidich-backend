const mongoose = require("mongoose");

const NotificationModel = require("../models/NotificationModel");
const NotificationToken = require("../models/NotificationTokenModel");
const {
  allNotifications,
  getNotificationById,
  activeOrInactivePushNotification: onOrOffPushNotification,
} = require("../services/NotificationServices");

/**
 * List notifications with optional filtering
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
const listNotifications = async (req, res, next) => {
  try {
    // Extract pagination parameters from validated request query
    const { limit = 50, page = 1 } = req.query;

    // Get user ID from authenticated request
    const userId = req.user._id;

    // Call service
    const { notifications, metaData } = await allNotifications(
      req.query,
      userId,
    );

    res.json({
      success: true,
      message: "Notification list fetched successfully",
      data: notifications,
      metaData: metaData,
      code: 200,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get a single notification by ID
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
const getNotification = async (req, res, next) => {
  try {
    // Extract notification ID from request parameters
    const { id } = req.params;

    // Get user ID from authenticated request
    const userId = req.user._id;

    // Call service
    const notification = await getNotificationById(id, userId);

    res.json({
      success: true,
      message: "Notification fetched successfully",
      data: notification,
      code: 200,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Active or Inactive a specific push notification for a device
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
const activeOrInactivePushNotification = async (req, res, next) => {
  try {
    // Extract device ID from validated request body
    const { deviceId } = req.validated;

    // Get user ID from authenticated request
    const userId = req.user._id;

    // Call service
    await onOrOffPushNotification(userId, deviceId);

    res.json({
      success: true,
      message: "Push notification active state toggled successfully",
      code: 200,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  listNotifications,
  getNotification,
  activeOrInactivePushNotification,
};
