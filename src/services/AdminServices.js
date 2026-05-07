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

  const archivedJobIds = await ReportModel.distinct("job", {
    status: "archived",
  });

  const [totalJobs, inProgressJobs, overDueJobs, completedJobsCount] =
    await Promise.all([
      JobModel.countDocuments({
        _id: { $nin: archivedJobIds },
      }),

      JobModel.countDocuments({
        _id: { $nin: reportedJobIds },
      }),

      JobModel.countDocuments({
        dueDate: { $lt: new Date() },
        _id: { $nin: [...completedJobIds, ...archivedJobIds] },
      }),

      ReportModel.countDocuments({
        status: "completed",
      }),
    ]);

  return {
    totalJobs,
    inProgressJobs,
    overDueJobs,
    completedJobs: completedJobsCount,
  };
}

module.exports = {
  adminOverview,
};
