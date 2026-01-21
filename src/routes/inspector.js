const express = require("express");

const router = express.Router();

const { inspectorOverview } = require("../controllers/InspectorControllers");
const { authenticate, authorizeRoles } = require("../middleware/auth");

// Apply authentication middleware to ALL routes in this router
router.use(authenticate);

/**
 * Get inspector overview statistics
 *
 * @route GET /api/v1/inspector/overview
 * Private route - only root (2) can access
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
router.get("/overview", authorizeRoles(2), inspectorOverview);

module.exports = router;
