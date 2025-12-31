const express = require("express");

const router = express.Router();

const {
  createJobController,
  getJobsController,
  getJobByIdController,
  updateJobController,
  deleteJobController,
  getMyJobsController,
} = require("../controllers/JobControllers");
const { authenticate, authorizeRoles } = require("../middleware/auth");
const { validate } = require("../utils/validator");
const { mongoIdSchema } = require("../validators/common/mongoId");
const {
  searchAndPaginationSchema,
} = require("../validators/common/searchAndPagination");
const { createJobSchema, updateJobSchema } = require("../validators/job/job");

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
 * Private route - only root (0) and admin (1) can get all jobs
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
router.get(
  "/",
  authorizeRoles(0, 1),
  validate(searchAndPaginationSchema, { target: "query" }),
  getJobsController
);

/**
 * Get jobs assigned to the logged-in user (my jobs)
 *
 * @route GET /api/v1/job/my-jobs
 * Private route - any authenticated user can see their jobs
 */
router.get(
  "/my-jobs",
  authorizeRoles(2),
  validate(searchAndPaginationSchema, { target: "query" }),
  getMyJobsController
);

/**
 * Get a single job by id
 *
 * @route GET /api/v1/job/:id
 * Private route - only root (0) and admin (1) can get job by id
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
router.get(
  "/:id",
  authorizeRoles(0, 1),
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
