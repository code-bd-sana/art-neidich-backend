const {
  createJob,
  getJobs,
  getJobById,
  updateJob,
  deleteJob,
} = require("../services/JobServices");

/**
 * Create a new job
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function createJobController(req, res, next) {
  try {
    const payload = req.validated;
    // attach creator
    payload.createdBy = req.user?._id;
    const job = await createJob(payload);
    return res
      .status(201)
      .json({ success: true, message: "Job created successfully", data: job });
  } catch (err) {
    return next(err);
  }
}

/**
 * Get a list of jobs (with pagination/search)
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function getJobsController(req, res, next) {
  try {
    const result = await getJobs(req.query);
    return res.status(200).json({
      success: true,
      message: "Jobs fetched successfully",
      data: result.jobs,
      metaData: result.metaData,
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * Get job by id
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function getJobByIdController(req, res, next) {
  try {
    const job = await getJobById(req.params.id);
    return res
      .status(200)
      .json({ success: true, message: "Job fetched successfully", data: job });
  } catch (err) {
    return next(err);
  }
}

/**
 * Update an existing job
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function updateJobController(req, res, next) {
  try {
    const payload = req.validated;
    payload.lastUpdatedBy = req.user?._id;
    const updated = await updateJob(req.params.id, payload);
    return res.status(200).json({
      success: true,
      message: "Job updated successfully",
      data: updated,
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * Delete a job
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function deleteJobController(req, res, next) {
  try {
    await deleteJob(req.params.id);
    return res
      .status(200)
      .json({ success: true, message: "Job deleted successfully" });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  createJobController,
  getJobsController,
  getJobByIdController,
  updateJobController,
  deleteJobController,
};
