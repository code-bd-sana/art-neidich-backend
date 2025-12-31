const mongoose = require("mongoose");

const JobModel = require("../models/JobModel");

/**
 * Create a new job
 *
 * @param {Object} payload
 * @returns {Promise<Object>}
 */
async function createJob(payload) {
  // Create job
  const created = await JobModel.create(payload);

  // Aggregate with createdBy and lastUpdatedBy
  const result = await JobModel.aggregate([
    // Match created job
    {
      $match: {
        _id: new mongoose.Types.ObjectId(created._id),
      },
    },
    // Lookup inspector
    {
      $lookup: {
        from: "users",
        localField: "inspectorId",
        foreignField: "_id",
        as: "inspector",
      },
    },
    {
      $unwind: {
        path: "$inspector",
        preserveNullAndEmptyArrays: true,
      },
    },
    // Lookup createdBy
    {
      $lookup: {
        from: "users",
        localField: "createdBy",
        foreignField: "_id",
        as: "createdBy",
      },
    },

    {
      $unwind: {
        path: "$createdBy",
        preserveNullAndEmptyArrays: true,
      },
    },
    // Lookup lastUpdatedBy
    {
      $lookup: {
        from: "users",
        localField: "lastUpdatedBy",
        foreignField: "_id",
        as: "lastUpdatedBy",
      },
    },
    {
      $unwind: {
        path: "$lastUpdatedBy",
        preserveNullAndEmptyArrays: true,
      },
    },
    // Convert roles to readable labels
    {
      $addFields: {
        "inspector.role": {
          $switch: {
            branches: [
              { case: { $eq: ["$inspector.role", 0] }, then: "Super Admin" },
              { case: { $eq: ["$inspector.role", 1] }, then: "Admin" },
              { case: { $eq: ["$inspector.role", 2] }, then: "Inspector" },
            ],
            default: "Unknown",
          },
        },
        "createdBy.role": {
          $switch: {
            branches: [
              { case: { $eq: ["$createdBy.role", 0] }, then: "Super Admin" },
              { case: { $eq: ["$createdBy.role", 1] }, then: "Admin" },
              { case: { $eq: ["$createdBy.role", 2] }, then: "Inspector" },
            ],
            default: "Unknown",
          },
        },
        "lastUpdatedBy.role": {
          $switch: {
            branches: [
              {
                case: { $eq: ["$lastUpdatedBy.role", 0] },
                then: "Super Admin",
              },
              { case: { $eq: ["$lastUpdatedBy.role", 1] }, then: "Admin" },
              { case: { $eq: ["$lastUpdatedBy.role", 2] }, then: "Inspector" },
            ],
            default: "Unknown",
          },
        },
      },
    },
    // Project safe fields only
    {
      $project: {
        "inspector.password": 0,
        "inspector.resetToken": 0,
        "inspector.resetTokenExpiry": 0,
        "createdBy.password": 0,
        "createdBy.resetToken": 0,
        "createdBy.resetTokenExpiry": 0,
        "lastUpdatedBy.password": 0,
        "lastUpdatedBy.resetToken": 0,
        "lastUpdatedBy.resetTokenExpiry": 0,
      },
    },
  ]);

  return result[0] || null;
}

/**
 * Get job by id using aggregation (with inspector)
 * @param {string} id
 * @returns {Promise<Object>}
 */
