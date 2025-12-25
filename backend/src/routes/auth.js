const express = require("express");

const router = express.Router();

const { register, login } = require("../controllers/AuthControllers");
const { validate } = require("../utils/validator");
const { loginSchema } = require("../validators/auth/login");
const { registerSchema } = require("../validators/auth/register");

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

module.exports = router;
