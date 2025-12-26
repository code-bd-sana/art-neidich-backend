const express = require("express");

const router = express.Router();

const {
  createImageLabel,
  getImageLabels,
  getImageLabel,
  updateImageLabel,
  deleteImageLabel,
} = require("../controllers/ImageLabelControllers");
const { authenticate, authorizeRoles } = require("../middleware/auth");
const { validate } = require("../utils/validator");
const { mongoIdSchema } = require("../validators/common/mongoId");
const {
  searchAndPaginationSchema,
} = require("../validators/common/searchAndPagination");
const {
  createImageLabelSchema,
  updateImageLabelSchema,
} = require("../validators/image-label/imageLabel");

// Apply authentication middleware to ALL routes in this router
router.use(authenticate);

/**
 * Create a new image label
 *
 * @route POST /api/v1/image-label
 * Private route to create an image label
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
router.post(
  "/",
  authorizeRoles(0, 1), // Only root (0) and admin (1) can access
  validate(createImageLabelSchema, { target: "body" }),
  createImageLabel
);

/**
 * Get list of image labels with optional search & pagination
 *
 * @route GET /api/v1/image-label
 * Private route
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
router.get(
  "/",
  authorizeRoles(0, 1), // Only root (0) and admin (1) can access
  validate(searchAndPaginationSchema, { target: "query" }),
  getImageLabels
);

/**
 * Get a single image label by id
 *
 * @route GET /api/v1/image-label/:id
 * Private route
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
router.get(
  "/:id",
  authorizeRoles(0, 1), // Only root (0) and admin (1) can access
  validate(mongoIdSchema, { target: "params" }),
  getImageLabel
);

/**
 * Update an existing image label
 *
 * @route PUT /api/v1/image-label/:id
 * Private route to update a label
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
router.put(
  "/:id",
  authorizeRoles(0, 1), // Only root (0) and admin (1) can access
  validate(mongoIdSchema, { target: "params" }),
  validate(updateImageLabelSchema, { target: "body" }),
  updateImageLabel
);

/**
 * Delete an image label
 *
 * @route DELETE /api/v1/image-label/:id
 * Private route
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
router.delete(
  "/:id",
  authorizeRoles(0, 1), // Only root (0) and admin (1) can access
  validate(mongoIdSchema, { target: "params" }),
  deleteImageLabel
);

module.exports = router;
