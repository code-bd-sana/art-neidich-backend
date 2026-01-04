const express = require("express");

const router = express.Router();

const {
  getUserProfileController,
  updateUserProfileController,
  getAllUsersController,
  getUserByIdController,
  approveUserController,
  suspendUserController,
  unSuspendUserController,
  deleteUserController,
} = require("../controllers/UserControllers");
const { authenticate, authorizeRoles } = require("../middleware/auth");
const { validate } = require("../utils/validator");
const { mongoIdSchema } = require("../validators/common/mongoId");
const {
  searchAndPaginationSchema,
} = require("../validators/common/searchAndPagination");
const { roleSchema } = require("../validators/user/role");
const { updateUserSchema } = require("../validators/user/updateUser");

// Apply authentication middleware to ALL routes in this router
router.use(authenticate);

/**
 * Get logged-in user's profile
 *
 * @route GET /api/v1/user/profile
 * Private route
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
router.get("/profile", getUserProfileController);

/**
 * Update logged-in user's profile
 * 
 * @route PUT /api/v1/user/profile
 * Private route
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
router.put(
  "/profile",
  validate(updateUserSchema, { target: "body" }),
  updateUserProfileController
);

/**
 * Get all users (root and admin only)
 *
 * @route GET /api/v1/user
 * Private route
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
router.get(
  "/",
  authorizeRoles(0, 1), // Only root (0) and admin (1) can access
  validate(searchAndPaginationSchema, { target: "query" }),
  validate(roleSchema, { target: "query" }),
  getAllUsersController
);

/**
 * Get user by ID (root and admin only)
 *
 * @route GET /api/v1/user/:id
 * Private route
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
router.get(
  "/:id",
  authorizeRoles(0, 1), // Only root (0) and admin (1) can access
  validate(mongoIdSchema, { target: "params" }),
  getUserByIdController
);

/**
 * Approve a user (root and admin only)
 *
 * @route PATCH /api/v1/user/:id/approve
 * Private route
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
router.patch(
  "/:id/approve",
  authorizeRoles(0, 1), // Only root (0) and admin (1) can access
  validate(mongoIdSchema, { target: "params" }),
  approveUserController
);

/**
 * Suspend a user (root and admin only)
 *
 * @route PATCH /api/v1/user/:id/suspend
 * Private route
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
router.patch(
  "/:id/suspend",
  authorizeRoles(0, 1), // Only root (0) and admin (1) can access
  validate(mongoIdSchema, { target: "params" }),
  suspendUserController
);

/**
 * Un-suspend a user (root and admin only)
 *
 * @route PATCH /api/v1/user/:id/unsuspend
 * Private route
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
router.patch(
  "/:id/unsuspend",
  authorizeRoles(0, 1), // Only root (0) and admin (1) can access
  validate(mongoIdSchema, { target: "params" }),
  unSuspendUserController
);

/**
 * Delete a user (root only)
 *
 * @route DELETE /api/v1/user/:id
 * Private route
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
router.delete(
  "/:id",
  authorizeRoles(0), // Only root (0) can delete users
  validate(mongoIdSchema, { target: "params" }),
  deleteUserController
);

module.exports = router;
