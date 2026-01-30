const mongoose = require("mongoose");

const NotificationModel = require("../models/NotificationModel");
const NotificationToken = require("../models/NotificationTokenModel");
const NotificationServices = require("../services/NotificationServices");

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

    // Fetch notifications using the service
    const { notifications, metaData } =
      await NotificationServices.listNotifications(req.query, userId);

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

    // Fetch the notification document by ID
    const notification = await NotificationServices.getNotificationById(
      id,
      userId,
    );

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
 * Register a push token for the authenticated user
 * Supports multiple devices per user
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
const registerPushToken = async (req, res, next) => {
  try {
    // Extract token details from validated request body
    const { token, platform, deviceId, deviceName } = req.validated;

    // Get user ID from authenticated request
    const userId = req.user._id;

    // Register or update the token
    const result = await NotificationServices.registerToken(
      userId,
      token,
      platform,
      deviceId,
      deviceName,
    );

    res.json({
      success: true,
      message: "Push token registered successfully",
      data: result,
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
    const { deviceId } = req.validated;

    await NotificationServices.activeOrInactivePushNotification(deviceId);
    res.json({
      success: true,
      message: "Push notification active state toggled successfully",
      code: 200,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get all active tokens for the authenticated user
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
const getUserPushTokens = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const tokens = await NotificationServices.getUserTokens(userId);

    res.json({
      success: true,
      message: "User push tokens fetched successfully",
      data: tokens,
      count: tokens.length,
      code: 200,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  listNotifications,
  getNotification,
  registerPushToken,
  activeOrInactivePushNotification,
  getUserPushTokens,
};
