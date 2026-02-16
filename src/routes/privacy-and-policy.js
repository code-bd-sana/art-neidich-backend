const express = require("express");

const router = express.Router();

const {
  createPrivacyAndPolicyController,
  getActivePrivacyAndPolicyController,
  getAllPrivacyAndPolicyController,
  getPrivacyAndPolicyByIdController,
  updatePrivacyAndPolicyController,
  deletePrivacyAndPolicyController,
} = require("../controllers/PrivacyAndPolicyControllers");
const { authenticate, authorizeRoles } = require("../middleware/auth");
const { validate } = require("../utils/validator");
const { mongoIdSchema } = require("../validators/common/mongoId");
const {
  createPrivacyAndPolicySchema,
  searchPrivacyAndPolicySchema,
  updatePrivacyAndPolicySchema,
} = require("../validators/legal/privacy-and-policy");

// Create a new privacy and policy version (admin only)
router.post(
  "/",
  authenticate,
  authorizeRoles(0),
  validate(createPrivacyAndPolicySchema, { target: "body" }),
  createPrivacyAndPolicyController,
);

// Get the currently active privacy and policy (public)
router.get("/active", getActivePrivacyAndPolicyController);

// Get all privacy and policy (admin only)
router.get(
  "/",
  authenticate,
  authorizeRoles(0),
  validate(searchPrivacyAndPolicySchema, { target: "query" }),
  getAllPrivacyAndPolicyController,
);

// Get privacy and policy by ID (admin only)
router.get(
  "/:id",
  authenticate,
  authorizeRoles(0),
  validate(mongoIdSchema, { target: "params", key: "id" }),
  getPrivacyAndPolicyByIdController,
);

// Update privacy and policy by ID (admin only)
router.patch(
  "/:id",
  authenticate,
  authorizeRoles(0),
  validate(mongoIdSchema, { target: "params", key: "id" }),
  validate(updatePrivacyAndPolicySchema, { target: "body" }),
  updatePrivacyAndPolicyController,
);

// Delete privacy and policy by ID (admin only)
router.delete(
  "/:id",
  authenticate,
  authorizeRoles(0),
  validate(mongoIdSchema, { target: "params", key: "id" }),
  deletePrivacyAndPolicyController,
);

module.exports = router;
