const JobModel = require("../models/JobModel");
const ReportModel = require("../models/ReportModel");

/**
 * Admin overview stats
 *
 * In-Progress Job Definition:
 * Job exists but NO report created yet
 */
async function adminOverview() {
  //
  const reportedJobIds = await ReportModel.distinct("job");

  const completedJobIds = await ReportModel.distinct("job", {
    status: "completed",
  });

  const archivedJobIds = await ReportModel.distinct("job", {
    status: "archived",
  });

  const [totalJobs, inProgressJobs, overDueJobs, completedJobs] =
    await Promise.all([
      /* ============================
         Total jobs
      ============================ */
      JobModel.countDocuments({
        status: { $ne: "archived" },
      }),

      /* ============================
         In-progress jobs
         (no report exists yet)
      ============================ */
      JobModel.countDocuments({
        status: { $ne: "archived" },
        _id: { $nin: reportedJobIds },
      }),

      /* ============================
        In-progress jobs
        (no report exists yet)
      ============================ */
      JobModel.countDocuments({
        _id: { $nin: [...reportedJobIds, ...archivedJobIds] },
      }),

      /* ============================
        Overdue jobs
        (dueDate passed & not completed)
      ============================ */
      JobModel.countDocuments({
        status: { $ne: "archived" },
        dueDate: { $lt: new Date() },
        _id: { $nin: [...completedJobIds, ...archivedJobIds] },
      }),

      /* ============================
        Completed jobs
      ============================ */
      ReportModel.countDocuments({
        status: "completed",
      }),
    ]);

  console.log(
    totalJobs,
    inProgressJobs,
    overDueJobs,
    completedJobs,
  );
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
