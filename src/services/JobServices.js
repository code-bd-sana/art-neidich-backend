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
    // Check if report exists
    {
      $lookup: {
        from: "reports",
        let: { jobId: "$_id" },
        pipeline: [
          { $match: { $expr: { $eq: ["$job", "$$jobId"] } } },
          { $limit: 1 },
          { $project: { _id: 1, status: 1 } },
        ],
        as: "reportCheck",
      },
    },
    // Convert roles to readable labels and add report status(found or not found make it In Progress)
    {
      $addFields: {
        hasReport: { $gt: [{ $size: "$reportCheck" }, 0] },
        reportId: { $arrayElemAt: ["$reportCheck._id", 0] },
        reportStatus: {
          $ifNull: [
            { $arrayElemAt: ["$reportCheck.status", 0] },
            "In Progress",
          ],
        },
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
        hasReport: 1,
        reportId: 1,
        reportStatus: 1,
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
          { $limit: 1 },
          { $project: { _id: 1, status: 1 } },
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
        hasReport: { $gt: [{ $size: "$reportCheck" }, 0] },
        reportId: { $arrayElemAt: ["$reportCheck._id", 0] },
        reportStatus: { $arrayElemAt: ["$reportCheck.status", 0] },
        reportStatusLabel: {
          $switch: {
            branches: [
              {
                case: {
                  $eq: [
                    { $arrayElemAt: ["$reportCheck.status", 0] },
                    "submitted",
                  ],
                },
                then: "Submitted",
              },
              {
                case: {
                  $eq: [
                    { $arrayElemAt: ["$reportCheck.status", 0] },
                    "completed",
                  ],
                },
                then: "Completed",
              },
              {
                case: {
                  $eq: [
                    { $arrayElemAt: ["$reportCheck.status", 0] },
                    "rejected",
                  ],
                },
                then: "Rejected",
              },
            ],
            default: "In Progress",
          },
        },
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
        hasReport: 1,
        reportId: 1,
        reportStatus: 1,
        reportStatusLabel: 1,
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
 * Get jobs assigned to a specific user (inspector)
 *
 * @param {Object} query
 * @param {string} userId
 * @returns {Promise<{
 *   jobs: Array<Object>,
 *   metaData: {
 *     page: number,
 *     limit: number,
 *     totalJob: number,
 *     totalPage: number
 *   }
 * }>}
 */
async function getMyJobs(query = {}, userId) {
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 10;
  const skip = (page - 1) * limit;
  const search = query.search?.trim();
  const statusFilter = query.status;
  const dateType = query.dateType;
  const customDate = query.customDate ? new Date(query.customDate) : null;

  const pipeline = [
    // Match jobs assigned to the user
    { $match: { inspector: new mongoose.Types.ObjectId(userId) } },
  ];

  // -------------------------
  // Lookup inspector
  // -------------------------
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
      $unwind: { path: "$inspector", preserveNullAndEmptyArrays: true },
    },
  );

  // -------------------------
  // Lookup createdBy
  // -------------------------
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
      $unwind: { path: "$createdBy", preserveNullAndEmptyArrays: true },
    },
  );

  // -------------------------
  // Lookup lastUpdatedBy
  // -------------------------
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
      $unwind: { path: "$lastUpdatedBy", preserveNullAndEmptyArrays: true },
    },
  );

  // -------------------------
  // Lookup report status
  // -------------------------
  pipeline.push({
    $lookup: {
      from: "reports",
      let: { jobId: "$_id" },
      pipeline: [
        { $match: { $expr: { $eq: ["$job", "$$jobId"] } } },
        { $limit: 1 },
        { $project: { _id: 1, status: 1 } },
      ],
      as: "reportCheck",
    },
  });

  // -------------------------
  // Search filter
  // -------------------------
  if (search) {
    const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    pipeline.push({
      $match: {
        $or: [
          { streetAddress: { $regex: escapedSearch, $options: "i" } },
          { orderId: { $regex: escapedSearch, $options: "i" } },
          { fhaCaseDetailsNo: { $regex: escapedSearch, $options: "i" } },
          { developmentName: { $regex: escapedSearch, $options: "i" } },
          { siteContactName: { $regex: escapedSearch, $options: "i" } },
          { "inspector.firstName": { $regex: escapedSearch, $options: "i" } },
          { "inspector.lastName": { $regex: escapedSearch, $options: "i" } },
          {
            $expr: {
              $regexMatch: {
                input: {
                  $concat: ["$inspector.firstName", " ", "$inspector.lastName"],
                },
                regex: escapedSearch,
                options: "i",
              },
            },
          },
        ],
      },
    });
  }

  // -------------------------
  // Status filter
  // -------------------------
  if (statusFilter && statusFilter !== "all") {
    pipeline.push({
      $match: { "reportCheck.status": statusFilter },
    });
  }

  // -------------------------
  // Date filter
  // -------------------------
  if (dateType) {
    const now = new Date();
    let start, end;

    if (dateType === "this_month") {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    } else if (dateType === "previous_month") {
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    } else if (dateType === "custom" && customDate) {
      start = new Date(customDate);
      start.setHours(0, 0, 0, 0);
      end = new Date(customDate);
      end.setHours(23, 59, 59, 999);
    }

    if (start && end) {
      pipeline.push({
        $match: {
          createdAt: { $gte: start, $lte: end },
        },
      });
    }
  }

  // -------------------------
  // Add reportStatus, role labels
  // -------------------------
  pipeline.push({
    $addFields: {
      hasReport: { $gt: [{ $size: "$reportCheck" }, 0] },
      reportId: { $arrayElemAt: ["$reportCheck._id", 0] },
      reportStatus: { $arrayElemAt: ["$reportCheck.status", 0] },
      reportStatusLabel: {
        $switch: {
          branches: [
            {
              case: {
                $eq: [
                  { $arrayElemAt: ["$reportCheck.status", 0] },
                  "submitted",
                ],
              },
              then: "Submitted",
            },
            {
              case: {
                $eq: [
                  { $arrayElemAt: ["$reportCheck.status", 0] },
                  "completed",
                ],
              },
              then: "Completed",
            },
            {
              case: {
                $eq: [{ $arrayElemAt: ["$reportCheck.status", 0] }, "rejected"],
              },
              then: "Rejected",
            },
          ],
          default: "In Progress",
        },
      },
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

  // -------------------------
  // Project safe fields
  // -------------------------
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
      updatedAt: 1,
      hasReport: 1,
      reportId: 1,
      reportStatus: 1,
      reportStatusLabel: 1,
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

  // -------------------------
  // Pagination + count
  // -------------------------
  pipeline.push(
    { $sort: { createdAt: -1 } },
    {
      $facet: {
        jobs: [{ $skip: skip }, { $limit: limit }],
        metaData: [{ $count: "totalJob" }],
      },
    },
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
 * Get jobs with search and pagination
 *
 * @param {Object} query
 * @returns {Promise<{
 *  jobs: Array<Object>,
 *  metaData: {
 *    page: number,
 *    limit: number,
 *    totalJob: number,
 *    totalPage: number
 * } }>}
 */
async function getJobs(query = {}) {
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 10;
  const skip = (page - 1) * limit;
  const search = query.search?.trim();
  const statusFilter = query.status;
  const dateType = query.dateType;
  const customDate = query.customDate ? new Date(query.customDate) : null;

  const pipeline = [];

  // -------------------------
  // Lookup inspector
  // -------------------------
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
      $unwind: { path: "$inspector", preserveNullAndEmptyArrays: true },
    },
  );

  // -------------------------
  // Lookup createdBy
  // -------------------------
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
      $unwind: { path: "$createdBy", preserveNullAndEmptyArrays: true },
    },
  );

  // -------------------------
  // Lookup lastUpdatedBy
  // -------------------------
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
      $unwind: { path: "$lastUpdatedBy", preserveNullAndEmptyArrays: true },
    },
  );

  // -------------------------
  // Lookup report status
  // -------------------------
  pipeline.push({
    $lookup: {
      from: "reports",
      let: { jobId: "$_id" },
      pipeline: [
        { $match: { $expr: { $eq: ["$job", "$$jobId"] } } },
        { $limit: 1 },
        { $project: { _id: 1, status: 1 } },
      ],
      as: "reportCheck",
    },
  });

  // Add reportStatus field (default: in_progress)
  pipeline.push({
    $addFields: {
      reportStatus: {
        $ifNull: [{ $arrayElemAt: ["$reportCheck.status", 0] }, "in_progress"],
      },
    },
  });

  // -------------------------
  // Filter by status
  // -------------------------
  if (statusFilter && statusFilter !== "all") {
    pipeline.push({ $match: { reportStatus: statusFilter } });
  }

  // -------------------------
  // Search
  // -------------------------
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

  // -------------------------
  // Date filter
  // -------------------------
  if (dateType) {
    const now = new Date();
    let start, end;

    if (dateType === "this_month") {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    } else if (dateType === "previous_month") {
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    } else if (dateType === "custom" && customDate) {
      start = new Date(customDate);
      start.setHours(0, 0, 0, 0);
      end = new Date(customDate);
      end.setHours(23, 59, 59, 999);
    }

    if (start && end) {
      pipeline.push({
        $match: {
          createdAt: { $gte: start, $lte: end },
        },
      });
    }
  }

  // -------------------------
  // Role & report labels
  // -------------------------
  pipeline.push({
    $addFields: {
      hasReport: { $gt: [{ $size: "$reportCheck" }, 0] },
      reportId: { $arrayElemAt: ["$reportCheck._id", 0] },
      reportStatusLabel: {
        $switch: {
          branches: [
            {
              case: { $eq: ["$reportStatus", "submitted"] },
              then: "Submitted",
            },
            {
              case: { $eq: ["$reportStatus", "completed"] },
              then: "Completed",
            },
            { case: { $eq: ["$reportStatus", "rejected"] }, then: "Rejected" },
            {
              case: { $eq: ["$reportStatus", "in_progress"] },
              then: "In Progress",
            },
          ],
          default: "Unknown",
        },
      },
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

  // -------------------------
  // Project safe fields
  // -------------------------
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
      updatedAt: 1,
      hasReport: 1,
      reportId: 1,
      reportStatus: 1,
      reportStatusLabel: 1,
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

  // -------------------------
  // Pagination + Count
  // -------------------------
  pipeline.push(
    { $sort: { createdAt: -1 } },
    {
      $facet: {
        jobs: [{ $skip: skip }, { $limit: limit }],
        metaData: [{ $count: "totalJob" }],
      },
    },
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
  const result = await JobModel.updateOne(
    { _id: id },
    { $set: payload },
    { new: true },
  );

  if (!result || result.length === 0) {
    const err = new Error("Job not found");
    err.status = 404;
    err.code = "JOB_NOT_FOUND";
    throw err;
  }

  return await getJobById(id);
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
  getMyJobs,
  getJobs,
  getJobById,
  updateJob,
  deleteJob,
};
