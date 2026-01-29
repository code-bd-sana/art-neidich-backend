const mongoose = require("mongoose");

const NotificationModel = require("../models/NotificationModel");
const NotificationToken = require("../models/NotificationTokenModel");
const NotificationServices = require("../services/NotificationServices");
/**
 * Toggle notification preference for a user
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
const notificationToggle = async (req, res, next) => {
  try {
    // Extract enable flag from validated request body
    const { enable } = req.validated;

    // Get user ID from authenticated request
    const userId = req.user._id;

    // Update or create notification token document
    let tokenDoc = await NotificationToken.findOne({
      user: new mongoose.Types.ObjectId(userId),
    });

    // If no document exists, create a new one
    if (!tokenDoc) {
      // Create a new notification token document for the user
      tokenDoc = new NotificationToken({
        user: new mongoose.Types.ObjectId(userId),
        enable,
      });
    } else {
      // Update the existing document's enable field
      tokenDoc.enable = enable;
    }

    // Save the document
    await tokenDoc.save();

    res
      .status(200)
      .json({ success: true, message: "Notification preference updated" });
  } catch (err) {
    next(err);
  }
};

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

    // Validate user ID presence
    if (!userId) return res.status(400).json({ message: "userId is required" });

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

    res.status(200).json({
      success: true,
      notifications: docs,
      metaData: {
        page,
        limit,
        totalNotifications,
        totalPage: Math.ceil(totalNotifications / limit),
      },
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
    if (!doc) return res.status(404).json({ message: "not found" });

    res.status(200).json({ success: true, notification: doc });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  notificationToggle,
  listNotifications,
  getNotification,
};
