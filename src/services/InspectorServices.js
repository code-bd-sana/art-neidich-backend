const JobModel = require("../models/JobModel");
const ReportModel = require("../models/ReportModel");

/**
 * Get inspector overview statistics (all-time)
 *
 * @param {Object} payload
 * @param {import('mongoose').Types.ObjectId} inspector
 * @returns {Promise<Object>}
 */
async function inspectorOverview(inspector) {
  const [totalJobs, inProgressJobs, overDueJobs, completedJobs] =
    await Promise.all([
      /* ============================
         Total jobs
      ============================ */
      JobModel.countDocuments({
        inspector: inspector,
      }),

      /* ============================
         In-progress jobs
         (report exists but not completed)
      ============================ */
      ReportModel.countDocuments({
        inspector: inspector,
        status: { $in: ["submitted", "rejected"] },
      }),

      /* ============================
         Overdue jobs
         (dueDate passed & not completed)
      ============================ */
      JobModel.countDocuments({
        inspector: inspector,
        dueDate: { $lt: new Date() },
        _id: {
          $nin: await ReportModel.distinct("job", {
            status: "completed",
          }),
        },
      }),

      /* ============================
         Completed jobs
      ============================ */
      ReportModel.countDocuments({
        inspector: inspector,
        status: "completed",
      }),
    ]);

  return {
    totalJobs,
    inProgressJobs,
    overDueJobs,
    completedJobs: completedJobs,
  };
}

module.exports = {
  inspectorOverview,
};
