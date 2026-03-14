const JobModel = require("../models/JobModel");
const ReportModel = require("../models/ReportModel");

/**
 * Admin overview stats
 *
 * In-Progress Job Definition:
 * Job exists but NO report created yet
 */
async function adminOverview() {
  const reportedJobIds = await ReportModel.distinct("job");

  const completedJobIds = await ReportModel.distinct("job", {
    status: "completed",
  });

  const [totalJobs, inProgressJobs, overDueJobs, completedJobs] =
    await Promise.all([
      /* ============================
         Total jobs
      ============================ */
      JobModel.countDocuments(),

      /* ============================
         In-progress jobs
         (no report exists yet)
      ============================ */
      JobModel.countDocuments({
        _id: { $nin: reportedJobIds },
      }),

      /* ============================
         Overdue jobs
         (dueDate passed & not completed)
      ============================ */
      JobModel.countDocuments({
        dueDate: { $lt: new Date() },
        _id: { $nin: completedJobIds },
      }),

      /* ============================
         Completed jobs
      ============================ */
      ReportModel.countDocuments({
        status: "completed",
      }),
    ]);

  return {
    totalJobs,
    inProgressJobs,
    overDueJobs,
    completedJobs,
  };
}

module.exports = {
  adminOverview,
};
