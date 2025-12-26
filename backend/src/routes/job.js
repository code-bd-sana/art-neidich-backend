const express = require("express");

const router = express.Router();

const {
  createJobController,
  getJobsController,
  getJobByIdController,
  updateJobController,
  deleteJobController,
} = require("../controllers/JobControllers");
const { authenticate, authorizeRoles } = require("../middleware/auth");
const { validate } = require("../utils/validator");
const { mongoIdSchema } = require("../validators/common/mongoId");
const {
  searchAndPaginationSchema,
} = require("../validators/common/searchAndPagination");
const { createJobSchema } = require("../validators/job/createJob");
const { updateJobSchema } = require("../validators/job/updateJob");

// All job routes require authentication
router.use(authenticate);

/**
 * Create a new job
 *
 * @route POST /api/v1/job
 * Private route — only root (0) and admin (1) can create jobs
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
router.post(
  "/",
  authorizeRoles(0, 1),
  validate(createJobSchema, { target: "body" }),
  createJobController
);

/**
 * Get list of jobs with optional search & pagination
 *
 * @route GET /api/v1/job
 * Private route
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
router.get(
  "/",
  validate(searchAndPaginationSchema, { target: "query" }),
  getJobsController
);

/**
 * Get a single job by id
 *
 * @route GET /api/v1/job/:id
 * Private route
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
router.get(
  "/:id",
  validate(mongoIdSchema, { target: "params" }),
  getJobByIdController
);

/**
 * Update an existing job
 *
 * @route PUT /api/v1/job/:id
 * Private route - only root (0) and admin (1) can update jobs
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
router.put(
  "/:id",
  authorizeRoles(0, 1),
  validate(mongoIdSchema, { target: "params" }),
  validate(updateJobSchema, { target: "body" }),
  updateJobController
);

/**
 * Delete a job
 *
 * @route DELETE /api/v1/job/:id
 * Private route — only root (0) and admin (1) can delete jobs
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
router.delete(
  "/:id",
  authorizeRoles(0, 1),
  validate(mongoIdSchema, { target: "params" }),
  deleteJobController
);

module.exports = router;
