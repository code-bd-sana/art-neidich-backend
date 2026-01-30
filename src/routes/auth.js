const express = require("express");

const router = express.Router();

const rateLimit = require("express-rate-limit");

const {
  register,
  login,
  forgotPassword,
  resetPassword,
  changePassword,
  verifyOtp,
} = require("../controllers/AuthControllers");
const { authenticate } = require("../middleware/auth");
const { validate } = require("../utils/validator");
const { changePasswordSchema } = require("../validators/auth/changePassword");
const { forgotPasswordSchema } = require("../validators/auth/forgotPassword");
const { loginSchema } = require("../validators/auth/login");
const { registerSchema } = require("../validators/auth/register");
const { resetPasswordSchema } = require("../validators/auth/resetPassword");
const { verifyOtpSchema } = require("../validators/auth/verifyOtp");

/**
 * Rate limiting for the forget password route
 */
const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message:
    "Too many password reset requests from this IP, please try again after 15 minutes",
});

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
  register,
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
  forgotPasswordLimiter,
  validate(forgotPasswordSchema, { target: "body" }),
  forgotPassword,
);

/**
 * Handle reset password request
 *
 * @route POST /api/v1/auth/reset-web-password
 * Public route to reset user password
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
router.post(
  "/reset-password",
  validate(resetPasswordSchema, { target: "body" }),
  resetPassword,
);

/**
 * Verify OTP
 *
 * @route POST /api/v1/auth/verify-otp
 * Public route to verify OTP
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
router.post(
  "/verify-otp",
  validate(verifyOtpSchema, { target: "body" }),
  verifyOtp,
);

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
router.post(
  "/change-password",
  authenticate,
  validate(changePasswordSchema, { target: "body" }),
  changePassword,
);

module.exports = router;
