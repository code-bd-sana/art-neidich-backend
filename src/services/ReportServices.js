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
    status: { $ne: "archived" }, // Exclude archived reports
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
          imageLabel: "$images.imageLabel",
        },
        inspector: { $first: "$inspector" },
        job: { $first: "$job" },
        jobCreatedBy: { $first: "$job.createdBy" },
        jobLastUpdatedBy: { $first: "$job.lastUpdatedBy" },
        status: { $first: "$status" },
        noteForAdmin: { $first: "$noteForAdmin" },

        // ONLY ONE IMAGE
        image: {
          $first: {
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
            imageLabel: "$_id.imageLabel",
            image: "$image", // single object instead of array
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
  const isCompleted = status === "completed";

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
  // 1. Find report
  const report = await ReportModel.findById(id);

  if (!report) {
    const err = new Error("Report not found");
    err.code = 404;
    throw err;
  }

  // 2. Extract S3 keys
  const keys = (report.images || [])
    .map((img) => img.key)
    .filter((key) => key && key !== "pending");

  // 3. Delete images from S3 (safe attempt)
  if (keys.length > 0) {
    try {
      await deleteObjects(keys);
    } catch (err) {
      console.error("S3 deletion failed:", err.message);
      // Optional: decide if you want to block deletion or not
      // For now, we proceed to delete DB anyway
    }
  }

  // 4. Delete report from DB
  await ReportModel.findByIdAndDelete(id);
}

async function reportSendToMail(report) {
  try {
    const toEmail = "sahadatjhpi@gmail.com"; //"inspect@artneidich.com"; //report.job?.createdBy?.email;
    if (!toEmail) {
      console.error("reportSendToMail: email not found in report!");
      return;
    }

    const pdfBuffer = await generateReportPDF(report);
    const isSend = await sendMail({
      to: toEmail,
      subject: `Inspection Report - ${report.job.streetAddress || report.job?.orderId } }`,
      html: `<p>Dear ${report.job?.createdBy?.firstName || "Sir/Madam"},</p>
             <p>Please find the attached inspection report.</p>
             <p><strong>Order ID:</strong> ${report.job?.orderId || "N/A"}</p>
             <p><strong>Inspector:</strong> ${report.inspector?.firstName} ${report.inspector?.lastName}</p>
             <p><strong>Address:</strong> ${report.job?.streetAddress}</p>`,
      attachments: [
        {
          filename: `${report.job.streetAddress ? report.job.streetAddress : "inspection-report"}.pdf`,
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

  // Header এর জন্য ডাটাগুলো এক্সট্রাক্ট করা হচ্ছে
  const job = report.job || {};
  const inspectionDate = formatInspectionDate(report.createdAt || job.createdAt);
  const caseNo = job.fhaCaseDetailsNo || "N/A";
  const formType = job.formType || "92051 - FHA Inspection";
  const streetAddress = job.streetAddress || "N/A";

  // Puppeteer-এর জন্য Header Template (অবশ্যই inline CSS ব্যবহার করতে হবে)
  const headerTemplate = `
    <div style="font-family: Helvetica, Arial, sans-serif; font-size: 11px; width: 100%; color: #222325; padding: 0 30px; background: white; -webkit-print-color-adjust: exact;">
      <div style="display: flex; flex-direction: column; align-items: center; margin-bottom: 8px;">
        ${LOGO_TOP ? `<img src="${LOGO_TOP}" style="width: 100px; height: 58px; object-fit: contain; margin-bottom: 4px;" />` : ''}
        <div style="font-size: 8px; color: #474747;">www.FHAInspection.com / www.artneidich.com</div>
        <div style="font-size: 8px; color: #000;">A division of Lone Star Building Inspection, Inc.</div>
        <div style="font-size: 10px; font-weight: bold;">Attachment to FHA Form 92051</div>
      </div>
      <div style="border-top: 1px solid #EFEFF1; margin: 6px 0 8px;"></div>
      <div style="display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 11px;">
        <div><strong>Date of Inspection:</strong> ${inspectionDate}</div>
        <div><strong>FHA Case #</strong> ${caseNo}</div>
      </div>
      <div style="display: flex; justify-content: space-between; margin-bottom: 2px; font-size: 11px;">
        <div><strong>Type of Inspection:</strong> ${formType}</div>
      </div>
      <div style="font-size: 11px;"><strong>Subject Property:</strong> ${streetAddress}</div>
    </div>
  `;

  // Puppeteer-এর জন্য Footer Template (এখানে pageNumber যুক্ত করা হয়েছে)
  const footerTemplate = `
    <div style="font-family: Helvetica, Arial, sans-serif; font-size: 8px; width: 100%; color: #333; padding: 0 24px; display: flex; align-items: center; justify-content: space-between; border-top: 1px solid #000; -webkit-print-color-adjust: exact; background: white;">
      ${LOGO_FOOTER_LEFT ? `<img src="${LOGO_FOOTER_LEFT}" style="width: 45px; height: 45px; object-fit: contain;" />` : `<div style="width: 45px;"></div>`}
      <div style="text-align: center; flex: 1; margin: 0 10px; font-weight: bold; line-height: 1.4;">
        All utilities are on and tested unless otherwise noted<br />
        Properties without working utilities do not qualify for compliance<br />
        TREC Lic. # 10546 | TSBPE Lic. # 3836 | Code Enforcement Lic. # 7055 | HUD-FHA Fee Reg.# D683 & 203K – D0931<br />
        ICC Certified Residential Combination Inspector<br/>
        <span style="color: #666; font-size: 9px; margin-top: 4px; display: block;">Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
      </div>
      ${LOGO_FOOTER_RIGHT ? `<img src="${LOGO_FOOTER_RIGHT}" style="width: 45px; height: 45px; object-fit: contain;" />` : `<div style="width: 45px;"></div>`}
    </div>
  `;

  const pdfBuffer = await page.pdf({
    format: "A4",
    printBackground: true,
    displayHeaderFooter: true, // এটি চালু করতে হবে
    headerTemplate: headerTemplate,
    footerTemplate: footerTemplate,
    margin: {
      top: "160px", // Header-এর জন্য উপরের জায়গা (প্রয়োজনে বাড়াতে/কমাতে পারেন)
      bottom: "85px", // Footer-এর জন্য নিচের জায়গা
      left: "12mm",
      right: "12mm",
    },
  });

  await browser.close();
  return pdfBuffer;
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function loadBase64(filePath, mime = "image/png") {
  try {
    return `data:${mime};base64,${fs.readFileSync(filePath).toString("base64")}`;
  } catch {
    return "";
  }
}

const LOGO_TOP = loadBase64(path.join(__dirname, "../../public/images/logo.png"));
const LOGO_FOOTER_LEFT = loadBase64(path.join(__dirname, "../../public/images/footer-logo-left.png"));
const LOGO_FOOTER_RIGHT = loadBase64(path.join(__dirname, "../../public/images/footer-logo-right.png"));

/** Format any date-like value → M-D-YYYY */
function formatInspectionDate(value) {
  if (!value) {
    const t = new Date();
    return `${t.getMonth() + 1}-${t.getDate()}-${t.getFullYear()}`;
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getMonth() + 1}-${value.getDate()}-${value.getFullYear()}`;
  }
  const raw = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(raw)) {
    const [year, month, day] = raw.slice(0, 10).split("-").map(Number);
    return `${month}-${day}-${year}`;
  }
  const norm = raw.replace(/\//g, "-");
  const match = norm.match(/^(\d{1,4})-(\d{1,2})-(\d{1,4})(?:\s.*)?$/);
  if (match) {
    const [, a, b, c] = match;
    if (a.length === 4) return `${+b}-${+c}-${+a}`;
    if (c.length === 4) return `${+a}-${+b}-${+c}`;
  }
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return `${parsed.getMonth() + 1}-${parsed.getDate()}-${parsed.getFullYear()}`;
  }
  return raw;
}

function cleanImageUrl(url) {
  return url ? url.split("?")[0] : null;
}

// ─── section renderer ─────────────────────────────────────────────────────────

function renderSection(label, imgs) {
  const renderImg = (img) => {
    const src = cleanImageUrl(img?.url);
    const alt = img?.alt || img?.fileName || "";
    const note = img?.noteForAdmin;
    return `
      <div class="img-cell">
        ${
          src
            ? `<img src="${src}" alt="${alt}" />`
            : `<p class="img-unavailable">Image not available</p>`
        }
        ${note ? `<p class="img-note">Note: ${note}</p>` : ""}
      </div>`;
  };

  const imagesHtml =
    imgs.length === 1
      ? `<div class="img-single">${renderImg(imgs[0])}</div>`
      : `<div class="img-row">${renderImg(imgs[0])}${renderImg(imgs[1])}</div>`;

  return `
    <div class="section-block">
      <p class="section-title">${label}</p>
      ${imagesHtml}
    </div>`;
}

function buildReportHTML(report) {
  const images = report.images || [];

  // Group images by label (preserve insertion order)
  const labelMap = new Map();
  for (const entry of images) {
    const label = entry.imageLabel || "Unlabelled";
    if (!labelMap.has(label)) labelMap.set(label, []);
    labelMap.get(label).push(entry.image || {});
  }

  const sectionsHtml = [...labelMap.entries()]
    .map(([label, imgs]) => renderSection(label, imgs))
    .join("\n");

  return `<!DOCTYPE html>
            <html lang="en">
              <head>
                <meta charset="UTF-8" />
                <style>
                  *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
              
                  body {
                    font-family: Helvetica, Arial, sans-serif;
                    font-size: 13px;
                    color: #222325;
                    background: #ffffff;
                  }
              
                  /* ═══════════════════════════════════════════════════════
                    SECTION BLOCKS (scrollable content)
                    ═══════════════════════════════════════════════════════ */
                  .section-block {
                    padding: 10px 15px 15px 15px;
                    margin-bottom: 20px;
                    page-break-inside: avoid;
                    break-inside: avoid;
                    display: block; 
                  }

                  .section-title {
                    font-size: 15px;
                    font-weight: bold;
                    color: #222325;
                    text-align: center;
                    margin-bottom: 12px;
                    text-transform: uppercase;
                  }
              
                  .img-single {
                    width: 75%;
                    margin: 0 auto;
                  }
              
                  .img-row {
                    display: flex;
                    justify-content: space-between;
                    gap: 14px;
                  }

                 
                  .img-cell { flex: 1; break-inside: avoid; page-break-inside: avoid; }
              
                  .img-cell img {
                    width: 100%;
                    height: 210px;
                    object-fit: cover;
                    display: block;
                  }

                  .img-unavailable { color: red; font-size: 10px; }
                  .img-note {
                    font-size: 9px;
                    color: #555555;
                    margin-top: 5px;
                    font-style: italic;
                  }
                </style>
              </head>
              <body>
              
                <!-- ═══ SCROLLABLE CONTENT ═══ -->
              
                ${sectionsHtml}
              
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
