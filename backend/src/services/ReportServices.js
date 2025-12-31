const { Readable } = require("stream");

const mongoose = require("mongoose");

const ReportModel = require("../models/ReportModel");
const { uploadMultiple, deleteMultiple } = require("../utils/s3");

/**
 * Create a new report
 * - Uploads any provided image streams first
 * - If all uploads succeed, creates the Report document
 * - If any step fails, uploaded objects are deleted and an error is thrown
 *
 * @param {Object} payload
 * @param {Object} user - The user creating the report
 * @returns {Promise<Object>} - Created report
 */
async function createReport(payload, user) {
  // Attach the inspector from the user context
  payload.inspector = user._id;

  const incomingImages = Array.isArray(payload.images) ? payload.images : [];

  // Separate images that already have keys/urls from those that need upload
  const toUpload = [];
  const existing = [];

  for (const img of incomingImages) {
    // If a readable stream or buffer is provided, mark for upload
    if (img && (img.stream || img.buffer)) {
      toUpload.push(img);
    } else {
      existing.push(img);
    }
  }

  let uploadResults = [];
  try {
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

    // Merge uploaded results with original metadata
    const finalImages = [];

    // Map uploaded ones (preserve order)
    for (let idx = 0; idx < uploadResults.length; idx++) {
      const res = uploadResults[idx];
      const orig = toUpload[idx];
      finalImages.push({
        imageLabel: orig.imageLabel || "",
        url: res.Location,
        key: res.Key,
        fileName: orig.fileName || orig.filename || res.Key,
        alt: orig.alt || "",
        uploadedBy: orig.uploadedBy || user._id,
        mimeType:
          orig.mimeType || orig.contentType || "application/octet-stream",
        size: orig.size || 0,
        noteForAdmin: orig.noteForAdmin || "",
      });
    }

    // Append existing images (they should already be in right shape)
    for (const e of existing) finalImages.push(e);

    // Create report with images
    const reportPayload = Object.assign({}, payload, { images: finalImages });

    const report = new ReportModel(reportPayload);
    await report.save();
    return report;
  } catch (err) {
    // Cleanup any uploaded objects on failure
    try {
      if (uploadResults && uploadResults.length) {
        const keys = uploadResults.map((u) => u.Key).filter(Boolean);
        if (keys.length) await deleteMultiple(keys);
      }
    } catch (cleanupErr) {
      // swallow cleanup errors but could be logged
      console.error("Error during S3 cleanup:", cleanupErr);
    }

    // rethrow original error
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
  if (!mongoose.Types.ObjectId.isValid(id)) {
    const err = new Error("Report not found");
    err.status = 404;
    err.code = "REPORT_NOT_FOUND";
    throw err;
  }
  const report = await ReportModel.findById(id);
  if (!report) {
    const err = new Error("Report not found");
    err.status = 404;
    err.code = "REPORT_NOT_FOUND";
    throw err;
  }
  return report;
}

/**
 * Get reports with search and pagination
 *
 * @param {Object} query - Query parameters for search and pagination
 * @returns {Promise<Object>} - Object containing reports array and metaData
 */
async function getAllReports(query = {}) {
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 10;
  const skip = (page - 1) * limit;
  const search = query.search?.trim();
  const pipeline = [];
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
