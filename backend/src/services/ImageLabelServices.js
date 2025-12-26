const mongoose = require("mongoose");

const ImageLabelModel = require("../models/ImageLabelModel");
const ReportModel = require("../models/ReportModel");

// Utility function to escape special regex characters in a string (e.g., for search)
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Create a new image label if it doesn't already exist (case-insensitive)
 *
 * @param {{label: string}} payload
 * @param {Object} user - user creating the label
 * @returns {Promise<Object>} created label
 */
async function createImageLabel(payload, user) {
  const label = payload.label;

  const escaped = escapeRegExp(label);
  const existing = await ImageLabelModel.findOne({
    label: { $regex: `^${escaped}$`, $options: "i" },
  });

  if (existing) {
    const err = new Error("Label already exists");
    err.status = 400;
    err.code = "LABEL_EXISTS";
    throw err;
  }

  const created = await ImageLabelModel.create({
    label,
    createdBy: new mongoose.Types.ObjectId(user.id),
    lastUpdatedBy: new mongoose.Types.ObjectId(user.id),
  });
  return created;
}

/**
 * Get image labels with optional search and pagination
 *
 * @param {Object} query
 * @param {number} [query.page=1]
 * @param {number} [query.limit=10]
 * @param {string} [query.search]
 * @returns {Promise<{labels: Array, metaData: Object}>}
 */
async function getImageLabels(query = {}) {
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 10;
  const skip = (page - 1) * limit;
  const search = query.search?.trim();

  const filter = {};
  if (search) {
    const esc = escapeRegExp(search);
    filter.label = { $regex: esc, $options: "i" };
  }

  const [labels, total] = await Promise.all([
    ImageLabelModel.find(filter)
      .populate("createdBy", "firstName lastName email")
      .populate("lastUpdatedBy", "firstName lastName email")
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 }),
    ImageLabelModel.countDocuments(filter),
  ]);

  return {
    labels,
    metaData: {
      page,
      limit,
      totalLabel: total,
      totalPage: Math.ceil(total / limit),
    },
  };
}

/**
 * Get a single image label by id
 *
 * @param {string} id
 * @returns {Promise<Object>}
 */
async function getImageLabel(id) {
  const label = await ImageLabelModel.findById(id)
    .populate("createdBy", "firstName lastName email")
    .populate("lastUpdatedBy", "firstName lastName email");
  if (!label) {
    const err = new Error("Image label not found");
    err.status = 404;
    err.code = "LABEL_NOT_FOUND";
    throw err;
  }
  return label;
}

/**
 * Update an image label. Checks for duplicate label value.
 *
 * @param {string} id
 * @param {{label?: string}} payload
 * @param {Object} user - user updating the label
 * @returns {Promise<Object>} updated label
 */
async function updateImageLabel(id, payload, user) {
  const labelValue = payload.label;

  if (labelValue) {
    const esc = escapeRegExp(labelValue);
    const existing = await ImageLabelModel.findOne({
      label: { $regex: `^${esc}$`, $options: "i" },
      _id: { $ne: id },
    });

    if (existing) {
      const err = new Error("Label already exists");
      err.status = 400;
      err.code = "LABEL_EXISTS";
      throw err;
    }
  }

  const updated = await ImageLabelModel.findByIdAndUpdate(
    id,
    {
      ...payload,
      lastUpdatedBy: new mongoose.Types.ObjectId(user.id),
    },
    {
      new: true,
    }
  )
    .populate("createdBy", "firstName lastName email")
    .populate("lastUpdatedBy", "firstName lastName email");

  if (!updated) {
    const err = new Error("Image label not found");
    err.status = 404;
    err.code = "LABEL_NOT_FOUND";
    throw err;
  }

  return updated;
}

/**
 * Delete image label
 *
 * @param {string} id
 * @returns {Promise<void>}
 */
async function deleteImageLabel(id) {
  const existing = await ImageLabelModel.findById(id);
  if (!existing) {
    const err = new Error("Image label not found");
    err.status = 404;
    err.code = "LABEL_NOT_FOUND";
    throw err;
  }
  await ImageLabelModel.findByIdAndDelete(id);
  return;
}

module.exports = {
  createImageLabel,
  getImageLabels,
  getImageLabel,
  updateImageLabel,
  deleteImageLabel,
};
