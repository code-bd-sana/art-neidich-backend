const path = require("path");
const { Readable } = require("stream");

const mongoose = require("mongoose");

const { notifyAdmins } = require("../helpers/notification/notification-helper");
const ImageLabelModel = require("../models/ImageLabelModel");
const JobModel = require("../models/JobModel");
const NotificationModel = require("../models/NotificationModel");
const ReportModel = require("../models/ReportModel");
const { uploadStreams, deleteObjects } = require("../utils/s3");
const puppeteer = require("puppeteer");
const fs = require("fs");
const { sendMail } = require("../utils/mailer");

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
  // Validate job ID
  const jobId = new mongoose.Types.ObjectId(payload.job);

  // Job existence check
  if (!(await JobModel.exists({ _id: jobId }))) {
    const err = new Error("Associated job not found");
    err.code = 404;
    throw err;
  }

  // Duplicate report check
  if (await ReportModel.exists({ job: jobId })) {
    const err = new Error("A report already exists for this job");
    err.code = 400;
    throw err;
  }

  // Validate images
  const imagesInput = Array.isArray(payload.images) ? payload.images : [];

  // Require at least 1 image
  if (imagesInput.length < 1) {
    const err = new Error("At least 1 image is required");
    err.code = 400;
    throw err;
  }

  // Fetch labels (optimized single query)
  const labelIds = [
    ...new Set(
      imagesInput.map((img) => new mongoose.Types.ObjectId(img.imageLabel)),
    ),
  ];

  // Fetch labels from DB
  const labels = await ImageLabelModel.find({ _id: { $in: labelIds } })
    .select("label")
    .lean();

  // Map label IDs to strings
  const labelMap = new Map(labels.map((l) => [l._id.toString(), l.label]));

  // Prepare images with string label
  const finalImagesPlaceholder = imagesInput.map((img) => {
    const labelStr = labelMap.get(img.imageLabel);
    if (!labelStr) {
      const err = new Error("Image label not found");
      err.code = 400;
      throw err;
    }
    return {
      imageLabel: labelStr,
      url: "", // will be filled after upload
      key: "", // will be filled after upload
      fileName: img.fileName || "image",
      alt: img.alt || "",
      uploadedBy: payload.inspector,
      mimeType: img.mimeType || "application/octet-stream",
      size: img.size || 0,
      buffer: img.buffer, // temporary, only for upload
    };
  });

  // Create report document FIRST (to get _id)
  const report = new ReportModel({
    ...payload,
    job: jobId,
    inspector: payload.inspector,
    images: finalImagesPlaceholder.map((img) => ({
      ...img,
      url: "pending", // temporary placeholder
      key: "pending",
    })),
    noteForAdmin: payload.noteForAdmin || "",
  });

  await report.save();

  // Now upload images using report._id as folder prefix
  const folderPrefix = `reports/${report._id.toString()}`;

  let uploadedResults = [];

  try {
    // Upload images to S3
    const toUpload = finalImagesPlaceholder.filter((img) => img.buffer);

    // Only upload if there are images with buffers
    if (toUpload.length > 0) {
      // Prepare upload items
      const uploadItems = toUpload.map((img, index) => ({
        stream: Readable.from(img.buffer),
        originalName: img.fileName,
        contentType: img.mimeType,
        folderPrefix, // ← key change: pass folder prefix
      }));

      // Perform uploads
      uploadedResults = await uploadStreams(uploadItems);

      // Check for any failed uploads
      const failed = uploadedResults.filter((r) => r.status === "rejected");

      // If any failed, cleanup and throw error
      if (failed.length > 0) {
        const keysToDelete = uploadedResults
          .filter((r) => r.status === "fulfilled")
          .map((r) => r.value.Key);

        // Delete successfully uploaded objects
        if (keysToDelete.length) await deleteObjects(keysToDelete);

        // Throw error after cleanup
        const err = new Error("At least 1 image is required");
        err.code = 400;
        throw err;
      }

      // Extract fulfilled values
      uploadedResults = uploadedResults.map((r) => r.value);
    }

    // Update report with real S3 data
    const finalImages = [];
    let uploadIndex = 0;

    // Map uploaded results back to final images
    for (const orig of finalImagesPlaceholder) {
      if (orig.buffer) {
        const uploaded = uploadedResults[uploadIndex++];
        finalImages.push({
          imageLabel: orig.imageLabel,
          url: uploaded.Location,
          key: uploaded.Key,
          fileName: orig.fileName || path.basename(uploaded.Key),
          alt: orig.alt || "",
          uploadedBy: payload.inspector,
          mimeType: orig.mimeType,
          size: orig.size,
        });
      } else {
        // If you support existing images (without buffer)
        finalImages.push({
          ...orig,
          buffer: undefined,
        });
      }
    }

    // Update the report document with final image data
    report.images = finalImages;
    await report.save();

    // Notify admins about new report submission
    try {
      const types = NotificationModel.notificationTypes || {};

      await notifyAdmins({
        type: types.REPORT_SUBMITTED || "report_submitted",
        title: "New Report Submitted",
        body: `A new report has been submitted by ${payload.inspectorName || "an inspector"}.`,
        data: {
          reportId: new mongoose.Types.ObjectId(report._id),
          jobId: new mongoose.Types.ObjectId(jobId),
          action: "view_report",
        },
        authorId: new mongoose.Types.ObjectId(payload.inspector),
      });
    } catch (e) {
      console.error("Failed to create/send job report notifications:", e);
    }

    // 8. Return the complete report
    const createdReport = await getReportById(report._id);

    //report send to mail admin mail
    reportSendToMail(createdReport.data ?? createdReport); 

    return createdReport;
  } catch (err) {
    // Cleanup images if report was created but upload failed
    if (uploadedResults.length > 0) {
      // Delete successfully uploaded images from S3
      const keys = uploadedResults.map((u) => u?.Key).filter(Boolean);

      // Delete objects from S3
      if (keys.length) await deleteObjects(keys).catch(console.error);
    }

    // Optional: delete the incomplete report document
    await ReportModel.deleteOne({ _id: report._id }).catch(console.error);

    // Rethrow the error
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
  // Pagination params
  const page = parseInt(query.page, 10) || 1;
  const limit = parseInt(query.limit, 10) || 10;
  const skip = (page - 1) * limit;
  const matchStage = {
    status: { $ne: "archived" } // Exclude archived reports
  };

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

  // If search term provided
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
  }
  // If not searching, still need to lookup for projection
  else {
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

  // Paginated reports
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
  // Aggregation to fetch report with related data
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
        noteForAdmin: { $first: "$noteForAdmin" },
        images: {
          $push: {
            fileName: "$images.fileName",
            url: "$images.url",
            key: "$images.key",
            alt: "$images.alt",
            mimeType: "$images.mimeType",
            size: "$images.size",
          },
        },
        createdAt: { $first: "$createdAt" },
        updatedAt: { $first: "$updatedAt" },
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
        noteForAdmin: { $first: "$noteForAdmin" },
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
        noteForAdmin: 1,
        createdAt: 1,
        updatedAt: 1,
        images: 1,
      },
    },
  ]);

  // If no report found
  if (!report) {
    const err = new Error("Report not found");
    err.code = 404;
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
  // Extract status and lastUpdatedBy
  const { status, lastUpdatedBy } = updateData;
  const isCompleted = status === 'completed';

  // Update the report status
  const updated = await ReportModel.findByIdAndUpdate(
    id,
    {
      $set: {
        status,
        lastUpdatedBy,
        updatedAt: new Date(),
        ...(isCompleted && { completedAt: new Date() }),
      },
    },
    { new: true },
  );

  // If no report found to update
  if (!updated) {
    const err = new Error("Report not found");
    err.code = 404;
    throw err;
  }

  // If the report status updated successfully, then notify admin users
  try {
    const types = NotificationModel.notificationTypes || {};

    await notifyAdmins({
      type: types.REPORT_STATUS_UPDATED || "report_status_updated",
      title: "Report Status Updated",
      body: `The status of a report has been updated to "${status}".`,
      data: {
        reportId: new mongoose.Types.ObjectId(id),
        action: "view_report",
      },
      authorId: new mongoose.Types.ObjectId(lastUpdatedBy),
    });
  } catch (error) {
    console.error("Error sending notification to admins:", error);
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
  // Check if report exists
  const report = await ReportModel.findById(id);

  // If not found, throw error
  if (!report) {
    const err = new Error("Report not found");
    err.code = 404;
    throw err;
  }
  await ReportModel.findByIdAndDelete(id);
}

async function reportSendToMail(report) {
  try {
    const toEmail = report.job?.createdBy?.email;
    if (!toEmail) {
      console.error("reportSendToMail: email not found in report!");
      return;
    }

    const pdfBuffer = await generateReportPDF(report);
    await sendMail({
      to: toEmail,
      subject: `Inspection Report - Order ID: ${report.job?.orderId || report._id}`,
      html: `<p>Dear ${report.job?.createdBy?.firstName || "Sir/Madam"},</p>
             <p>Please find the attached inspection report.</p>
             <p><strong>Order ID:</strong> ${report.job?.orderId || "N/A"}</p>
             <p><strong>Inspector:</strong> ${report.inspector?.firstName} ${report.inspector?.lastName}</p>`,
      attachments: [
        {
          filename: `report-${report._id}.pdf`,
          content: pdfBuffer,
          contentType: "application/pdf",
        },
      ],
    });
  } catch (err) {
    console.error("reportSendToMail error:", err.message);
  }
}

async function generateReportPDF(report) {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();
  const html = buildReportHTML(report);
  await page.setContent(html, { waitUntil: "networkidle0" });

  const pdfBuffer = await page.pdf({
    format: "A4",
    printBackground: true,
    margin: { top: "15mm", bottom: "15mm", left: "12mm", right: "12mm" },
    displayHeaderFooter: true,
    headerTemplate: `<span></span>`,
    footerTemplate: `
    <div style="
      width: 100%;
      font-size: 9px;
      color: #888;
      text-align: center;
      padding-bottom: 4px;
    ">
      <span class="pageNumber"></span>
    </div>
  `,
  });

  await browser.close();
  return pdfBuffer;
}

function loadBase64(filePath) {
  try {
    return `data:image/png;base64,${fs.readFileSync(filePath).toString("base64")}`;
  } catch {
    return "";
  }
}

const LOGO_TOP = loadBase64(
  path.join(__dirname, "../../public/images/logo.png"),
);
const LOGO_FOOTER_LEFT = loadBase64(
  path.join(__dirname, "../../public/images/footer-logo-left.png"),
);
const LOGO_FOOTER_RIGHT = loadBase64(
  path.join(__dirname, "../../public/images/footer-logo-right.png"),
);

function buildReportHTML(report) {
  const job = report.job || {};
  const inspector = report.inspector || {};
  const images = report.images || [];

  const imageGroupsHTML = images
    .map(
      (group) => `
      <div class="room-section">
        <h2 class="room-title">${group.imageLabel}</h2>
        <div class="image-grid">
          ${group.images
            .map(
              (img) => `
            <div class="image-box">
              <img src="${img?.url}" alt="${img?.alt || img?.fileName}" />
            </div>
          `,
            )
            .join("")}
        </div>
      </div>
    `,
    )
    .join("");

  return `<!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8"/>
        <style>
          * { margin:0; padding:0; box-sizing:border-box; }
          body { font-family: Roboto, sans-serif; font-size: 13px; color: #222; background:#fff; }

          /* ── HEADER ── */
          .header {
            text-align: center;
            margin-bottom: 40px;
          }
          .header img.top-logo {
            height: 52px;
            margin-bottom: 6px;
          }
          .header .company-sub {
            font-size: 10px;
            color: #474747;
            margin-bottom: 2px;
          }
          .header .report-title {
            font-size: 18px;
            font-weight: bold;
            color: #2D8D7C;
            margin-bottom: 2px;
          }
          .header .fha-line {
            font-size: 12px;
            color: #474747;
          }

          /* ── META INFO ── */
          .meta-section {
            margin-bottom: 30px;
          }
          .meta-row {
            display: flex;
            justify-content: space-between;
            font-size: 14px;
          }
          .meta-row .meta-left { flex: 1; }
          .meta-row .meta-right { text-align: right; }
          .meta-label { font-weight: bold; }

          .line{
            border: 1px solid #EFEFF1;
            margin-bottom: 30px;
          }
          /* ── ROOM SECTION ── */
          .room-section {
            margin-bottom: 28px;
            page-break-inside: avoid;
          }
          .room-title {
            font-size: 15px;
            font-weight: bold;
            margin-bottom: 10px;
          }
          .image-grid {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
          }
          .image-box {
            width: calc(50% - 5px);
          }
          .image-box img {
            width: 100%;
            height: 215px;
            object-fit: cover;
            border-radius: 3px;
          }

          /* ── FOOTER ── */
          .footer {
            margin-top: 30px;
            border-top: 1px solid #ddd;
            padding-top: 10px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
          }
          .footer img {
            height: 38px;
          }
          .footer-text {
            flex: 1;
            text-align: center;
            font-size: 9.5px;
            color: #444;
            line-height: 1.6;
          }
          .footer-text .footer-main {
            font-weight: bold;
            margin-bottom: 2px;
            font-size: 12px;
          }

         
        </style>
      </head>
      <body>

        <!-- HEADER -->
        <div class="header">
          ${LOGO_TOP ? `<img class="top-logo" src="${LOGO_TOP}" alt="Logo" />` : ""}
          <p class="company-sub">A Division of Lone Star Building Inspection, Inc.</p>
          <p class="report-title">Inspection report</p>
          <p class="fha-line">Attachment to FHA form # ${job.formType?.match(/\d+/)?.[0] || job.orderId || "N/A"}</p>
        </div>

        <!-- META INFO -->
        <div class="meta-section">
          <div class="meta-row">
            <div class="meta-left">
              <span class="meta-label">Type of Inspection:</span>
              ${job.formType || "N/A"}
            </div>
            <div class="meta-right">
              <span class="meta-label">Date of Inspection:</span>
              ${new Date(report.createdAt).toLocaleDateString("en-US", {
                month: "2-digit",
                day: "2-digit",
                year: "numeric",
              })}
            </div>
          </div>
          <div class="meta-row">
            <div class="meta-left">
              <span class="meta-label">Subject Property:</span>
              ${job.streetAddress || "N/A"}
            </div>
            <div class="meta-right">
              <span class="meta-label">Case:</span>
              # ${job.fhaCaseDetailsNo || "N/A"}
            </div>
          </div>
        </div>

        <div class="line"></div>

        <!-- IMAGE GROUPS -->
        ${imageGroupsHTML}

        <!-- FOOTER -->
        <div class="footer">
          ${LOGO_FOOTER_LEFT ? `<img src="${LOGO_FOOTER_LEFT}" alt="Footer Logo Left" />` : ""}
          <div class="footer-text">
            <i class="footer-main">All Utilities Are On And Tested Unless Otherwise Noted</i>
            <p>TREC Lic. # 10546 | TSBPE Lic. # I-3836 | Code Enforcement Lic. # 7055 | HUD-FHA Fee Reg.#</p>
            <p>D683 & 203K - D0931</p>
          </div>
          ${LOGO_FOOTER_RIGHT ? `<img src="${LOGO_FOOTER_RIGHT}" alt="Footer Logo Right" />` : ""}
        </div>

      </body>
    </html>`;
}

module.exports = {
  createReport,
  getAllReports,
  updateReportStatus,
  getReportById,
  deleteReport,
  generateReportPDF,
};
