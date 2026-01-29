const express = require("express");

const router = express.Router();

const {
  notificationToggle,
  listNotifications,
  getNotification,
  registerPushToken,
  deactivatePushToken,
  getUserPushTokens,
} = require("../controllers/NotificationControllers");
const { authenticate } = require("../middleware/auth");
const { validate } = require("../utils/validator");
const { mongoIdSchema } = require("../validators/common/mongoId");
const {
  notificationSchema,
  notificationPaginationSchema,
  registerPushTokenSchema,
  deactivatePushTokenSchema,
} = require("../validators/notification/notification");

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

/**
 * Register a push token for the authenticated user
 *
 * @route POST /api/v1/notification/token
 * Private route to register a push token
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
router.post(
  "/token",
  validate(registerPushTokenSchema, { target: "body" }),
  registerPushToken,
);

/**
 * Deactivate a push token
 *
 * @route PUT /api/v1/notification/token
 * Private route to deactivate a push token
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
router.put(
  "/token",
  validate(deactivatePushTokenSchema, { target: "body" }),
  deactivatePushToken,
);

/**
 * Get all active push tokens for the authenticated user
 *
 * @route GET /api/v1/notification/tokens
 * Private route to get user's active push tokens
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
router.get("/tokens", getUserPushTokens);

module.exports = router;
