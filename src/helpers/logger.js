const fs = require("fs");
const path = require("path");

// Log file path
const logDir = path.join(__dirname, "..", "..", "logs");
const logFile = path.join(logDir, "error.log");

/**
 * Ensure log directory exists
 *
 * @returns {void}
 */
function ensureLogDir() {
  try {
    // Create log directory if it doesn't exist
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
  } catch (e) {
    // swallow
    console.error("Error ensuring log directory:", e);
  }
}

/**
 * Log error to file
 *
 * @param {Error} err - Error object
 * @param {Object} [meta] - Additional metadata
 * @returns {void}
 */
function logError(err, meta) {
  try {
    // Ensure log directory exists
    ensureLogDir();

    // Prepare log entry
    const entry = {
      time: new Date().toISOString(),
      message: err && err.message ? err.message : String(err),
      stack: err && err.stack ? err.stack.split("\n") : undefined,
      meta: meta || null,
    };

    // Append log entry to file
    fs.appendFileSync(logFile, JSON.stringify(entry) + "\n");
  } catch (e) {
    // intentionally silent
    console.error("Error writing to log file:", e);
  }
}

module.exports = { logError };
