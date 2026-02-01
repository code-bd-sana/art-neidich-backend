const mongoose = require("mongoose");

const {
  createJob,
  getJobs,
  getJobById,
  updateJob,
  getMyJobs,
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
    // get validated payload
    const payload = req.validated;

    // attach createdBy and lastUpdatedBy
    payload.createdBy = new mongoose.Types.ObjectId(req.user?._id);
    payload.lastUpdatedBy = new mongoose.Types.ObjectId(req.user?._id);

    // call service
    const job = await createJob(payload);

    return res.status(201).json({
      success: true,
      message: "Job created successfully",
      data: job,
      code: 201,
    });
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
    // Call service
    const result = await getJobs(req.query);

    return res.status(200).json({
      success: true,
      message: "Jobs fetched successfully",
      data: result.jobs,
      metaData: result.metaData,
      code: 200,
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * Get jobs assigned to the logged-in user (my jobs)
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function getMyJobsController(req, res, next) {
  try {
    // Get user ID from authenticated request
    const userId = req.user?._id;

    // Call service
    const { jobs, metaData } = await getMyJobs(req.query, userId);
    return res.status(200).json({
      success: true,
      message: "My jobs fetched successfully",
      data: jobs,
      metaData: metaData,
      code: 200,
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
    // Call service
    const job = await getJobById(req.params.id);

    return res.status(200).json({
      success: true,
      message: "Job fetched successfully",
      data: job,
      code: 200,
    });
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
    // Get validated payload
    const payload = req.validated;

    // Attach lastUpdatedBy
    payload.lastUpdatedBy = new mongoose.Types.ObjectId(req.user?._id);

    // Call service
    const updated = await updateJob(req.params.id, payload);

    return res.status(200).json({
      success: true,
      message: "Job updated successfully",
      data: updated,
      code: 200,
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
    // Call service
    await deleteJob(req.params.id);

    return res
      .status(200)
      .json({ success: true, message: "Job deleted successfully", code: 200 });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  createJobController,
  getJobsController,
  getMyJobsController,
  getJobByIdController,
  updateJobController,
  deleteJobController,
};
