const JobModel = require("../models/JobModel");
const ReportModel = require("../models/ReportModel");

/**
 * Get inspector overview statistics (all-time)
 *
 * In-progress Definition:
 * Job assigned to inspector but NO report created yet
 */
async function inspectorOverview(inspector) {
  const inspectorReportedJobs = await ReportModel.distinct("job", {
    inspector,
  });

  const inspectorCompletedJobs = await ReportModel.distinct("job", {
    inspector,
    status: "completed",
  });

  const [totalJobs, inProgressJobs, overDueJobs, completedJobs] =
    await Promise.all([
      /* ============================
         Total jobs
      ============================ */
      JobModel.countDocuments({
        inspector,
      }),

      /* ============================
         In-progress jobs
         (no report yet)
      ============================ */
      JobModel.countDocuments({
        inspector,
        _id: { $nin: inspectorReportedJobs },
      }),

      /* ============================
         Overdue jobs
         (dueDate passed & not completed)
      ============================ */
      JobModel.countDocuments({
        inspector,
        dueDate: { $lt: new Date() },
        _id: { $nin: inspectorCompletedJobs },
      }),

      /* ============================
         Completed jobs
      ============================ */
      ReportModel.countDocuments({
        inspector,
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
  inspectorOverview,
};
