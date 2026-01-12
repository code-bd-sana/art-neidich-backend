// notification.js
// Notification routes
const express = require("express");

const router = express.Router();
const NotificationControllers = require("../controllers/NotificationControllers");

router.post("/send/device", NotificationControllers.sendToDevice);
router.post("/send/many", NotificationControllers.sendToMany);
router.post("/send/user", NotificationControllers.sendToUser);
// Token registration for clients (Flutter/web/mobile)
router.post("/register", NotificationControllers.registerToken);

// Create and store a notification (and attempt to send)
router.post("/create", NotificationControllers.createNotification);

// List and get notifications
router.get("/", NotificationControllers.listNotifications);
router.get("/:id", NotificationControllers.getNotification);

module.exports = router;
