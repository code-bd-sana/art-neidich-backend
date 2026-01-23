const path = require("path");
const { Readable } = require("stream");

const mongoose = require("mongoose");

const ImageLabelModel = require("../models/ImageLabelModel");
const JobModel = require("../models/JobModel");
const ReportModel = require("../models/ReportModel");
const { uploadStreams, deleteObjects } = require("../utils/s3");

/**
 * Create a new report
 * - Uploads any provided image streams first
 * - If all uploads succeed, creates the Report document
 * - If any step fails, uploaded objects are deleted and an error is thrown
 *
 * @param {Object} payload - Report data
 * @param {Array<Object>} payload.images - Array of image objects
 * @returns {Promise<Object>} - Created report
 */
async function createReport(payload) {
  const jobId = new mongoose.Types.ObjectId(payload.job);

  console.log("createReport started for job:", jobId.toString());

  // 1. Job existence check
  if (!(await JobModel.exists({ _id: jobId }))) {
    const err = new Error("Associated job not found");
    err.status = 404;
    throw err;
  }

  // 2. Duplicate report check
  if (await ReportModel.exists({ job: jobId })) {
    const err = new Error("A report already exists for this job");
    err.status = 400;
    throw err;
  }

  const imagesInput = Array.isArray(payload.images) ? payload.images : [];
  if (imagesInput.length < 1) {
    const err = new Error("At least 1 image is required");
    err.status = 400;
    throw err;
  }

  // 3. Collect all unique imageLabel IDs
  const labelIds = [...new Set(imagesInput.map((img) => img.imageLabel))];
  console.log("Fetching labels for IDs:", labelIds);

  // Single DB query – optimized
  const labels = await ImageLabelModel.find({
    _id: { $in: labelIds },
  })
    .select("label")
    .lean();

  const labelMap = new Map(labels.map((l) => [l._id.toString(), l.label]));

  // 4. Validate labels & prepare upload list
  const toUpload = [];
  for (const img of imagesInput) {
    const labelStr = labelMap.get(img.imageLabel);
    if (!labelStr) {
      const err = new Error(`Invalid imageLabel ID: ${img.imageLabel}`);
      err.status = 400;
      throw err;
    }

    toUpload.push({
      ...img,
      imageLabel: labelStr, // ID → string
    });
  }

  let uploadedResults = [];

  try {
    // 5. Upload images if any
    if (toUpload.length > 0) {
      console.log(`Uploading ${toUpload.length} images...`);

      const uploadItems = toUpload.map((img) => ({
        stream: Readable.from(img.buffer),
        originalName: img.fileName || "image",
        contentType: img.mimeType || "application/octet-stream",
      }));

      uploadedResults = await uploadStreams(uploadItems);

      // Check for failures
      const failed = uploadedResults.filter((r) => r.status === "rejected");
      if (failed.length > 0) {
        const keysToDelete = uploadedResults
          .filter((r) => r.status === "fulfilled")
          .map((r) => r.value?.Key)
          .filter(Boolean);

        if (keysToDelete.length) {
          console.log("Cleaning up partial uploads:", keysToDelete);
          await deleteObjects(keysToDelete);
        }

        throw failed[0].reason || new Error("One or more image uploads failed");
      }

      uploadedResults = uploadedResults.map((r) => r.value);
      console.log("All uploads successful");
    }

    // 6. Build final images array
    const finalImages = [];
    let uploadIndex = 0;

    for (const orig of imagesInput) {
      const labelStr = labelMap.get(orig.imageLabel);

      if (orig.buffer) {
        const uploaded = uploadedResults[uploadIndex++];
        finalImages.push({
          imageLabel: labelStr,
          url: uploaded.Location,
          key: uploaded.Key,
          fileName: orig.fileName || path.basename(uploaded.Key),
          alt: orig.alt || "",
          uploadedBy: payload.inspector,
          mimeType: orig.mimeType || "application/octet-stream",
          size: orig.size || 0,
          noteForAdmin: orig.noteForAdmin || "",
        });
      } else {
        // existing image (if any)
        finalImages.push({
          ...orig,
          imageLabel: labelStr,
          uploadedBy: orig.uploadedBy || payload.inspector,
        });
      }
    }

    // 7. Save report
    const report = new ReportModel({
      ...payload,
      job: jobId,
      inspector: payload.inspector,
      images: finalImages,
    });

    await report.save();
    console.log("Report saved successfully:", report._id.toString());

    // Optional: return populated report
    return getReportById(report._id);
  } catch (err) {
    // Cleanup on error
    if (uploadedResults.length > 0) {
      const keys = uploadedResults.map((u) => u?.Key).filter(Boolean);
      if (keys.length > 0) {
        console.log("Cleanup triggered for keys:", keys);
        await deleteObjects(keys).catch(console.error);
      }
    }
    throw err;
  }
}

