const express = require("express");

const router = express.Router();

const {
  createTermsAndConditionController,
} = require("../controllers/TermsAndConditionControllers");
const { authenticate, authorizeRoles } = require("../middleware/auth");
const { validate } = require("../utils/validator");
const {
  createTermsAndConditionSchema,
} = require("../validators/terms-and-condition/terms-and-condition");

/**
 * Create a new terms and condition version
 *
 * @route POST /api/v1/terms-and-condition
 * Private route — only admin (0) can create terms and conditions
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
router.post(
  "/",
  authenticate,
  authorizeRoles(0),
  validate(createTermsAndConditionSchema, { target: "body" }),
  createTermsAndConditionController,
);
