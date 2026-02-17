const express = require("express");

const router = express.Router();

const {
  createTermsAndPolicyController,
  getActiveTermsAndConditionController,
  getActivePrivacyPolicyController,
  getTermsAndConditionByIdController,
  getAllTermsAndConditionController,
  updateTermsAndPolicyController,
  getMyTermsAndPolicyStatusController,
} = require("../controllers/TermsAndPolicyControllers");
const { authenticate, authorizeRoles } = require("../middleware/auth");
const { validate } = require("../utils/validator");
const { mongoIdSchema } = require("../validators/common/mongoId");
const {
  searchTermsAndPolicySchema,
  updateTermsAndPolicySchema,
  createTermsAndPolicySchema,
} = require("../validators/terms-and-policies/terms-and-policies");

/**
 * Create a new terms and policy version
 *
 * @route POST /api/v1/terms-and-policy
 * Private route — only admin (0) can create terms and policies
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
router.post(
  "/",
  authenticate,
  authorizeRoles(0),
  validate(createTermsAndPolicySchema, { target: "body" }),
  createTermsAndPolicyController,
);

/**
 * Update an existing terms and policy version
 *
 * @route PUT /api/v1/terms-and-policy/:id
 * Private route — only admin (0) can update terms and policies
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
router.put(
  "/:id",
  authenticate,
  authorizeRoles(0),
  validate(mongoIdSchema, { target: "params" }),
  validate(updateTermsAndPolicySchema, { target: "body" }),
  updateTermsAndPolicyController,
);

/**
 * Get all terms and policies with pagination and filtering
 *
 * @route GET /api/v1/terms-and-policy
 * Private route — only admin (0) can access this endpoint
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
router.get(
  "/",
  authenticate,
  authorizeRoles(0),
  validate(searchTermsAndPolicySchema, { target: "query" }),
  getAllTermsAndConditionController,
);

/**
 * Get a specific terms and policy version by ID
 *
 * @route GET /api/v1/terms-and-policy/:id
 * Private route — only admin (0) can access this endpoint
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
 * Handle get active terms and policy
 *
 * @route GET /api/v1/terms-and-policy/active/terms
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
router.get(
  "/active/terms",
  authenticate,
  authorizeRoles(0),
  getActiveTermsAndConditionController,
);

/**
 * Handle get active privacy policy
 *
 * @route GET /api/v1/terms-and-policy/active/privacy
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
router.get(
  "/active/privacy",
  authenticate,
  authorizeRoles(0),
  getActivePrivacyPolicyController,
);

/**
 * Get the current user's acceptance status of the active terms and policy versions
 *
 * @route GET /api/v1/terms-and-policy/my-status
 * Private route — any authenticated user can access this endpoint
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
router.get("/my-status", authenticate, getMyTermsAndPolicyStatusController);

module.exports = router;
