const express = require("express");

const router = express.Router();

const {
  notificationToggle,
  listNotifications,
  getNotification,
} = require("../controllers/NotificationControllers");
const { authenticate } = require("../middleware/auth");
const { validate } = require("../utils/validator");
const { mongoIdSchema } = require("../validators/common/mongoId");
const {
  notificationSchema,
  notificationPaginationSchema,
} = require("../validators/notification/notification");

// Apply authentication middleware to ALL routes in this router
router.use(authenticate);

/**
 * Handle push notification on/off
 *
 * @route PUT /api/v1/notification
 * Private route to toggle push notifications
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
router.put(
  "/",
  validate(notificationSchema, { target: "body" }),
  notificationToggle,
);

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

module.exports = router;
