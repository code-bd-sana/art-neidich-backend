const express = require("express");

const router = express.Router();

const { adminOverview } = require("../controllers/AdminControllers");
const { authenticate, authorizeRoles } = require("../middleware/auth");

// Apply authentication middleware to ALL routes in this router
router.use(authenticate);

/**
 * Get admin overview statistics
 *
 * @route GET /api/v1/admin/overview
 * Private route - only root (0) and admin (1) can access
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
router.get("/overview", authorizeRoles(0, 1), adminOverview);

/**
 * Get admin
 */

module.exports = router;
