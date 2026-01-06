// notification.js
// Notification controller for handling notification-related routes
const NotificationServices = require("../services/NotificationServices");

const sendToDevice = async (req, res, next) => {
  try {
    const { deviceToken, payload } = req.body;
    await NotificationServices.sendToDevice(deviceToken, payload);
    res.status(200).json({ message: "Notification sent to device" });
  } catch (err) {
    next(err);
  }
};

const sendToMany = async (req, res, next) => {
  try {
    const { deviceTokens, payload } = req.body;
    await NotificationServices.sendToMany(deviceTokens, payload);
    res.status(200).json({ message: "Notification sent to devices" });
  } catch (err) {
    next(err);
  }
};

const sendToUser = async (req, res, next) => {
  try {
    const { userId, payload } = req.body;
    await NotificationServices.sendToUser(userId, payload);
    res.status(200).json({ message: "Notification sent to user" });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  sendToDevice,
  sendToMany,
  sendToUser,
};
