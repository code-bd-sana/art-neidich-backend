const { logError } = require("../helpers/logger");

module.exports = function errorHandler(err, req, res, next) {
  // Log error silently to file
  try {
    logError(err, { path: req && req.originalUrl });
  } catch (e) {
    // swallow
  }

  const status = (err && err.status && Number(err.status)) || 500;
  const response = {
    success: false,
    message:
      status === 500
        ? "Internal Server Error"
        : (err && err.message) || "Error",
  };

  if (err && err.code) response.code = err.code;

  // Ensure we only send once
  if (res.headersSent) return next(err);
  res.status(status).json(response);
};
