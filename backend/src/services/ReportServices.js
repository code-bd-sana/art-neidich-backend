const { Readable } = require("stream");

const mongoose = require("mongoose");

const ImageLabelModel = require("../models/ImageLabelModel");
const ReportModel = require("../models/ReportModel");
const { uploadMultiple, deleteMultiple } = require("../utils/s3");

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
  const images = Array.isArray(payload.images) ? payload.images : [];

  // Minimum 1, Maximum 2 images
  if (images.length < 1 || images.length > 2) {
    const err = new Error("You must provide at least 1 and maximum 2 images.");
    err.status = 400;
    err.code = "INVALID_IMAGE_COUNT";
    throw err;
  }

  const toUpload = [];
  const existing = [];

  // Separate images needing upload vs already uploaded
  for (const img of images) {
    if (img && (img.stream || img.buffer)) {
      toUpload.push(img);
    } else {
      existing.push(img);
    }
  }

  let uploadResults = [];

  try {
    // 1. Upload new images to AWS
    if (toUpload.length > 0) {
      const params = toUpload.map((i) => {
        const body = i.stream
          ? i.stream
          : i.buffer
          ? Readable.from(i.buffer)
          : null;
        return {
          stream: body,
          filename: i.fileName || i.filename || "file",
          contentType: i.mimeType || i.contentType,
        };
      });

      uploadResults = await uploadMultiple(params);
    }

    // 2. Collect all imageLabel IDs (from both uploaded and existing images)
    const labelIds = [
      ...toUpload.map((i) => i.imageLabel),
      ...existing.map((i) => i.imageLabel),
    ]
      .filter(Boolean)
      .map((id) => new mongoose.Types.ObjectId(id));

    // 3. Fetch all labels in a single query
    const labelsMap = {};
    if (labelIds.length > 0) {
      const labels = await ImageLabelModel.find({
        _id: { $in: labelIds },
      }).select("label");
      for (const lbl of labels) {
        labelsMap[lbl._id.toString()] = lbl.label;
      }
    }

    // 4. Build final images array
    const finalImages = [];

    // Uploaded images
    for (let idx = 0; idx < toUpload.length; idx++) {
      const orig = toUpload[idx];
      const res = uploadResults[idx];
      const labelText = orig.imageLabel
        ? labelsMap[orig.imageLabel.toString()] || ""
        : "";

      finalImages.push({
        imageLabel: labelText,
        url: res.Location,
        key: res.Key,
        fileName: orig.fileName || orig.filename || res.Key,
        alt: orig.alt || "",
        uploadedBy: payload.inspector,
        mimeType: orig.mimeType || "application/octet-stream",
        size: orig.size || 0,
        noteForAdmin: orig.noteForAdmin || "",
      });
    }

    // Existing images
    for (const e of existing) {
      const labelText = e.imageLabel
        ? labelsMap[e.imageLabel.toString()] || ""
        : "";
      finalImages.push({ ...e, imageLabel: labelText });
    }

    // 5. Create report
    const reportPayload = {
      ...payload,
      images: finalImages,
      inspector: payload.inspector,
    };
    const report = new ReportModel(reportPayload);
    await report.save();

    return report;
  } catch (err) {
    // Cleanup uploaded files on AWS if something fails
    try {
      if (uploadResults.length > 0) {
        const keys = uploadResults.map((u) => u.Key).filter(Boolean);
        if (keys.length) await deleteMultiple(keys);
      }
    } catch (cleanupErr) {
      console.error("Error cleaning up AWS uploads:", cleanupErr);
    }

    throw err;
  }
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

    // Lookup labels for images
    {
      $lookup: {
        from: "imagelabels",
        localField: "images.imageLabel",
        foreignField: "_id",
        as: "imageLabels",
      },
    },

    // Map images with label name
    {
      $addFields: {
        images: {
          $map: {
            input: "$images",
            as: "img",
            in: {
              label: {
                $arrayElemAt: [
                  {
                    $map: {
                      input: {
                        $filter: {
                          input: "$imageLabels",
                          as: "lbl",
                          cond: { $eq: ["$$lbl._id", "$$img.imageLabel"] },
                        },
                      },
                      as: "lbl",
                      in: "$$lbl.label",
                    },
                  },
                  0,
                ],
              },
              fileName: "$$img.fileName",
              url: "$$img.url",
              key: "$$img.key",
              alt: "$$img.alt",
              mimeType: "$$img.mimeType",
              size: "$$img.size",
              noteForAdmin: "$$img.noteForAdmin",
            },
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
          _id: 1,
          orderId: 1,
          streetAddress: 1,
          developmentName: 1,
          siteContactName: 1,
          siteContactPhone: 1,
          siteContactEmail: 1,
          dueDate: 1,
          createdAt: 1,
          updatedAt: 1,
          createdBy: {
            _id: "$job.createdBy._id",
            firstName: "$job.createdBy.firstName",
            lastName: "$job.createdBy.lastName",
            email: "$job.createdBy.email",
            role: {
              $switch: {
                branches: [
                  {
                    case: { $eq: ["$job.createdBy.role", 0] },
                    then: "Super Admin",
                  },
                  { case: { $eq: ["$job.createdBy.role", 1] }, then: "Admin" },
                  {
                    case: { $eq: ["$job.createdBy.role", 2] },
                    then: "Inspector",
                  },
                ],
                default: "Unknown",
              },
            },
          },
          lastUpdatedBy: {
            _id: "$job.lastUpdatedBy._id",
            firstName: "$job.lastUpdatedBy.firstName",
            lastName: "$job.lastUpdatedBy.lastName",
            email: "$job.lastUpdatedBy.email",
            role: {
              $switch: {
                branches: [
                  {
                    case: { $eq: ["$job.lastUpdatedBy.role", 0] },
                    then: "Super Admin",
                  },
                  {
                    case: { $eq: ["$job.lastUpdatedBy.role", 1] },
                    then: "Admin",
                  },
                  {
                    case: { $eq: ["$job.lastUpdatedBy.role", 2] },
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
  const { status } = updateData;
  const report = await ReportModel.findById(id);
  if (!report) {
    const err = new Error("Report not found");
    err.status = 404;
    err.code = "REPORT_NOT_FOUND";
    throw err;
  }
  report.status = status;
  if (updateData.lastUpdatedBy) {
    report.lastUpdatedBy = updateData.lastUpdatedBy;
  }
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
  getReportById,
};
