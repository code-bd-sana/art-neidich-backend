const mongoose = require("mongoose");
const ReportModel = require("../models/ReportModel");
const ArchiveSettingsModel = require("../models/ArchiveSettingsModel");

/**
 * Archive completed reports based on archival policy
 *
 * Logic:
 * 1. Fetch current autoArchiveDays from ArchiveSettings
 * 2. Find all reports where:
 *    - status === "completed"
 *    - completedAt exists
 *    - current date >= completedAt + autoArchiveDays
 * 3. Archive them by setting status: "archived"
 *
 * @returns {Promise<Object>} - { archivedCount: number, reportIds: array }
 */
async function archiveCompletedReports() {
  try {
    // Fetch current archive settings
    let settings = await ArchiveSettingsModel.findOne();

    // If no settings exist, use default (30 days)
    if (!settings) {
      settings = await ArchiveSettingsModel.create({
        autoArchiveDays: 30,
      });
    }

    const autoArchiveDays = settings.autoArchiveDays;

    // Calculate the cutoff date
    // Reports completed before this date should be archived
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - autoArchiveDays);

    // Find reports that match the archival criteria
    // Reports with status "completed" and completedAt before cutoff date
    const reportsToArchive = await ReportModel.find({
      status: "completed",
      completedAt: {
        $exists: true,
        $ne: null,
        $lte: cutoffDate,
      },
    }).select("_id");

    // If no reports to archive, return early
    if (reportsToArchive.length === 0) {
      return {
        archivedCount: 0,
        reportIds: [],
        message: "No reports eligible for archival",
      };
    }

    // Archive the reports by updating status to "archived"
    const reportIds = reportsToArchive.map((report) => report._id);

    const updateResult = await ReportModel.updateMany(
      { _id: { $in: reportIds } },
      {
        status: "archived",
      },
    );

    return {
      archivedCount: updateResult.modifiedCount,
      reportIds,
      message: `Successfully archived ${updateResult.modifiedCount} report(s)`,
    };
  } catch (err) {
    console.error("Error archiving reports:", err);
    throw err;
  }
}

module.exports = {
  archiveCompletedReports,
};