async function getJobById(id) {
  const jobId = new mongoose.Types.ObjectId(id);

  const result = await JobModel.aggregate([
    /* ---------------- MATCH JOB ---------------- */
    { $match: { _id: jobId } },

    /* ---------------- CHECK REPORT EXISTS ---------------- */
    {
      $lookup: {
        from: "reports",
        let: { jobId: "$_id" },
        pipeline: [
          { $match: { $expr: { $eq: ["$job", "$$jobId"] } } },
          { $limit: 1 }, // only need existence
          { $project: { _id: 1 } },
        ],
        as: "reportCheck",
      },
    },

    /* ---------------- USERS ---------------- */
    {
      $lookup: {
        from: "users",
        localField: "inspector",
        foreignField: "_id",
        as: "inspector",
      },
    },
    { $unwind: { path: "$inspector", preserveNullAndEmptyArrays: true } },

    {
      $lookup: {
        from: "users",
        localField: "createdBy",
        foreignField: "_id",
        as: "createdBy",
      },
    },
    { $unwind: { path: "$createdBy", preserveNullAndEmptyArrays: true } },

    {
      $lookup: {
        from: "users",
        localField: "lastUpdatedBy",
        foreignField: "_id",
        as: "lastUpdatedBy",
      },
    },
    { $unwind: { path: "$lastUpdatedBy", preserveNullAndEmptyArrays: true } },

    /* ---------------- ROLE MAPPING ---------------- */
    {
      $addFields: {
        hasReport: { $gt: [{ $size: "$reportCheck" }, 0] }, // ✅ true / false

        "inspector.role": {
          $switch: {
            branches: [
              { case: { $eq: ["$inspector.role", 0] }, then: "Super Admin" },
              { case: { $eq: ["$inspector.role", 1] }, then: "Admin" },
              { case: { $eq: ["$inspector.role", 2] }, then: "Inspector" },
            ],
            default: "Unknown",
          },
        },
        "createdBy.role": {
          $switch: {
            branches: [
              { case: { $eq: ["$createdBy.role", 0] }, then: "Super Admin" },
              { case: { $eq: ["$createdBy.role", 1] }, then: "Admin" },
              { case: { $eq: ["$createdBy.role", 2] }, then: "Inspector" },
            ],
            default: "Unknown",
          },
        },
        "lastUpdatedBy.role": {
          $switch: {
            branches: [
              {
                case: { $eq: ["$lastUpdatedBy.role", 0] },
                then: "Super Admin",
              },
              { case: { $eq: ["$lastUpdatedBy.role", 1] }, then: "Admin" },
              { case: { $eq: ["$lastUpdatedBy.role", 2] }, then: "Inspector" },
            ],
            default: "Unknown",
          },
        },
      },
    },

    /* ---------------- FINAL PROJECT ---------------- */
    {
      $project: {
        formType: 1,
        feeStatus: 1,
        agreedFee: 1,
        fhaCaseDetailsNo: 1,
        orderId: 1,
        streetAddress: 1,
        developmentName: 1,
        siteContactName: 1,
        siteContactPhone: 1,
        siteContactEmail: 1,
        dueDate: 1,
        specialNotesForInspector: 1,
        specialNoteForApOrAr: 1,
        createdAt: 1,
        updatedAt: 1,
        hasReport: 1, // exposed here

        inspector: {
          _id: "$inspector._id",
          userId: "$inspector.userId",
          firstName: "$inspector.firstName",
          lastName: "$inspector.lastName",
          email: "$inspector.email",
          role: "$inspector.role",
        },

        createdBy: {
          _id: "$createdBy._id",
          userId: "$createdBy.userId",
          firstName: "$createdBy.firstName",
          lastName: "$createdBy.lastName",
          email: "$createdBy.email",
          role: "$createdBy.role",
        },

        lastUpdatedBy: {
          _id: "$lastUpdatedBy._id",
          userId: "$lastUpdatedBy.userId",
          firstName: "$lastUpdatedBy.firstName",
          lastName: "$lastUpdatedBy.lastName",
          email: "$lastUpdatedBy.email",
          role: "$lastUpdatedBy.role",
        },
      },
    },
  ]);

  if (!result || result.length === 0) {
    const err = new Error("Job not found");
    err.status = 404;
    err.code = "JOB_NOT_FOUND";
    throw err;
  }

  return result[0];
}

/**
 * Get jobs with search, pagination, and inspector (role = "Inspector")
 *
 * @param {Object} query
 * @returns {Promise<{jobs: Array, metaData: Object}>}
 */
