const mongoose = require("mongoose");
const JobModel = require("../models/JobModel");
const ReportModel = require("../models/ReportModel");
const jobServices = require("./JobServices");
const { deleteObjects } = require("../utils/s3");

/**
 * Get archived reports with pagination, search, and filtering
 * Enriches reports with full job details fetched in parallel
 *
 * @param {Object} query - Query parameters
 * @param {number} [query.page=1] - Page number for pagination
 * @param {number} [query.limit=10] - Number of reports per page
 * @param {string} [query.search] - Search term (optional)
 * @returns {Promise<Object>} - { reports, metaData }
 * @throws {Error} If database operations fail
 */
async function getArchivedReports(query = {}) {
  /* ---------------- PAGINATION ---------------- */

  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 10;
  const skip = (page - 1) * limit;

  /* ---------------- BUILD LOOKUP PIPELINE FOR JOB JOIN AND SEARCH ---------------- */

  const lookupPipeline = [
    {
      $lookup: {
        from: "jobs",
        localField: "job",
        foreignField: "_id",
        as: "job",
      },
    },
    {
      $unwind: {
        path: "$job",
        preserveNullAndEmptyArrays: false,
      },
    },
  ];

  /* ADD SEARCH FILTER IF PROVIDED */

  if (query.search && query.search.trim()) {
    const search = query.search.trim();
    const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(escapedSearch, "i");

    lookupPipeline.push({
      $match: {
        $or: [
          { "job.orderId": regex },
          { "job.fhaCaseDetailsNo": regex },
          { "job.streetAddress": regex },
          { "job.developmentName": regex },
        ],
      },
    });
  }

  /* BUILD AGGREGATION PIPELINE WITH FACET FOR PAGINATION AND COUNTING */

  const pipeline = [
    { $match: { status: "archived" } },
    ...lookupPipeline,
    {
      $sort: {
        createdAt: -1,
      },
    },
    {
      $facet: {
        reports: [
          { $skip: skip },
          { $limit: limit },
          {
            $project: {
              _id: 1,
              status: 1,
              createdAt: 1,
              completedAt: 1,
              job: {
                _id: "$job._id",
              },
            },
          },
        ],
        metaData: [{ $count: "total" }],
      },
    },
  ];

  /* EXECUTE AGGREGATION PIPELINE */

  const result = await ReportModel.aggregate(pipeline);

  /* EXTRACT REPORTS AND TOTAL COUNT */

  const reports = result[0]?.reports || [];
  const totalReports = result[0]?.metaData[0]?.total || 0;

  /* FETCH ALL JOBS ONCE */

  const uniqueJobIds = [
    ...new Set(
      reports.map((report) => report?.job?._id?.toString()).filter(Boolean),
    ),
  ];

  const jobs = await jobServices.getJobsByIds(uniqueJobIds);

  /* CREATE JOB MAP FOR ENRICHMENT */

  const jobMap = new Map(jobs.map((job) => [job._id.toString(), job]));

  /* ENRICH REPORTS WITH FULL JOB DETAILS */

  const enrichedReports = reports.map((report) => {
    const jobId = report?.job?._id?.toString();

    return {
      ...report,
      job: jobMap.get(jobId) || report.job || null,
    };
  });

  /* CONSTRUCT METADATA */

  const metaData = {
    page,
    limit,
    totalReports,
    totalPage: Math.ceil(totalReports / limit),
  };

  return {
    reports: enrichedReports,
    metaData,
  };
}

module.exports = {
  getArchivedReports,
};

/**
 * Restore archived reports (change status back to "completed")
 *
 * @param {Array<string>} reportIds - Array of report IDs to restore
 * @returns {Promise<Object>} - { restoredCount, reportIds }
 */
async function restoreArchivedReports(reportIds) {
  try {
    // Convert string IDs to ObjectId
    const objectIds = reportIds.map((id) => new mongoose.Types.ObjectId(id));

    // Verify all reports exist and are archived
    const reports = await ReportModel.find({
      _id: { $in: objectIds },
      status: "archived",
    }).select("_id");

    if (reports.length === 0) {
      const err = new Error("No archived reports found with the provided IDs");
      err.code = 404;
      throw err;
    }

    // Restore by changing status back to "completed"
    const result = await ReportModel.updateMany(
      { _id: { $in: objectIds } },
      { status: "completed" },
    );

    return {
      restoredCount: result.modifiedCount,
      reportIds: reports.map((r) => r._id),
      message: `Successfully restored ${result.modifiedCount} report(s)`,
    };
  } catch (err) {
    throw err;
  }
}

/**
 * Permanently delete archived reports
 * Also deletes associated S3 images
 *
 * @param {Array<string>} reportIds - Array of report IDs to delete
 * @returns {Promise<Object>} - { deletedCount, reportIds, deletedImages }
 */
async function permanentlyDeleteArchivedReports(reportIds) {
  try {
    // Convert string IDs to ObjectId
    const objectIds = reportIds.map((id) => new mongoose.Types.ObjectId(id));

    // Fetch all reports to get their S3 image keys
    const reports = await ReportModel.find({
      _id: { $in: objectIds },
      status: "archived",
    }).select("_id images");

    if (reports.length === 0) {
      const err = new Error("No archived reports found with the provided IDs");
      err.code = 404;
      throw err;
    }

    // Extract all S3 keys from images
    const s3Keys = [];
    reports.forEach((report) => {
      if (report.images && Array.isArray(report.images)) {
        report.images.forEach((image) => {
          if (image.key) {
            s3Keys.push(image.key);
          }
        });
      }
    });

    // Delete images from S3 if any exist
    if (s3Keys.length > 0) {
      try {
        await deleteObjects(s3Keys);
      } catch (s3Error) {
        console.error("Error deleting images from S3:", s3Error);
        // Continue with DB deletion even if S3 fails
      }
    }

    // Delete the reports from database
    const result = await ReportModel.deleteMany({
      _id: { $in: objectIds },
    });

    return {
      deletedCount: result.deletedCount,
      reportIds: reports.map((r) => r._id),
      deletedImages: s3Keys.length,
      message: `Successfully deleted ${result.deletedCount} report(s) and ${s3Keys.length} image(s) from S3`,
    };
  } catch (err) {
    throw err;
  }
}

module.exports = {
  getArchivedReports,
  restoreArchivedReports,
  permanentlyDeleteArchivedReports,
};
