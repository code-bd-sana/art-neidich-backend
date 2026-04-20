const mongoose = require("mongoose");
const JobModel = require("../models/JobModel");
const ReportModel = require("../models/ReportModel");
const { deleteObjects } = require("../utils/s3");

/**
 * Get archived reports with pagination, search, and filtering
 *
 * @param {Object} query - Query parameters
 * @param {number} query.page - Page number (default: 1)
 * @param {number} query.limit - Items per page (default: 10)
 * @param {string} query.search - Search term (optional)
 * @returns {Promise<Object>} - { reports, metaData }
 */
async function getArchivedReports(query) {
  // Pagination params
  const page = parseInt(query.page, 10) || 1;
  const limit = parseInt(query.limit, 10) || 10;
  const skip = (page - 1) * limit;

  // Match stage - filter only archived reports
  const matchStage = { status: "archived" };

  // Build search pipeline
  let searchPipeline = [];

  // If search term provided
  if (query.search && query.search.trim()) {
    const search = query.search.trim();
    const esc = search.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&");
    const regex = new RegExp(esc, "i");

    searchPipeline = [
      // Lookup job for search and display
      {
        $lookup: {
          from: "jobs",
          localField: "job",
          foreignField: "_id",
          as: "job",
        },
      },
      { $unwind: "$job" },
      {
        $match: {
          $or: [
            { "job.orderId": regex },
            { "job.fhaCaseDetailsNo": regex },
            { "job.streetAddress": regex },
            { "job.developmentName": regex },
          ],
        },
      },
    ];
  } else {
    // Still need to lookup for projection
    searchPipeline = [
      {
        $lookup: {
          from: "jobs",
          localField: "job",
          foreignField: "_id",
          as: "job",
        },
      },
      { $unwind: "$job" },
    ];
  }

  // Build aggregation pipeline
  const countPipeline = [{ $match: matchStage }, ...searchPipeline];

  const dataPipeline = [
    { $match: matchStage },
    ...searchPipeline,
    { $sort: { createdAt: -1 } },
    { $skip: skip },
    { $limit: limit },
    {
      $project: {
        _id: 1,
        job: {
          _id: "$job._id",
          fhaCaseDetailsNo: "$job.fhaCaseDetailsNo",
          orderId: "$job.orderId",
          streetAddress: "$job.streetAddress",
          developmentName: "$job.developmentName",
        },
        status: 1,
        createdAt: 1,
        completedAt: 1,
      },
    },
  ];

  // Execute queries
  const [reports, countResult] = await Promise.all([
    ReportModel.aggregate(dataPipeline),
    ReportModel.aggregate([...countPipeline, { $count: "total" }]),
  ]);

  // Extract total count
  const total = countResult.length > 0 ? countResult[0].total : 0;

  // Calculate metadata
  const totalPages = Math.ceil(total / limit);

  const metaData = {
    currentPage: page,
    totalPages,
    totalItems: total,
    itemsPerPage: limit,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };

  return {
    reports,
    metaData,
  };
}

/**
 * Restore archived reports (change status back to "completed")
 *
 * @param {Array<string>} reportIds - Array of report IDs to restore
 * @returns {Promise<Object>} - { restoredCount, reportIds }
 */
async function restoreArchivedReports(reportIds) {
  try {
    // Convert string IDs to ObjectId
    const objectIds = reportIds.map(
      (id) => new mongoose.Types.ObjectId(id),
    );

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
    const objectIds = reportIds.map(
      (id) => new mongoose.Types.ObjectId(id),
    );

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
