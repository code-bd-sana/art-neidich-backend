const mongoose = require("mongoose");
const ArchiveSettingsModel = require("../models/ArchiveSettingsModel");

/**
 * Get archive settings
 * If no document exists, create one with default values
 *
 * @returns {Promise<Object>}
 */
async function getArchiveSettings() {
  let settings = await ArchiveSettingsModel.findOne();

  // If no settings exist, create with defaults
  if (!settings) {
    settings = await ArchiveSettingsModel.create({
      autoArchiveDays: 30, // default to 30 days
    });
  }

  return settings;
}

/**
 * Update archive settings
 *
 * @param {Object} payload - { autoArchiveDays: number }
 * @returns {Promise<Object>}
 */
async function updateArchiveSettings(payload) {
  // Get existing settings or create new one
  let settings = await ArchiveSettingsModel.findOne();

  if (!settings) {
    // Create if doesn't exist
    settings = await ArchiveSettingsModel.create(payload);
  } else {
    // Update existing document
    settings = await ArchiveSettingsModel.findOneAndUpdate(
      {},
      { autoArchiveDays: payload.autoArchiveDays },
      { new: true },
    );
  }

  return settings;
}

module.exports = {
  getArchiveSettings,
  updateArchiveSettings,
};
