const { logError } = require("../helpers/logger");

module.exports = function errorHandler(err, req, res, next) {
  // Log error silently to file
  try {
    // Log the error with the request path for context
    logError(err, { path: req && req.originalUrl });
  } catch (e) {
    // swallow
    console.error("Error logging in errorHandler middleware:", e);
  }

  // Send generic error response
  const status = (err && err.code && Number(err.code)) || 500;

  // Construct response
  const response = {
    success: false,
    code: status,
    message:
      status === 500
        ? "Internal Server Error"
        : (err && err.message) || "Error",
  };

  // Ensure we only send once
  if (res.headersSent) return next(err);

  res.status(status).json(response);
};
