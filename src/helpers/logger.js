const fs = require("fs");
const path = require("path");

const logDir = path.join(__dirname, "..", "..", "logs");
const logFile = path.join(logDir, "error.log");

function ensureLogDir() {
  try {
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
  } catch (e) {
    // swallow
    console.error("Error ensuring log directory:", e);
  }
}

function logError(err, meta) {
  try {
    ensureLogDir();
    const entry = {
      time: new Date().toISOString(),
      message: err && err.message ? err.message : String(err),
      stack: err && err.stack ? err.stack.split("\n") : undefined,
      meta: meta || null,
    };
    fs.appendFileSync(logFile, JSON.stringify(entry) + "\n");
  } catch (e) {
    // intentionally silent
    console.error("Error writing to log file:", e);
  }
}

module.exports = { logError };
