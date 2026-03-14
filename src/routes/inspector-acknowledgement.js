const express = require("express");

const router = express.Router();

const {
  getInspectorAcknowledgementController,
} = require("../controllers/TermsAndPolicyControllers");

/**
 * Get all terms and conditions and privacy policies, with optional search and pagination
 *
 * @route GET /api/v1/inspector-acknowledgement
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
router.get("/", getInspectorAcknowledgementController);

module.exports = router;
