const express = require("express");

const router = express.Router();

const {
  getArchiveSettingsController,
  updateArchiveSettingsController,
} = require("../controllers/ArchiveSettingsControllers");
const { authenticate, authorizeRoles } = require("../middleware/auth");
const { validate } = require("../utils/validator");
const {
  updateArchiveSettingsSchema,
} = require("../validators/admin/archiveSettings");

// All archive settings routes require authentication
router.use(authenticate);

/**
 * Get archive settings
 *
 * @route GET /api/v1/archive-settings
 * Private route - only root (0) and admin (1) can access
 *
 * @returns {Object} Archive settings with autoArchiveDays
 */
router.get("/", authorizeRoles(0, 1), getArchiveSettingsController);

/**
 * Update archive settings
 *
 * @route PUT /api/v1/archive-settings
 * Private route - only root (0) and admin (1) can update
 *
 * @param {Object} req.body - { autoArchiveDays: 7 | 15 | 30 }
 * @returns {Object} Updated archive settings
 */
router.put(
  "/",
  authorizeRoles(0, 1),
  validate(updateArchiveSettingsSchema, { target: "body" }),
  updateArchiveSettingsController,
);

module.exports = router;
