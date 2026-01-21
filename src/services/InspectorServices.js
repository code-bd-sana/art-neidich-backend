const JobModel = require("../models/JobModel");
const ReportModel = require("../models/ReportModel");

/**
 * Get inspector overview statistics (all-time)
 *
 * @param {Object} payload
 * @param {import('mongoose').Types.ObjectId} payload.inspector
 * @returns {Promise<Object>}
 */
async function inspectorOverview(payload) {
  const [totalJobs, inProgressJobs, overDueJobs, completedJobs] =
    await Promise.all([
      /* ============================
         Total jobs
      ============================ */
      JobModel.countDocuments({
        inspector: payload.inspector,
      }),

      /* ============================
         In-progress jobs
         (report exists but not completed)
      ============================ */
      ReportModel.countDocuments({
        inspector: payload.inspector,
        status: { $in: ["submitted", "rejected"] },
      }),

      /* ============================
         Overdue jobs
         (dueDate passed & not completed)
      ============================ */
      JobModel.countDocuments({
        inspector: payload.inspector,
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
        inspector: payload.inspector,
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
