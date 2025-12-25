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
const { updateUserSchema } = require("../validators/user/updateUser");

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
router.get("/profile", authenticate, getUserProfileController);

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
  authenticate,
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
  authenticate,
  authorizeRoles(0, 1), // Assuming '0' is root and '1' is admin
  validate(searchAndPaginationSchema, { target: "query" }),
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
  authenticate,
  authorizeRoles(0, 1), // Assuming '0' is root and '1' is admin
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
  authenticate,
  authorizeRoles(0, 1), // Assuming '0' is root and '1' is admin
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
  authenticate,
  authorizeRoles(0, 1), // Assuming '0' is root and '1' is admin
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
  authenticate,
  authorizeRoles(0, 1), // Assuming '0' is root and '1' is admin
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
  authenticate,
  authorizeRoles(0), // Assuming '0' is root
  validate(mongoIdSchema, { target: "params" }),
  deleteUserController
);

module.exports = router;