async function getJobs(query = {}) {
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 10;
  const skip = (page - 1) * limit;
  const search = query.search?.trim();

  const pipeline = [];

  // Lookup inspector (needed for search)
  pipeline.push(
    {
      $lookup: {
        from: "users",
        localField: "inspector",
        foreignField: "_id",
        as: "inspector",
      },
    },
    {
      $unwind: {
        path: "$inspector",
        preserveNullAndEmptyArrays: true,
      },
    }
  );

  // Lookup createdBy
  pipeline.push(
    {
      $lookup: {
        from: "users",
        localField: "createdBy",
        foreignField: "_id",
        as: "createdBy",
      },
    },
    {
      $unwind: {
        path: "$createdBy",
        preserveNullAndEmptyArrays: true,
      },
    }
  );

  // Lookup lastUpdatedBy
  pipeline.push(
    {
      $lookup: {
        from: "users",
        localField: "lastUpdatedBy",
        foreignField: "_id",
        as: "lastUpdatedBy",
      },
    },
    {
      $unwind: {
        path: "$lastUpdatedBy",
        preserveNullAndEmptyArrays: true,
      },
    }
  );

  // Search (job fields + inspector name)

  if (search) {
    const esc = search.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&");
    const regex = new RegExp(esc, "i");

    pipeline.push({
      $match: {
        $or: [
          { streetAddress: regex },
          { orderId: regex },
          { fhaCaseDetailsNo: regex },
          { developmentName: regex },
          { siteContactName: regex },
          { "inspector.firstName": regex },
          { "inspector.lastName": regex },
          {
            $expr: {
              $regexMatch: {
                input: {
                  $concat: ["$inspector.firstName", " ", "$inspector.lastName"],
                },
                regex: esc,
                options: "i",
              },
            },
          },
        ],
      },
    });
  }

  // Convert roles to readable labels

  pipeline.push({
    $addFields: {
      "inspector.role": {
        $switch: {
          branches: [
            { case: { $eq: ["$inspector.role", 0] }, then: "Super Admin" },
            { case: { $eq: ["$inspector.role", 1] }, then: "Admin" },
            { case: { $eq: ["$inspector.role", 2] }, then: "Inspector" },
          ],
          default: "Unknown",
        },
      },
      "createdBy.role": {
        $switch: {
          branches: [
            { case: { $eq: ["$createdBy.role", 0] }, then: "Super Admin" },
            { case: { $eq: ["$createdBy.role", 1] }, then: "Admin" },
            { case: { $eq: ["$createdBy.role", 2] }, then: "Inspector" },
          ],
          default: "Unknown",
        },
      },
      "lastUpdatedBy.role": {
        $switch: {
          branches: [
            { case: { $eq: ["$lastUpdatedBy.role", 0] }, then: "Super Admin" },
            { case: { $eq: ["$lastUpdatedBy.role", 1] }, then: "Admin" },
            { case: { $eq: ["$lastUpdatedBy.role", 2] }, then: "Inspector" },
          ],
          default: "Unknown",
        },
      },
    },
  });

  // Project safe fields only

  pipeline.push({
    $project: {
      formType: 1,
      feeStatus: 1,
      agreedFee: 1,
      fhaCaseDetailsNo: 1,
      orderId: 1,
      streetAddress: 1,
      developmentName: 1,
      siteContactName: 1,
      siteContactPhone: 1,
      siteContactEmail: 1,
      dueDate: 1,
      createdAt: 1,

      inspector: {
        _id: "$inspector._id",
        userId: "$inspector.userId",
        firstName: "$inspector.firstName",
        lastName: "$inspector.lastName",
        email: "$inspector.email",
        role: "$inspector.role",
      },

      createdBy: {
        _id: "$createdBy._id",
        userId: "$createdBy.userId",
        firstName: "$createdBy.firstName",
        lastName: "$createdBy.lastName",
        email: "$createdBy.email",
        role: "$createdBy.role",
      },

      lastUpdatedBy: {
        _id: "$lastUpdatedBy._id",
        userId: "$lastUpdatedBy.userId",
        firstName: "$lastUpdatedBy.firstName",
        lastName: "$lastUpdatedBy.lastName",
        email: "$lastUpdatedBy.email",
        role: "$lastUpdatedBy.role",
      },
    },
  });

  // Pagination + count

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
 * Update job
 *
 * @param {string} id
 * @param {Object} payload
 * @returns {Promise<Object>}
 */
async function updateJob(id, payload) {
  // Update the document
  await JobModel.updateOne({ _id: id }, { $set: payload });

  // Fetch updated document with aggregation
  const result = await JobModel.aggregate([
    { $match: { _id: id } },

    // Lookup inspector
    {
      $lookup: {
        from: "users",
        localField: "inspector",
        foreignField: "_id",
        as: "inspector",
      },
    },
    { $unwind: { path: "$inspector", preserveNullAndEmptyArrays: true } },

    // Lookup createdBy
    {
      $lookup: {
        from: "users",
        localField: "createdBy",
        foreignField: "_id",
        as: "createdBy",
      },
    },
    { $unwind: { path: "$createdBy", preserveNullAndEmptyArrays: true } },

    // Lookup lastUpdatedBy
    {
      $lookup: {
        from: "users",
        localField: "lastUpdatedBy",
        foreignField: "_id",
        as: "lastUpdatedBy",
      },
    },
    { $unwind: { path: "$lastUpdatedBy", preserveNullAndEmptyArrays: true } },

    // Map roles to labels
    {
      $addFields: {
        "inspector.role": {
          $switch: {
            branches: [
              { case: { $eq: ["$inspector.role", 0] }, then: "Super Admin" },
              { case: { $eq: ["$inspector.role", 1] }, then: "Admin" },
              { case: { $eq: ["$inspector.role", 2] }, then: "Inspector" },
            ],
            default: "Unknown",
          },
        },
        "createdBy.role": {
          $switch: {
            branches: [
              { case: { $eq: ["$createdBy.role", 0] }, then: "Super Admin" },
              { case: { $eq: ["$createdBy.role", 1] }, then: "Admin" },
              { case: { $eq: ["$createdBy.role", 2] }, then: "Inspector" },
            ],
            default: "Unknown",
          },
        },
        "lastUpdatedBy.role": {
          $switch: {
            branches: [
              {
                case: { $eq: ["$lastUpdatedBy.role", 0] },
                then: "Super Admin",
              },
              { case: { $eq: ["$lastUpdatedBy.role", 1] }, then: "Admin" },
              { case: { $eq: ["$lastUpdatedBy.role", 2] }, then: "Inspector" },
            ],
            default: "Unknown",
          },
        },
      },
    },

    // Project only safe fields
    {
      $project: {
        formType: 1,
        feeStatus: 1,
        agreedFee: 1,
        fhaCaseDetailsNo: 1,
        orderId: 1,
        streetAddress: 1,
        developmentName: 1,
        siteContactName: 1,
        siteContactPhone: 1,
        siteContactEmail: 1,
        dueDate: 1,
        specialNotesForInspector: 1,
        specialNoteForApOrAr: 1,
        createdAt: 1,
        updatedAt: 1,

        inspector: {
          _id: "$inspector._id",
          userId: "$inspector.userId",
          firstName: "$inspector.firstName",
          lastName: "$inspector.lastName",
          email: "$inspector.email",
          role: "$inspector.role",
        },

        createdBy: {
          _id: "$createdBy._id",
          userId: "$createdBy.userId",
          firstName: "$createdBy.firstName",
          lastName: "$createdBy.lastName",
          email: "$createdBy.email",
          role: "$createdBy.role",
        },

        lastUpdatedBy: {
          _id: "$lastUpdatedBy._id",
          userId: "$lastUpdatedBy.userId",
          firstName: "$lastUpdatedBy.firstName",
          lastName: "$lastUpdatedBy.lastName",
          email: "$lastUpdatedBy.email",
          role: "$lastUpdatedBy.role",
        },
      },
    },
  ]);

  if (!result || result.length === 0) {
    const err = new Error("Job not found");
    err.status = 404;
    err.code = "JOB_NOT_FOUND";
    throw err;
  }

  return result[0];
}

/**
 * Delete job
 *
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
