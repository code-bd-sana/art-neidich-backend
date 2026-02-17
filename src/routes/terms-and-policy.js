const express = require("express");

const router = express.Router();

const {
  createTermsAndPolicyController,
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

module.exports = router;
