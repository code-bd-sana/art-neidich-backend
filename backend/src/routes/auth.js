const express = require("express");

const router = express.Router();

const {
  register,
  login,
  forgotPassword,
} = require("../controllers/AuthControllers");
const { validate } = require("../utils/validator");
const { forgotPasswordSchema } = require("../validators/auth/forgotPassword");
const { loginSchema } = require("../validators/auth/login");
const { registerSchema } = require("../validators/auth/register");
const { resetPasswordSchema } = require("../validators/auth/resetPassword");

/**
 * Handle user registration
 *
 * @route POST /api/v1/auth/register
 * Public route to register a new user
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
router.post(
  "/register",
  validate(registerSchema, { target: "body" }),
  register
);

/**
 * Handle user login
 *
 * @route POST /api/v1/auth/login
 * Public route to authenticate a user
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
router.post("/login", validate(loginSchema, { target: "body" }), login);

/**
 * Handle forgot password request
 *
 * @route POST /api/v1/auth/forgot-password
 * Public route to initiate forgot password process
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
router.post(
  "/forgot-password",
  validate(forgotPasswordSchema, { target: "body" }),
  forgotPassword
);

/**
 * Handle reset password request
 *
 * @route POST /api/v1/auth/reset-password
 * Public route to reset user password
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
// router.post(
//   "/reset-password",
//   validate(resetPasswordSchema, { target: "body" }),
//   resetPassword
// );

/**
 * Handle change password
 *
 * @route POST /api/v1/auth/change-password
 * Private route to change user password
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
// router.post(
//   "/change-password",
//   authenticateUser,
//   validate(changePasswordSchema, { target: "body" }),
//   changePassword
// );

module.exports = router;
