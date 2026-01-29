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
    const { enable } = req.validated;
    const userId = req.user._id;
    let tokenDoc = await NotificationToken.findOne({ userId });
    if (!tokenDoc) {
      tokenDoc = new NotificationToken({ userId, enable });
    } else {
      tokenDoc.enable = enable;
    }
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
    const { limit = 50, page = 1 } = req.query;
    const userId = req.user._id;
    if (!userId) return res.status(400).json({ message: "userId is required" });

    const q = {
      $or: [{ recipients: userId }, { authorId: userId }],
    };

    const docs = await NotificationModel.find(q)
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));

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
    const { id } = req.params;
    const doc = await NotificationModel.findById(id);
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
