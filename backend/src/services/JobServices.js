const mongoose = require("mongoose");

const JobModel = require("../models/JobModel");

/**
 * Create a new job
 * @param {Object} payload
 * @returns {Promise<Object>}
 */
async function createJob(payload) {
  const created = await JobModel.create(payload);
  return created;
}

/**
 * Get jobs with search and pagination
 * @param {Object} query
 * @returns {Promise<{jobs: Array, metaData: Object}>}
 */
async function getJobs(query = {}) {
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 10;
  const skip = (page - 1) * limit;
  const search = query.search?.trim();

  const pipeline = [];
  if (search) {
    const esc = search.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&");
    pipeline.push({
      $match: {
        $or: [
          { streetAddress: { $regex: esc, $options: "i" } },
          { orderId: { $regex: esc, $options: "i" } },
          { fhaCaseDetailsNo: { $regex: esc, $options: "i" } },
          { developmentName: { $regex: esc, $options: "i" } },
          { siteContactName: { $regex: esc, $options: "i" } },
        ],
      },
    });
  }

  pipeline.push(
    { $sort: { createdAt: -1 } },
    {
      $facet: {
        jobs: [{ $skip: skip }, { $limit: limit }],
        metaData: [{ $count: "totalJob" }],
      },
    }
  );

  const result = await JobModel.aggregate(pipeline);
  const jobs = result[0]?.jobs || [];
  const totalJob = result[0]?.metaData[0]?.totalJob || 0;

  return {
    jobs,
    metaData: {
      page,
      limit,
      totalJob,
      totalPage: Math.ceil(totalJob / limit),
    },
  };
}

/**
 * Get job by id
 * @param {string} id
 * @returns {Promise<Object>}
 */
async function getJobById(id) {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    const err = new Error("Job not found");
    err.status = 404;
    err.code = "JOB_NOT_FOUND";
    throw err;
  }
  const job = await JobModel.findById(id);
  if (!job) {
    const err = new Error("Job not found");
    err.status = 404;
    err.code = "JOB_NOT_FOUND";
    throw err;
  }
  return job;
}

/**
 * Update job
 * @param {string} id
 * @param {Object} payload
 * @returns {Promise<Object>}
 */
async function updateJob(id, payload) {
  const updated = await JobModel.findByIdAndUpdate(id, payload, { new: true });
  if (!updated) {
    const err = new Error("Job not found");
    err.status = 404;
    err.code = "JOB_NOT_FOUND";
    throw err;
  }
  return updated;
}

/**
 * Delete job
 * @param {string} id
 * @returns {Promise<void>}
 */
async function deleteJob(id) {
  const existing = await JobModel.findById(id);
  if (!existing) {
    const err = new Error("Job not found");
    err.status = 404;
    err.code = "JOB_NOT_FOUND";
    throw err;
  }
  await JobModel.findByIdAndDelete(id);
  return;
}

module.exports = {
  createJob,
  getJobs,
  getJobById,
  updateJob,
  deleteJob,
};
