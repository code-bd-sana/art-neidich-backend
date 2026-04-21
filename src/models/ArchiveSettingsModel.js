const mongoose = require("mongoose");

/**
 * ArchiveSettings Schema - Singleton document for archive configuration
 *
 * This model stores global archive settings used across the application
 * There should typically be only ONE document in this collection
 */
const archiveSettingsSchema = new mongoose.Schema(
  {
    // Number of days after job completion before auto-archiving
    // Enum: [7, 15, 30, 60, 120] for 7, 15, 30, 60, or 120 days
    autoArchiveDays: {
      type: Number,
      enum: [7, 15, 30, 60, 120],
      default: 30,
      description: "Days after job completion to auto-archive",
    },
  },
  { timestamps: true, versionKey: false },
);

const ArchiveSettingsModel = mongoose.model(
  "ArchiveSettings",
  archiveSettingsSchema,
);

module.exports = ArchiveSettingsModel;
