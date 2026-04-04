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

/**
 * Get active terms and conditions
 *
 * @route GET /api/v1/terms-and-policy/terms
 * Public route
 */
router.get("/terms", getActiveTermsAndConditionController);

/**
 * Get active privacy policy
 *
 * @route GET /api/v1/terms-and-policy/privacy
 * Public route
 */
router.get("/privacy", getActivePrivacyPolicyController);

/**
 * Get user's accepted terms and policy status
 *
 * @route GET /api/v1/terms-and-policy/my-status
 * Private route
 */
router.get("/my-status", authenticate, getMyTermsAndPolicyStatusController);

/**
 * Get terms and policy by ID
 *
 * @route GET /api/v1/terms-and-policy/:id
 * Public route
 */
router.get(
  "/:id",
  validate(mongoIdSchema, { target: "params" }),
  getTermsAndConditionByIdController,
);

/**
 * Get all terms and policies (with pagination)
 *
 * @route GET /api/v1/terms-and-policy
 * Public route
 */
router.get("/", getAllTermsAndConditionController);

/**
 * Create new terms and policies
 *
 * @route POST /api/v1/terms-and-policy
 * Private route — only root (0) and admin (1) can create
 */
router.post(
  "/",
  authenticate,
  authorizeRoles(0, 1),
  createTermsAndPolicyController,
);

/**
 * Update terms and policies
 *
 * @route PUT /api/v1/terms-and-policy/:id
 * Private route — only root (0) and admin (1) can update
 */
router.put(
  "/:id",
  authenticate,
  authorizeRoles(0, 1),
  validate(mongoIdSchema, { target: "params" }),
  updateTermsAndPolicyController,
);

module.exports = router;
