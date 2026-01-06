// notification.js
// Notification routes
const express = require("express");

const router = express.Router();
const NotificationControllers = require("../controllers/NotificationControllers");

router.post("/send/device", NotificationControllers.sendToDevice);
router.post("/send/many", NotificationControllers.sendToMany);
router.post("/send/user", NotificationControllers.sendToUser);

module.exports = router;
