const JobModel = require("../models/JobModel");
const ReportModel = require("../models/ReportModel");

/**
 * Get inspector overview statistics (all-time)
 *
 * In-progress Definition:
 * Job assigned to inspector but NO report created yet
 */
async function inspectorOverview(inspector) {
  const allReportedJobIds = await ReportModel.distinct("job", {
    inspector,
  });

  const completedJobIds = await ReportModel.distinct("job", {
    inspector,
    status: "completed",
  });

  const archivedJobIds = await ReportModel.distinct("job", {
    inspector,
    status: "archived",
  });

  const [totalJobs, inProgressJobs, overDueJobs, completedJobs] =
    await Promise.all([
      /* ============================
         Total jobs
         (Archived জবগুলো বাদ দিয়ে)
      ============================ */
      JobModel.countDocuments({
        inspector,
        _id: { $nin: archivedJobIds },
      }),

      JobModel.countDocuments({
        inspector,
        _id: { $nin: allReportedJobIds },
      }),

      JobModel.countDocuments({
        inspector,
        dueDate: { $lt: new Date() },
        _id: { $nin: [...completedJobIds, ...archivedJobIds] },
      }),

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