/**
 * Get all reports with optional search and pagination
 *
 * @param {Object} query - Query parameters
 * @returns {Promise<{reports: Array<Object>, metaData: Object}>} - Reports and metadata
 */
async function getAllReports(query) {
  const page = parseInt(query.page, 10) || 1;
  const limit = parseInt(query.limit, 10) || 10;
  const skip = (page - 1) * limit;
  const matchStage = {};

  // Optional filtering by status
  if (query.status && query.status !== "all") {
    if (query.status === "in_progress") {
      matchStage.status = { $in: [null, "in_progress"] };
    } else {
      matchStage.status = query.status;
    }
  }

  // Optional search
  let searchPipeline = [];
  if (query.search && query.search.trim()) {
    const search = query.search.trim();
    const esc = search.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&");
    const regex = new RegExp(esc, "i");
    searchPipeline = [
      // Lookup inspector for search
      {
        $lookup: {
          from: "users",
          localField: "inspector",
          foreignField: "_id",
          as: "inspector",
        },
      },
      { $unwind: "$inspector" },
      // Lookup job for search
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
            { "job.streetAddress": regex },
            { "job.developmentName": regex },
            { "job.siteContactName": regex },
            { "inspector.firstName": regex },
            { "inspector.lastName": regex },
            {
              $expr: {
                $regexMatch: {
                  input: {
                    $concat: [
                      "$inspector.firstName",
                      " ",
                      "$inspector.lastName",
                    ],
                  },
                  regex: esc,
                  options: "i",
                },
              },
            },
          ],
        },
      },
    ];
  } else {
    // If not searching, still need to lookup for projection
    searchPipeline = [
      {
        $lookup: {
          from: "users",
          localField: "inspector",
          foreignField: "_id",
          as: "inspector",
        },
      },
      { $unwind: "$inspector" },
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

  // Compose aggregation pipeline
  const pipeline = [
    { $match: matchStage },
    ...searchPipeline,
    { $sort: { createdAt: -1 } },
    { $skip: skip },
    { $limit: limit },
    {
      $project: {
        inspector: {
          _id: "$inspector._id",
          userId: "$inspector.userId",
          firstName: "$inspector.firstName",
          lastName: "$inspector.lastName",
          email: "$inspector.email",
          role: "Inspector",
        },
        job: {
          _id: "$job._id",
          formType: "$job.formType",
          fhaCaseDetailsNo: "$job.fhaCaseDetailsNo",
          orderId: "$job.orderId",
          streetAddress: "$job.streetAddress",
          developmentName: "$job.developmentName",
          siteContactName: "$job.siteContactName",
          siteContactPhone: "$job.siteContactPhone",
          siteContactEmail: "$job.siteContactEmail",
          dueDate: "$job.dueDate",
        },
        status: 1,
        createdAt: 1,
        updatedAt: 1,
      },
    },
  ];

  // For total count, use same pipeline but without skip/limit/sort
  const countPipeline = [
    { $match: matchStage },
    ...searchPipeline,
    { $count: "total" },
  ];
  const countResult = await ReportModel.aggregate(countPipeline);
  const totalReports = countResult[0]?.total || 0;

  const reports = await ReportModel.aggregate(pipeline);

  const metaData = {
    total: totalReports,
    page,
    limit,
    totalPages: Math.ceil(totalReports / limit),
  };

  return { reports, metaData };
}

/**
 * Get a single report by id
 *
 * @param {string} id - Report ID
 * @returns {Promise<Object>} - Report document
 */
async function getReportById(id) {
  const [report] = await ReportModel.aggregate([
    { $match: { _id: new mongoose.Types.ObjectId(id) } },

    // Lookup inspector
    {
      $lookup: {
        from: "users",
        localField: "inspector",
        foreignField: "_id",
        as: "inspector",
      },
    },
    { $unwind: "$inspector" },

    // Lookup job
    {
      $lookup: {
        from: "jobs",
        localField: "job",
        foreignField: "_id",
        as: "job",
      },
    },
    { $unwind: "$job" },

    // Lookup job createdBy
    {
      $lookup: {
        from: "users",
        localField: "job.createdBy",
        foreignField: "_id",
        as: "job.createdBy",
      },
    },
    { $unwind: { path: "$job.createdBy", preserveNullAndEmptyArrays: true } },

    // Lookup job lastUpdatedBy
    {
      $lookup: {
        from: "users",
        localField: "job.lastUpdatedBy",
        foreignField: "_id",
        as: "job.lastUpdatedBy",
      },
    },
    {
      $unwind: {
        path: "$job.lastUpdatedBy",
        preserveNullAndEmptyArrays: true,
      },
    },

    // Unwind images to process each one
    { $unwind: { path: "$images", preserveNullAndEmptyArrays: true } },

    // Group images by imageLabel (ObjectId)
    {
      $group: {
        _id: {
          reportId: "$_id",
          imageLabel: "$images.imageLabel", // Keep the ObjectId
        },
        inspector: { $first: "$inspector" },
        job: { $first: "$job" },
        jobCreatedBy: { $first: "$job.createdBy" },
        jobLastUpdatedBy: { $first: "$job.lastUpdatedBy" },
        status: { $first: "$status" },
        createdAt: { $first: "$createdAt" },
        updatedAt: { $first: "$updatedAt" },
        images: {
          $push: {
            fileName: "$images.fileName",
            url: "$images.url",
            key: "$images.key",
            alt: "$images.alt",
            mimeType: "$images.mimeType",
            size: "$images.size",
            noteForAdmin: "$images.noteForAdmin",
          },
        },
      },
    },

    // Group back by report to create label groups
    {
      $group: {
        _id: "$_id.reportId",
        inspector: { $first: "$inspector" },
        job: { $first: "$job" },
        jobCreatedBy: { $first: "$jobCreatedBy" },
        jobLastUpdatedBy: { $first: "$jobLastUpdatedBy" },
        status: { $first: "$status" },
        createdAt: { $first: "$createdAt" },
        updatedAt: { $first: "$updatedAt" },
        images: {
          $push: {
            imageLabel: "$_id.imageLabel", // Direct ObjectId
            images: "$images",
          },
        },
      },
    },

    // Project final fields
    {
      $project: {
        inspector: {
          _id: "$inspector._id",
          userId: "$inspector.userId",
          firstName: "$inspector.firstName",
          lastName: "$inspector.lastName",
          email: "$inspector.email",
          role: "Inspector",
        },
        job: {
          _id: "$job._id",
          fhaCaseDetailsNo: "$job.fhaCaseDetailsNo",
          formType: "$job.formType",
          orderId: "$job.orderId",
          streetAddress: "$job.streetAddress",
          developmentName: "$job.developmentName",
          siteContactName: "$job.siteContactName",
          siteContactPhone: "$job.siteContactPhone",
          siteContactEmail: "$job.siteContactEmail",
          dueDate: "$job.dueDate",
          createdAt: "$job.createdAt",
          updatedAt: "$job.updatedAt",
          createdBy: {
            _id: "$jobCreatedBy._id",
            firstName: "$jobCreatedBy.firstName",
            lastName: "$jobCreatedBy.lastName",
            email: "$jobCreatedBy.email",
            role: {
              $switch: {
                branches: [
                  {
                    case: { $eq: ["$jobCreatedBy.role", 0] },
                    then: "Super Admin",
                  },
                  { case: { $eq: ["$jobCreatedBy.role", 1] }, then: "Admin" },
                  {
                    case: { $eq: ["$jobCreatedBy.role", 2] },
                    then: "Inspector",
                  },
                ],
                default: "Unknown",
              },
            },
          },
          lastUpdatedBy: {
            _id: "$jobLastUpdatedBy._id",
            firstName: "$jobLastUpdatedBy.firstName",
            lastName: "$jobLastUpdatedBy.lastName",
            email: "$jobLastUpdatedBy.email",
            role: {
              $switch: {
                branches: [
                  {
                    case: { $eq: ["$jobLastUpdatedBy.role", 0] },
                    then: "Super Admin",
                  },
                  {
                    case: { $eq: ["$jobLastUpdatedBy.role", 1] },
                    then: "Admin",
                  },
                  {
                    case: { $eq: ["$jobLastUpdatedBy.role", 2] },
                    then: "Inspector",
                  },
                ],
                default: "Unknown",
              },
            },
          },
        },
        status: 1,
        createdAt: 1,
        updatedAt: 1,
        images: 1,
      },
    },
  ]);

  if (!report) {
    const err = new Error("Report not found");
    err.status = 404;
    err.code = "REPORT_NOT_FOUND";
    throw err;
  }

  return report;
}

/**
 * Update only the status of a report
 *
 * @param {string} id - Report ID
 * @param {Object} updateData - Data to update
 * @returns {Promise<Object>} - Updated report document
 */
async function updateReportStatus(id, updateData) {
  const { status, lastUpdatedBy } = updateData;

  const updated = await ReportModel.findByIdAndUpdate(
    id,
    {
      $set: {
        status,
        lastUpdatedBy,
        updatedAt: new Date(),
      },
    },
    { new: true },
  );

  if (!updated) {
    const err = new Error("Report not found");
    err.status = 404;
    err.code = "REPORT_NOT_FOUND";
    throw err;
  }

  // Return EXACT SAME response as GET BY ID
  return await getReportById(id);
}

/**
 * Delete a report by id
 *
 * @param {string} id - Report ID
 * @returns {Promise<void>}
 */
async function deleteReport(id) {
  const report = await ReportModel.findById(id);
  if (!report) {
    const err = new Error("Report not found");
    err.status = 404;
    err.code = "REPORT_NOT_FOUND";
    throw err;
  }
  await ReportModel.findByIdAndDelete(id);
}

module.exports = {
  createReport,
  getAllReports,
  updateReportStatus,
  getReportById,
  deleteReport,
};
