const JobModel = require("../models/JobModel");
const ReportModel = require("../models/ReportModel");

/**
 * Get admin overview statistics (weekly)
 *
 * @returns {Promise<Object>}
 */
async function adminOverview() {
  const now = new Date();

  // Start of current week (Monday)
  const startOfWeek = new Date(now);
  startOfWeek.setHours(0, 0, 0, 0);
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay() + 1);

  // Start of today
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);

  const [totalJobs, inProgressJobs, overDueJobs, completedJobsToday] =
    await Promise.all([
      /* ============================
       Total jobs created this week
    ============================ */
      JobModel.countDocuments({
        createdAt: { $gte: startOfWeek },
      }),

      /* ============================
       In-progress jobs
       (report exists but not completed)
    ============================ */
      ReportModel.countDocuments({
        status: { $in: ["submitted", "rejected"] },
      }),

      /* ============================
       Overdue jobs
       (dueDate passed & not completed)
    ============================ */
      JobModel.countDocuments({
        dueDate: { $lt: now },
        _id: {
          $nin: await ReportModel.distinct("job", {
            status: "completed",
          }),
        },
      }),

      /* ============================
       Completed jobs today
    ============================ */
      ReportModel.countDocuments({
        status: "completed",
        updatedAt: {
          $gte: startOfToday,
          $lte: now,
        },
      }),
    ]);

  return {
    totalJobs,
    inProgressJobs,
    overDueJobs,
    completedJobsToday,
  };
}

module.exports = {
  adminOverview,
};
