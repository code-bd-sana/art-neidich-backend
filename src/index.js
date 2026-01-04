// External imports
const dotenv = require("dotenv");
const mongoose = require("mongoose");

dotenv.config();

// Internal imports
const app = require("./app");
const { logError } = require("./helpers/logger");

const server = app.listen(process.env.PORT, () => {
  // Minimal startup message
  console.log(`Server running on port ${process.env.PORT}`);
});

// Connect DB after server starts
mongoose
  .connect(process.env.DB_CONNECTION_URI)
  .then(() => {
    console.log("Database connected successfully");
  })
  .catch((err) => {
    // log silently and show minimal message
    logError(err, { context: "mongoose.connect" });
    console.log("Database connection failed");
  });

// Handle unhandled promise rejections and uncaught exceptions silently
process.on("unhandledRejection", (reason) => {
  try {
    logError(reason, { type: "unhandledRejection" });
  } catch (e) {
    // ignore
    console.error("Error logging unhandled rejection:", e);
  }
});

process.on("uncaughtException", (err) => {
  try {
    logError(err, { type: "uncaughtException" });
  } catch (e) {
    // ignore
    console.error("Error logging uncaught exception:", e);
  }
});

module.exports = server;
