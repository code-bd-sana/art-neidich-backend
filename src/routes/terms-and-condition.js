const express = require("express");

const router = express.Router();

const {
  createTermsAndConditionController,
  getActiveTermsAndConditionController,
  getAllTermsAndConditionController,
  getTermsAndConditionByIdController,
  updateTermsAndConditionController,
  deleteTermsAndConditionController,
} = require("../controllers/TermsAndConditionControllers");
const { authenticate, authorizeRoles } = require("../middleware/auth");
const { validate } = require("../utils/validator");
const { mongoIdSchema } = require("../validators/common/mongoId");
const {
  createTermsAndConditionSchema,
  searchTermsAndConditionSchema,
  updateTermsAndConditionSchema,
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

/**
 * Get the currently active terms and condition
 *
 * @route GET /api/v1/terms-and-condition/active
 * Public route — anyone can view the active terms and conditions
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
router.get("/active", getActiveTermsAndConditionController);

/**
 * Get all terms and condition with pagination
 *
 * @route GET /api/v1/terms-and-condition
 * Private route — only admin (0) can view all terms and conditions
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
router.get(
  "/",
  authenticate,
  authorizeRoles(0),
  validate(searchTermsAndConditionSchema, { target: "query" }),
  getAllTermsAndConditionController,
);

/**
 * Get terms and condition by ID
 *
 * @route GET /api/v1/terms-and-condition/:id
 * Private route — only admin (0) can view terms and conditions by ID
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
router.get(
  "/:id",
  authenticate,
  authorizeRoles(0),
  validate(mongoIdSchema, { target: "params" }),
  getTermsAndConditionByIdController,
);

/**
 * Update terms and condition by ID
 *
 * @route PATCH /api/v1/terms-and-condition/:id
 * Private route — only admin (0) can update terms and conditions by ID
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
router.patch(
  "/:id",
  authenticate,
  authorizeRoles(0),
  validate(mongoIdSchema, { target: "params" }),
  validate(updateTermsAndConditionSchema, { target: "body" }),
  updateTermsAndConditionController,
);

/**
 * Delete terms and condition by ID
 *
 * @route DELETE /api/v1/terms-and-condition/:id
 * Private route — only admin (0) can delete terms and conditions by ID
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
router.delete(
  "/:id",
  authenticate,
  authorizeRoles(0),
  validate(mongoIdSchema, { target: "params" }),
  deleteTermsAndConditionController,
);

module.exports = router;
