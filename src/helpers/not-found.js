/**
 * Helper function to handle not found paths.
 * Sends a 404 response with a JSON message.
 * @param {import('express').Request} req - The Express request object.
 * @param {import('express').Response} res - The Express response object.
 */
const pathNotFoundHelper = (req, res) => {
  res.status(404).json({
    success: false,
    message: "Path not found",
    path: req.originalUrl,
    code: 404,
  });
};

module.exports = { pathNotFoundHelper };
