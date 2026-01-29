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

    // Build query to fetch notifications for the user
    const q = {
      $or: [
        { recipients: new mongoose.Types.ObjectId(userId) },
        { authorId: new mongoose.Types.ObjectId(userId) },
      ],
    };

    // Fetch notifications with pagination
    const docs = await NotificationModel.find(q)
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));

    // Get total count for pagination metadata
    const totalNotifications = await NotificationModel.countDocuments(q);

    res.json({
      success: true,
      message: "Notification list fetched successfully",
      data: docs,
      metaData: {
        page,
        limit,
        totalNotifications,
        totalPage: Math.ceil(totalNotifications / limit),
      },
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
    const doc = await NotificationModel.findOne({
      _id: new mongoose.Types.ObjectId(id),
      $or: [
        { recipients: new mongoose.Types.ObjectId(userId) },
        { authorId: new mongoose.Types.ObjectId(userId) },
      ],
    });

    // If not found, return 404
    if (!doc) {
      const err = new Error("Notification not found");
      err.status = 400;
      err.code = "NOTIFICATION_NOT_FOUND";
      throw err;
    }

    res.json({
      success: true,
      message: "Notification fetched successfully",
      data: doc,
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
    const { token, platform, deviceInfo } = req.validated;

    // Get user ID from authenticated request
    const userId = req.user._id;

    // Register or update the token
    const result = await NotificationServices.registerToken(
      userId,
      token,
      platform,
      deviceInfo,
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
 * Deactivate a specific push token
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
const deactivatePushToken = async (req, res, next) => {
  try {
    const { token } = req.validated;

    await NotificationServices.deactivateToken(token);

    res.json({
      success: true,
      message: "Push token deactivated successfully",
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
  deactivatePushToken,
  getUserPushTokens,
};
