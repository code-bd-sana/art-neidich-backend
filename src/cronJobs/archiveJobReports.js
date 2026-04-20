const cron = require("node-cron");
const { archiveCompletedReports } = require("../services/reportArchive.service");

/**
 * Archive Reports Cron Job
 *
 * Runs every day at 00:30 AM
 * Automatically archives completed reports based on the autoArchiveDays setting
 *
 * Cron Pattern: "30 0 * * *"
 * - 30 = minute
 * - 0 = hour (00:00 in 24-hour format = 12:00 AM)
 * - * = day of month (every day)
 * - * = month (every month)
 * - * = day of week (every day)
 *
 * @returns {import('node-cron').ScheduledTask}
 */
function scheduleArchiveJobReports() {
  const task = cron.schedule("30 0 * * *", async () => {
    try {
      console.log("[CRON] Starting report archival process...");
      const result = await archiveCompletedReports();
      console.log(`[CRON] Report archival completed:`, result);
    } catch (err) {
      console.error("[CRON] Error in report archival cron:", err);
    }
  });

  console.log("[CRON] Archive Reports cron job scheduled: every day at 00:30 AM");
  return task;
}

module.exports = {
  scheduleArchiveJobReports,
};
