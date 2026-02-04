const express = require("express");

const router = express.Router();

const {
  listNotifications,
  getNotification,
  activeOrInactivePushNotification,
  getNotificationState,
} = require("../controllers/NotificationControllers");
const { authenticate } = require("../middleware/auth");
const { validate } = require("../utils/validator");
const { mongoIdSchema } = require("../validators/common/mongoId");
const {
  notificationSchema,
  notificationPaginationSchema,
  registerPushTokenSchema,
  deviceIdSchema,
} = require("../validators/notification/notification");

// Apply authentication middleware to all routes in this router
router.use(authenticate);

/**
 * Get notifications list
 *
 * @route GET /api/v1/notification
 * Private route to get notifications
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
router.get(
  "/",
  validate(notificationPaginationSchema, { target: "query" }),
  listNotifications,
);

/**
 * Get user notification state
 *
 * GET /api/v1/notification/notification-state/:deviceId
 * Private route to get user notification state
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
router.get(
  "/notification-state/:deviceId",
  validate(deviceIdSchema, { target: "params" }),
  getNotificationState,
);

/**
 * Active or Inactive a push notification for specific device
 *
 * @route PUT /api/v1/notification/:deviceId
 * Private route to active and inactivate a push token
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
router.put(
  "/:deviceId",
  validate(deviceIdSchema, { target: "params" }),
  activeOrInactivePushNotification,
);

/**
 * Get a single notification by ID
 *
 * @route GET /api/v1/notification/:id
 * Private route to get a notification by ID
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
router.get(
  "/:id",
  validate(mongoIdSchema, { target: "params" }),
  getNotification,
);

module.exports = router;
